import { eq, and, sql, desc, or, ilike, gte, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { podcasts, podcastSources, podcastTopics, topics } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { config } from '../config/index.js';
import { listenNotesClient, type ListenNotesPodcast } from './listenNotes.client.js';
import { expandSearchQuery, isLikelyAbbreviation } from '../utils/searchSynonyms.js';
import {
    resolveTopics,
    detectQueryIntent,
    normalizeQuery,
    searchPodcastsFTS,
    searchPodcastsTrigramName,
    getTopicsForPodcast,
    type ResolvedTopic,
} from './topicSearch.service.js';
import type {
    Podcast,
    PodcastSearchParams,
    PodcastSearchResult,
    PodcastIngestionInput
} from '@podcast-pitch/shared';

// =============================================================================
// EXTENDED TYPES FOR HYBRID SEARCH
// =============================================================================

export interface MatchEvidence {
    type: 'topic' | 'fts' | 'trigram_name' | 'fallback';
    matchedTopics?: { slug: string; displayName: string; weight: number }[];
    ftsRank?: number;
    trigramSimilarity?: number;
    trigramField?: 'title' | 'host_name' | 'publisher';
}

export interface EnhancedPodcast extends Podcast {
    score: number;
    matchEvidence: MatchEvidence;
}

export interface HybridSearchResult extends PodcastSearchResult {
    sourceBreakdown: {
        local: number;
        listenNotes: number;
    };
    nextOffset?: number;
}

export interface EnhancedSearchResult {
    podcasts: EnhancedPodcast[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    resolvedTopics: ResolvedTopic[];
    queryIntent: { type: string; confidence: number };
    sourceBreakdown: {
        local: number;
        listenNotes: number;
    };
}

// =============================================================================
// PODCAST SERVICE WITH HYBRID SEARCH
// =============================================================================

export class PodcastService {
    /**
     * Hybrid search: Local-first with Listen Notes fallback
     * 
     * Algorithm:
     * 1. Search local DB first using FTS
     * 2. If results < LOCAL_MIN_RESULTS, call Listen Notes
     * 3. Upsert LN results into local DB
     * 4. Merge and dedupe by external_id
     * 5. Return combined results with source breakdown
     */
    static async search(params: PodcastSearchParams): Promise<HybridSearchResult> {
        const {
            query,
            categories,
            language,
            minAudienceSize,
            maxAudienceSize,
            activeOnly,
            page = 1,
            limit = 20
        } = params;

        const offset = (page - 1) * limit;
        const localMinResults = config.listenNotes.localMinResults;

        // Step 1: Search local DB first
        const localResults = await this.searchLocal({
            query,
            categories,
            language,
            minAudienceSize,
            maxAudienceSize,
            activeOnly,
            limit: Math.max(limit, localMinResults),
            offset,
        });

        let listenNotesCount = 0;
        let nextOffset: number | undefined;

        // Step 2: Determine if we should fetch from Listen Notes
        // - Always fetch on page 1 if there's a query (for fresh, relevant results)
        // - Fetch on later pages only if we don't have enough cached results
        const shouldFetchFromListenNotes = query &&
            listenNotesClient.isConfigured() &&
            (page === 1 || localResults.podcasts.length < limit);

        if (shouldFetchFromListenNotes) {
            console.log(`📊 Fetching from Listen Notes (page ${page}, local: ${localResults.podcasts.length})...`);

            try {
                // Expand search query if it's a short abbreviation like "AI"
                const searchQueries = isLikelyAbbreviation(query)
                    ? expandSearchQuery(query).slice(0, 2)  // Limit to 2 expansions
                    : [query];

                console.log(`🔍 Search queries: ${searchQueries.join(', ')}`);

                // Search with each expanded query
                for (const searchQuery of searchQueries) {
                    const lnResult = await listenNotesClient.search({
                        query: searchQuery,
                        offset: page === 1 ? 0 : offset,
                        language: language || 'English',
                        safeMode: true,
                    });

                    // Upsert Listen Notes results into local cache
                    if (lnResult.podcasts.length > 0) {
                        await this.upsertListenNotesPodcasts(lnResult.podcasts);
                        listenNotesCount += lnResult.podcasts.length;
                        nextOffset = lnResult.nextOffset;
                    }

                    // If we have enough results, stop querying
                    if (listenNotesCount >= limit) break;
                }

                console.log(`✅ Ingested ${listenNotesCount} podcasts from Listen Notes`);
            } catch (error) {
                console.error('Listen Notes API error:', error);
                // Continue with local results only
            }
        }

        // Step 3: Re-query local DB to get merged/fresh results
        // This ensures Listen Notes results are included
        const mergedResults = await this.searchLocal({
            query,
            categories,
            language,
            minAudienceSize,
            maxAudienceSize,
            activeOnly,
            limit,
            offset,
        });

        return {
            ...mergedResults,
            sourceBreakdown: {
                local: localResults.podcasts.length,
                listenNotes: listenNotesCount,
            },
            nextOffset,
        };
    }

    /**
     * Search local database only
     */
    private static async searchLocal(params: {
        query?: string;
        categories?: string[];
        language?: string;
        minAudienceSize?: number;
        maxAudienceSize?: number;
        activeOnly?: boolean;
        limit: number;
        offset: number;
    }): Promise<PodcastSearchResult> {
        const { query, categories, language, minAudienceSize, maxAudienceSize, activeOnly, limit, offset } = params;
        const conditions = [];

        // Robust text search using regex word-boundary matching
        // This prevents "ai" from matching "trail", "train", etc.
        if (query) {
            // Expand abbreviations like "ai" -> ["ai", "artificial intelligence", ...]
            const expandedTerms = isLikelyAbbreviation(query)
                ? [query, ...expandSearchQuery(query)]
                : [query];

            // Build a combined search condition
            const searchConditions: ReturnType<typeof or>[] = [];

            for (const term of expandedTerms) {
                const words = term
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(word => word.length >= 2)
                    .map(word => word.replace(/[^a-z0-9]/g, '')) // Remove special chars
                    .filter(word => word.length >= 2)
                    .slice(0, 5);

                if (words.length > 0) {
                    // For each word, create regex conditions for word-boundary matching
                    // Pattern: (^|[^a-z])word([^a-z]|$) - matches word at start/end or surrounded by non-letters
                    const wordConditions = words.flatMap(w => {
                        const pattern = `(^|[^a-z])${w}([^a-z]|$)`;
                        return [
                            sql`${podcasts.title} ~* ${pattern}`,
                            sql`${podcasts.description} ~* ${pattern}`,
                        ];
                    });

                    searchConditions.push(or(...wordConditions));
                }
            }

            if (searchConditions.length > 0) {
                conditions.push(or(...searchConditions));
            }
        }

        // Category filter
        if (categories && categories.length > 0) {
            conditions.push(
                sql`${podcasts.categories} ?| array[${sql.raw(categories.map(c => `'${c}'`).join(','))}]`
            );
        }

        // Language filter
        if (language) {
            conditions.push(eq(podcasts.language, language));
        }

        // Audience size filters
        if (minAudienceSize !== undefined) {
            conditions.push(sql`${podcasts.audienceSizeEstimate} >= ${minAudienceSize}`);
        }
        if (maxAudienceSize !== undefined) {
            conditions.push(sql`${podcasts.audienceSizeEstimate} <= ${maxAudienceSize}`);
        }

        // Active podcasts only filter (episodes in last 6 months)
        if (activeOnly) {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            conditions.push(
                sql`${podcasts.latestEpisodePubDate} >= ${sixMonthsAgo}`
            );
        }

        // Always filter to podcasts with email addresses
        conditions.push(sql`${podcasts.contactEmail} IS NOT NULL`);

        const whereClause = and(...conditions);

        // Get total count
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(podcasts)
            .where(whereClause);

        // Get paginated results, ordered by latest episode date (active first), then listen_score
        const results = await db
            .select()
            .from(podcasts)
            .where(whereClause)
            .orderBy(
                sql`${podcasts.latestEpisodePubDate} DESC NULLS LAST`,
                desc(podcasts.listenScore),
                desc(podcasts.lastSeenAt)
            )
            .limit(limit)
            .offset(offset);

        return {
            podcasts: results.map(this.mapPodcast),
            total: count,
            page: Math.floor(offset / limit) + 1,
            limit,
            hasMore: offset + results.length < count,
        };
    }

    /**
     * Enhanced search with topics, FTS, and trigram matching
     * This is the new multi-signal search algorithm
     */
    static async searchEnhanced(params: PodcastSearchParams): Promise<EnhancedSearchResult> {
        const {
            query = '',
            categories,
            language,
            minAudienceSize,
            maxAudienceSize,
            activeOnly,
            page = 1,
            limit = 20
        } = params;

        const offset = (page - 1) * limit;
        const normalizedQuery = normalizeQuery(query);
        const queryIntent = detectQueryIntent(query);

        console.log(`🔍 Enhanced search: "${query}" (intent: ${queryIntent.type}, confidence: ${queryIntent.confidence})`);

        // Step 1: Resolve topics from query
        const resolvedTopics = await resolveTopics(normalizedQuery);
        console.log(`  📌 Resolved ${resolvedTopics.length} topics: ${resolvedTopics.map(t => t.displayName).join(', ')}`);

        // Step 2: Build candidate set from multiple sources
        const candidateMap = new Map<string, {
            id: string;
            listenScore: number | null;
            latestEpisodePubDate: Date | null;
            topicWeight: number;
            topicMatches: { slug: string; displayName: string; weight: number }[];
            ftsRank: number;
            trigramSimilarity: number;
            trigramField: 'title' | 'host_name' | 'publisher' | null;
        }>();

        // Source 1: Topic-based candidates
        if (resolvedTopics.length > 0) {
            const topicIds = resolvedTopics.map(t => t.id);
            const topicPodcasts = await db
                .select({
                    podcastId: podcastTopics.podcastId,
                    topicId: podcastTopics.topicId,
                    topicSlug: topics.slug,
                    topicDisplayName: topics.displayName,
                    weight: podcastTopics.weight,
                    listenScore: podcasts.listenScore,
                    latestEpisodePubDate: podcasts.latestEpisodePubDate,
                })
                .from(podcastTopics)
                .innerJoin(topics, eq(podcastTopics.topicId, topics.id))
                .innerJoin(podcasts, eq(podcastTopics.podcastId, podcasts.id))
                .where(inArray(podcastTopics.topicId, topicIds))
                .limit(200);

            for (const row of topicPodcasts) {
                const existing = candidateMap.get(row.podcastId);
                if (existing) {
                    existing.topicWeight = Math.max(existing.topicWeight, row.weight);
                    existing.topicMatches.push({
                        slug: row.topicSlug,
                        displayName: row.topicDisplayName,
                        weight: row.weight,
                    });
                } else {
                    candidateMap.set(row.podcastId, {
                        id: row.podcastId,
                        listenScore: row.listenScore,
                        latestEpisodePubDate: row.latestEpisodePubDate,
                        topicWeight: row.weight,
                        topicMatches: [{
                            slug: row.topicSlug,
                            displayName: row.topicDisplayName,
                            weight: row.weight,
                        }],
                        ftsRank: 0,
                        trigramSimilarity: 0,
                        trigramField: null,
                    });
                }
            }
            console.log(`  📚 Topic candidates: ${candidateMap.size}`);
        }

        // Source 2: FTS candidates (if query has meaningful words)
        if (normalizedQuery.length >= 2) {
            try {
                const ftsResults = await searchPodcastsFTS(normalizedQuery, { limit: 100 });
                for (const result of ftsResults) {
                    const existing = candidateMap.get(result.id);
                    if (existing) {
                        existing.ftsRank = result.rank;
                    } else {
                        // Need to fetch podcast details
                        const [podcast] = await db
                            .select({
                                listenScore: podcasts.listenScore,
                                latestEpisodePubDate: podcasts.latestEpisodePubDate,
                            })
                            .from(podcasts)
                            .where(eq(podcasts.id, result.id))
                            .limit(1);

                        if (podcast) {
                            candidateMap.set(result.id, {
                                id: result.id,
                                listenScore: podcast.listenScore,
                                latestEpisodePubDate: podcast.latestEpisodePubDate,
                                topicWeight: 0,
                                topicMatches: [],
                                ftsRank: result.rank,
                                trigramSimilarity: 0,
                                trigramField: null,
                            });
                        }
                    }
                }
                console.log(`  📝 FTS candidates: ${ftsResults.length}`);
            } catch (error) {
                console.error('FTS search error:', error);
            }
        }

        // Source 3: Trigram candidates (for name searches)
        if (queryIntent.type === 'name' || queryIntent.type === 'mixed') {
            try {
                const trigramResults = await searchPodcastsTrigramName(normalizedQuery, { limit: 50 });
                for (const result of trigramResults) {
                    const existing = candidateMap.get(result.id);
                    if (existing) {
                        if (result.similarity > existing.trigramSimilarity) {
                            existing.trigramSimilarity = result.similarity;
                            existing.trigramField = result.matchField;
                        }
                    } else {
                        const [podcast] = await db
                            .select({
                                listenScore: podcasts.listenScore,
                                latestEpisodePubDate: podcasts.latestEpisodePubDate,
                            })
                            .from(podcasts)
                            .where(eq(podcasts.id, result.id))
                            .limit(1);

                        if (podcast) {
                            candidateMap.set(result.id, {
                                id: result.id,
                                listenScore: podcast.listenScore,
                                latestEpisodePubDate: podcast.latestEpisodePubDate,
                                topicWeight: 0,
                                topicMatches: [],
                                ftsRank: 0,
                                trigramSimilarity: result.similarity,
                                trigramField: result.matchField,
                            });
                        }
                    }
                }
                console.log(`  👤 Trigram candidates: ${trigramResults.length}`);
            } catch (error) {
                console.error('Trigram search error:', error);
            }
        }

        // Step 3: Score and rank candidates
        const candidates = Array.from(candidateMap.values());
        const now = Date.now();
        const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;

        const scoredCandidates = candidates.map(c => {
            // Base score components (all normalized 0-1)
            const topicScore = c.topicWeight; // Already 0-1
            const ftsScore = Math.min(c.ftsRank * 10, 1); // Normalize FTS rank
            const trigramScore = c.trigramSimilarity; // Already 0-1

            // Listen score normalization (0-100 → 0-1)
            const listenScoreNormalized = (c.listenScore || 0) / 100;

            // Recency boost (1.0 for recent, decays for older)
            let recencyBoost = 0.5; // Default for no date
            if (c.latestEpisodePubDate) {
                const ageMs = now - c.latestEpisodePubDate.getTime();
                if (ageMs < sixMonthsAgo) {
                    recencyBoost = 1.0; // Very recent
                } else {
                    recencyBoost = Math.max(0.2, 1.0 - (ageMs / (365 * 24 * 60 * 60 * 1000)));
                }
            }

            // Weighted combination based on query intent
            let score: number;
            if (queryIntent.type === 'topic') {
                // Topic search: prioritize topic + listen score
                score = topicScore * 0.4 + ftsScore * 0.2 + listenScoreNormalized * 0.25 + recencyBoost * 0.15;
            } else if (queryIntent.type === 'name') {
                // Name search: prioritize trigram
                score = trigramScore * 0.5 + ftsScore * 0.2 + listenScoreNormalized * 0.2 + recencyBoost * 0.1;
            } else {
                // Mixed: balanced
                score = topicScore * 0.25 + ftsScore * 0.25 + trigramScore * 0.2 + listenScoreNormalized * 0.2 + recencyBoost * 0.1;
            }

            // Determine primary match source for evidence
            let matchType: 'topic' | 'fts' | 'trigram_name' | 'fallback' = 'fallback';
            if (topicScore > 0.3) matchType = 'topic';
            else if (trigramScore > 0.4) matchType = 'trigram_name';
            else if (ftsScore > 0) matchType = 'fts';

            return {
                ...c,
                score,
                matchType,
            };
        });

        // Sort by score descending
        scoredCandidates.sort((a, b) => b.score - a.score);

        // Apply pagination
        const paginatedIds = scoredCandidates
            .slice(offset, offset + limit)
            .map(c => c.id);

        // Fetch full podcast details for paginated results
        const podcastDetails = paginatedIds.length > 0
            ? await db
                .select()
                .from(podcasts)
                .where(inArray(podcasts.id, paginatedIds))
            : [];

        // Map to enhanced podcasts with evidence
        const enhancedPodcasts: EnhancedPodcast[] = paginatedIds.map(id => {
            const scored = scoredCandidates.find(c => c.id === id)!;
            const podcast = podcastDetails.find(p => p.id === id);

            if (!podcast) {
                throw new Error(`Podcast ${id} not found`);
            }

            return {
                ...this.mapPodcast(podcast),
                score: scored.score,
                matchEvidence: {
                    type: scored.matchType,
                    matchedTopics: scored.topicMatches.length > 0 ? scored.topicMatches : undefined,
                    ftsRank: scored.ftsRank > 0 ? scored.ftsRank : undefined,
                    trigramSimilarity: scored.trigramSimilarity > 0 ? scored.trigramSimilarity : undefined,
                    trigramField: scored.trigramField || undefined,
                },
            };
        });

        console.log(`  ✅ Returning ${enhancedPodcasts.length} results (total candidates: ${candidates.length})`);

        return {
            podcasts: enhancedPodcasts,
            total: candidates.length,
            page,
            limit,
            hasMore: offset + paginatedIds.length < candidates.length,
            resolvedTopics,
            queryIntent,
            sourceBreakdown: {
                local: candidates.length,
                listenNotes: 0, // Will be updated by the hybrid wrapper
            },
        };
    }

    /**
     * Get podcast by ID with optional enrichment from Listen Notes
     */
    static async getById(id: string): Promise<Podcast> {
        const podcast = await db.query.podcasts.findFirst({
            where: eq(podcasts.id, id),
        });

        if (!podcast) {
            throw new NotFoundError('Podcast');
        }

        // Check if enrichment is needed (last enriched > 7 days ago or never)
        const enrichmentCooldownDays = config.listenNotes.enrichmentCooldownDays;
        const shouldEnrich = !podcast.lastEnrichedAt ||
            (Date.now() - podcast.lastEnrichedAt.getTime()) > enrichmentCooldownDays * 24 * 60 * 60 * 1000;

        if (shouldEnrich && podcast.externalSource === 'listen_notes' && listenNotesClient.isConfigured()) {
            try {
                console.log(`🔄 Enriching podcast ${podcast.externalId} from Listen Notes...`);
                const detail = await listenNotesClient.getPodcastDetail(podcast.externalId);

                // Update with fresh data
                await this.upsertListenNotesPodcast(detail, true);

                // Return the updated podcast
                const updated = await db.query.podcasts.findFirst({
                    where: eq(podcasts.id, id),
                });

                if (updated) {
                    return this.mapPodcast(updated);
                }
            } catch (error) {
                console.error('Listen Notes enrichment error:', error);
                // Continue with existing data
            }
        }

        return this.mapPodcast(podcast);
    }

    /**
     * Upsert a single Listen Notes podcast with null-safe rules
     */
    static async upsertListenNotesPodcast(data: ListenNotesPodcast, isEnrichment = false): Promise<void> {
        const now = new Date();

        // Build the set clause with null-safe updates
        const setClause: Record<string, unknown> = {
            lastSeenAt: now,
            updatedAt: now,
        };

        // Only update if value is non-null and non-empty
        if (data.title) setClause.title = data.title;
        if (data.description) setClause.description = data.description;
        if (data.publisher) setClause.publisher = data.publisher;
        if (data.language) setClause.language = data.language;
        if (data.country) setClause.country = data.country;
        if (data.imageUrl) setClause.imageUrl = data.imageUrl;
        if (data.genreIds && data.genreIds.length > 0) setClause.genreIds = data.genreIds;
        if (data.listenScore !== null) setClause.listenScore = data.listenScore;
        if (data.listenScoreGlobalRank) setClause.listenScoreGlobalRank = data.listenScoreGlobalRank;
        if (data.explicitContent !== null) setClause.explicitContent = data.explicitContent;
        if (data.audienceSizeEstimate !== null) setClause.audienceSizeEstimate = data.audienceSizeEstimate;

        // Only update email/rss if non-null (don't overwrite existing with null)
        if (data.contactEmail) setClause.contactEmail = data.contactEmail;
        if (data.rssUrl) setClause.rssUrl = data.rssUrl;
        if (data.websiteUrl) setClause.websiteUrl = data.websiteUrl;

        // Activity tracking fields
        if (data.latestEpisodePubDate) setClause.latestEpisodePubDate = data.latestEpisodePubDate;
        if (data.totalEpisodes !== null) setClause.totalEpisodes = data.totalEpisodes;

        // If this is an enrichment call, update lastEnrichedAt
        if (isEnrichment) {
            setClause.lastEnrichedAt = now;
        }

        // Increment data version
        setClause.dataVersion = sql`COALESCE(${podcasts.dataVersion}, 0) + 1`;

        await db
            .insert(podcasts)
            .values({
                externalSource: 'listen_notes',
                externalId: data.externalId,
                title: data.title,
                description: data.description,
                publisher: data.publisher,
                categories: data.categories || [],
                language: data.language,
                country: data.country,
                hostName: data.hostName,
                contactEmail: data.contactEmail,
                rssUrl: data.rssUrl,
                websiteUrl: data.websiteUrl,
                imageUrl: data.imageUrl,
                genreIds: data.genreIds,
                listenScore: data.listenScore,
                listenScoreGlobalRank: data.listenScoreGlobalRank,
                explicitContent: data.explicitContent,
                audienceSizeEstimate: data.audienceSizeEstimate,
                latestEpisodePubDate: data.latestEpisodePubDate,
                totalEpisodes: data.totalEpisodes,
                firstSeenAt: now,
                lastSeenAt: now,
                lastEnrichedAt: isEnrichment ? now : null,
            })
            .onConflictDoUpdate({
                target: [podcasts.externalSource, podcasts.externalId],
                set: setClause,
            });

        // Store provenance record
        const [insertedPodcast] = await db
            .select({ id: podcasts.id })
            .from(podcasts)
            .where(and(
                eq(podcasts.externalSource, 'listen_notes'),
                eq(podcasts.externalId, data.externalId)
            ))
            .limit(1);

        if (insertedPodcast) {
            await db.insert(podcastSources).values({
                podcastId: insertedPodcast.id,
                source: 'listen_notes',
                rawPayload: data.rawPayload,
                fetchedAt: now,
            });
        }
    }

    /**
     * Bulk upsert Listen Notes podcasts
     */
    static async upsertListenNotesPodcasts(data: ListenNotesPodcast[]): Promise<number> {
        let count = 0;

        for (const podcast of data) {
            try {
                await this.upsertListenNotesPodcast(podcast);
                count++;
            } catch (error) {
                console.error(`Failed to upsert podcast ${podcast.externalId}:`, error);
            }
        }

        return count;
    }

    /**
     * Original upsert method for backward compatibility
     */
    static async upsert(data: PodcastIngestionInput): Promise<Podcast> {
        const [result] = await db
            .insert(podcasts)
            .values({
                externalSource: data.externalSource,
                externalId: data.externalId,
                title: data.title,
                description: data.description,
                categories: data.categories,
                language: data.language,
                hostName: data.hostName,
                contactEmail: data.contactEmail,
                websiteUrl: data.website,
                audienceSizeEstimate: data.audienceSizeEstimate,
                imageUrl: data.imageUrl,
            })
            .onConflictDoUpdate({
                target: [podcasts.externalSource, podcasts.externalId],
                set: {
                    title: data.title,
                    description: data.description,
                    categories: data.categories,
                    language: data.language,
                    hostName: data.hostName,
                    contactEmail: data.contactEmail,
                    websiteUrl: data.website,
                    audienceSizeEstimate: data.audienceSizeEstimate,
                    imageUrl: data.imageUrl,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return this.mapPodcast(result);
    }

    /**
     * Bulk upsert for backward compatibility
     */
    static async bulkUpsert(data: PodcastIngestionInput[]): Promise<number> {
        let count = 0;

        // Process in batches of 100
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);

            await db
                .insert(podcasts)
                .values(batch.map(p => ({
                    externalSource: p.externalSource,
                    externalId: p.externalId,
                    title: p.title,
                    description: p.description,
                    categories: p.categories,
                    language: p.language,
                    hostName: p.hostName,
                    contactEmail: p.contactEmail,
                    websiteUrl: p.website,
                    audienceSizeEstimate: p.audienceSizeEstimate,
                    imageUrl: p.imageUrl,
                })))
                .onConflictDoUpdate({
                    target: [podcasts.externalSource, podcasts.externalId],
                    set: {
                        title: sql`excluded.title`,
                        description: sql`excluded.description`,
                        categories: sql`excluded.categories`,
                        language: sql`excluded.language`,
                        hostName: sql`excluded.host_name`,
                        contactEmail: sql`excluded.contact_email`,
                        websiteUrl: sql`excluded.website_url`,
                        audienceSizeEstimate: sql`excluded.audience_size_estimate`,
                        imageUrl: sql`excluded.image_url`,
                        updatedAt: new Date(),
                    },
                });

            count += batch.length;
        }

        return count;
    }

    /**
     * Map database podcast to API type
     */
    private static mapPodcast(p: typeof podcasts.$inferSelect): Podcast {
        return {
            id: p.id,
            externalSource: p.externalSource,
            externalId: p.externalId,
            title: p.title,
            description: p.description,
            categories: p.categories,
            language: p.language,
            hostName: p.hostName,
            contactEmail: p.contactEmail,
            website: p.websiteUrl,
            audienceSizeEstimate: p.audienceSizeEstimate,
            imageUrl: p.imageUrl,
            // Activity tracking fields
            latestEpisodePubDate: p.latestEpisodePubDate,
            totalEpisodes: p.totalEpisodes,
            listenScore: p.listenScore,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        };
    }
}
