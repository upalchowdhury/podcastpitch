import { eq, and, sql, desc, or, ilike, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { podcasts, podcastSources } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { config } from '../config/index.js';
import { listenNotesClient, type ListenNotesPodcast } from './listenNotes.client.js';
import { expandSearchQuery, isLikelyAbbreviation } from '../utils/searchSynonyms.js';
import type {
    Podcast,
    PodcastSearchParams,
    PodcastSearchResult,
    PodcastIngestionInput
} from '@podcast-pitch/shared';

// =============================================================================
// EXTENDED TYPES FOR HYBRID SEARCH
// =============================================================================

export interface HybridSearchResult extends PodcastSearchResult {
    sourceBreakdown: {
        local: number;
        listenNotes: number;
    };
    nextOffset?: number;
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

        // Smart text search with flexible matching
        // Strategy: Use substring matching (ilike) for flexibility, but let Listen Notes
        // handle the heavy lifting for relevance. Local search is a fallback/cache.
        if (query) {
            // Expand abbreviations like "ai" -> ["ai", "artificial intelligence", ...]
            const expandedTerms = isLikelyAbbreviation(query)
                ? [query, ...expandSearchQuery(query)]
                : [query];

            const allWordConditions: ReturnType<typeof or>[] = [];

            for (const term of expandedTerms) {
                // Split query into words
                const words = term
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(word => word.length >= 2)
                    .slice(0, 5);

                if (words.length > 0) {
                    // Create condition for each word - use flexible substring matching
                    // Relevance ranking is handled by ORDER BY listen_score
                    for (const word of words) {
                        allWordConditions.push(
                            or(
                                ilike(podcasts.title, `%${word}%`),
                                ilike(podcasts.description, `%${word}%`),
                                ilike(podcasts.publisher, `%${word}%`),
                                ilike(podcasts.hostName, `%${word}%`)
                            )
                        );
                    }
                }
            }

            // Match if ANY word/term is found (OR between all conditions)
            // This gives maximum coverage - relevant podcasts will rank higher by listen_score
            if (allWordConditions.length > 0) {
                conditions.push(or(...allWordConditions));
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

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(podcasts)
            .where(whereClause);

        // Get paginated results, ordered by listen_score, then last_seen_at
        const results = await db
            .select()
            .from(podcasts)
            .where(whereClause)
            .orderBy(
                desc(podcasts.listenScore),
                desc(podcasts.lastSeenAt),
                desc(podcasts.audienceSizeEstimate)
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
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        };
    }
}
