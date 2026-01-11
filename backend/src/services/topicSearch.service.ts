/**
 * Topic Search Service
 * 
 * Provides topic normalization, alias resolution, and topic-based candidate retrieval
 * for the enhanced podcast search.
 */

import { db } from '../db/index.js';
import { topics, topicAliases, podcastTopics, podcasts } from '../db/schema.js';
import { eq, sql, or, ilike, desc, and, inArray } from 'drizzle-orm';

// =============================================================================
// TYPES
// =============================================================================

export interface ResolvedTopic {
    id: string;
    slug: string;
    displayName: string;
    matchedVia: 'exact' | 'alias' | 'trigram' | 'fts';
    similarity?: number;
}

export interface QueryIntent {
    type: 'topic' | 'name' | 'mixed';
    confidence: number;
}

export interface TopicSearchResult {
    podcastId: string;
    topicId: string;
    topicDisplayName: string;
    weight: number;
    evidenceCount: number;
}

// =============================================================================
// QUERY NORMALIZATION
// =============================================================================

/**
 * Normalize a search query for consistent matching
 */
export function normalizeQuery(query: string): string {
    return query
        .toLowerCase()
        .trim()
        // Remove common punctuation
        .replace(/[.,!?;:'"]/g, '')
        // Normalize multiple spaces
        .replace(/\s+/g, ' ')
        // Remove common articles
        .replace(/\b(the|a|an)\b/g, '')
        .trim();
}

/**
 * Detect if query looks like a person's name vs a topic
 */
export function detectQueryIntent(query: string): QueryIntent {
    const normalized = normalizeQuery(query);
    const words = normalized.split(' ').filter(w => w.length > 0);

    // Single short word is likely a topic abbreviation (AI, ML, SEO)
    if (words.length === 1 && words[0].length <= 4) {
        return { type: 'topic', confidence: 0.8 };
    }

    // Check for name patterns (2-3 capitalized words, common name patterns)
    const namePatterns = [
        /^[A-Z][a-z]+ [A-Z][a-z]+$/,  // "John Smith"
        /^[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+$/,  // "John A. Smith"
        /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/,  // "John Adam Smith"
    ];

    // Check original (non-normalized) query for name patterns
    for (const pattern of namePatterns) {
        if (pattern.test(query.trim())) {
            return { type: 'name', confidence: 0.9 };
        }
    }

    // Multiple words with spaces - could be either
    if (words.length >= 2) {
        // Check if it matches known topic patterns
        const topicIndicators = [
            'learning', 'intelligence', 'science', 'engineering',
            'development', 'marketing', 'management', 'health',
            'business', 'technology', 'security', 'design',
        ];

        for (const word of words) {
            if (topicIndicators.includes(word)) {
                return { type: 'topic', confidence: 0.7 };
            }
        }

        return { type: 'mixed', confidence: 0.5 };
    }

    // Default to topic search
    return { type: 'topic', confidence: 0.6 };
}

// =============================================================================
// TOPIC RESOLUTION
// =============================================================================

/**
 * Resolve a query to canonical topic IDs using exact match, alias, and trigram
 */
export async function resolveTopics(query: string): Promise<ResolvedTopic[]> {
    const normalized = normalizeQuery(query);
    const results: ResolvedTopic[] = [];

    // 1. Exact slug match
    const exactMatch = await db
        .select({
            id: topics.id,
            slug: topics.slug,
            displayName: topics.displayName,
        })
        .from(topics)
        .where(eq(topics.slug, normalized.replace(/\s+/g, '-')))
        .limit(1);

    if (exactMatch.length > 0) {
        results.push({
            ...exactMatch[0],
            matchedVia: 'exact',
            similarity: 1.0,
        });
    }

    // 2. Alias match (exact)
    const aliasMatch = await db
        .select({
            id: topics.id,
            slug: topics.slug,
            displayName: topics.displayName,
        })
        .from(topicAliases)
        .innerJoin(topics, eq(topicAliases.topicId, topics.id))
        .where(eq(topicAliases.alias, normalized))
        .limit(5);

    for (const match of aliasMatch) {
        if (!results.find(r => r.id === match.id)) {
            results.push({
                ...match,
                matchedVia: 'alias',
                similarity: 1.0,
            });
        }
    }

    // 3. Trigram similarity on display name and aliases (for typos)
    if (results.length === 0 || normalized.length > 3) {
        const trigramThreshold = 0.3;

        // Topic display name trigram search
        const displayNameMatches = await db
            .select({
                id: topics.id,
                slug: topics.slug,
                displayName: topics.displayName,
                similarity: sql<number>`similarity(${topics.displayName}, ${normalized})`,
            })
            .from(topics)
            .where(sql`similarity(${topics.displayName}, ${normalized}) > ${trigramThreshold}`)
            .orderBy(sql`similarity(${topics.displayName}, ${normalized}) DESC`)
            .limit(5);

        for (const match of displayNameMatches) {
            if (!results.find(r => r.id === match.id)) {
                results.push({
                    id: match.id,
                    slug: match.slug,
                    displayName: match.displayName,
                    matchedVia: 'trigram',
                    similarity: match.similarity,
                });
            }
        }

        // Alias trigram search
        const aliasTrigramMatches = await db
            .select({
                id: topics.id,
                slug: topics.slug,
                displayName: topics.displayName,
                similarity: sql<number>`similarity(${topicAliases.alias}, ${normalized})`,
            })
            .from(topicAliases)
            .innerJoin(topics, eq(topicAliases.topicId, topics.id))
            .where(sql`similarity(${topicAliases.alias}, ${normalized}) > ${trigramThreshold}`)
            .orderBy(sql`similarity(${topicAliases.alias}, ${normalized}) DESC`)
            .limit(5);

        for (const match of aliasTrigramMatches) {
            if (!results.find(r => r.id === match.id)) {
                results.push({
                    id: match.id,
                    slug: match.slug,
                    displayName: match.displayName,
                    matchedVia: 'trigram',
                    similarity: match.similarity,
                });
            }
        }
    }

    // 4. FTS on topic display name (word matching)
    if (results.length < 3 && normalized.split(' ').length > 1) {
        const ftsQuery = normalized.split(' ').join(' & ');

        const ftsMatches = await db
            .select({
                id: topics.id,
                slug: topics.slug,
                displayName: topics.displayName,
            })
            .from(topics)
            .where(sql`search_tsv @@ to_tsquery('english', ${ftsQuery})`)
            .limit(5);

        for (const match of ftsMatches) {
            if (!results.find(r => r.id === match.id)) {
                results.push({
                    ...match,
                    matchedVia: 'fts',
                    similarity: 0.8,
                });
            }
        }
    }

    return results;
}

// =============================================================================
// PODCAST RETRIEVAL BY TOPIC
// =============================================================================

/**
 * Get podcasts that match the given topic IDs, ordered by weight
 */
export async function getPodcastsByTopics(
    topicIds: string[],
    options: {
        limit?: number;
        offset?: number;
        minWeight?: number;
    } = {}
): Promise<TopicSearchResult[]> {
    const { limit = 50, offset = 0, minWeight = 0.1 } = options;

    if (topicIds.length === 0) {
        return [];
    }

    const results = await db
        .select({
            podcastId: podcastTopics.podcastId,
            topicId: podcastTopics.topicId,
            topicDisplayName: topics.displayName,
            weight: podcastTopics.weight,
            evidenceCount: podcastTopics.evidenceCount,
        })
        .from(podcastTopics)
        .innerJoin(topics, eq(podcastTopics.topicId, topics.id))
        .where(
            and(
                inArray(podcastTopics.topicId, topicIds),
                sql`${podcastTopics.weight} >= ${minWeight}`
            )
        )
        .orderBy(desc(podcastTopics.weight))
        .limit(limit)
        .offset(offset);

    return results;
}

/**
 * Get topic information for evidence display ("why matched")
 */
export async function getTopicsForPodcast(podcastId: string): Promise<{
    topicId: string;
    displayName: string;
    weight: number;
    evidenceCount: number;
}[]> {
    const results = await db
        .select({
            topicId: podcastTopics.topicId,
            displayName: topics.displayName,
            weight: podcastTopics.weight,
            evidenceCount: podcastTopics.evidenceCount,
        })
        .from(podcastTopics)
        .innerJoin(topics, eq(podcastTopics.topicId, topics.id))
        .where(eq(podcastTopics.podcastId, podcastId))
        .orderBy(desc(podcastTopics.weight));

    return results;
}

// =============================================================================
// FTS SEARCH
// =============================================================================

/**
 * Full-text search on podcasts
 */
export async function searchPodcastsFTS(
    query: string,
    options: {
        limit?: number;
        offset?: number;
    } = {}
): Promise<{
    id: string;
    title: string;
    rank: number;
}[]> {
    const { limit = 50, offset = 0 } = options;
    const normalized = normalizeQuery(query);

    // Convert to tsquery format
    const words = normalized.split(' ').filter(w => w.length >= 2);
    if (words.length === 0) {
        return [];
    }

    // Use prefix matching for partial words
    const tsQuery = words.map(w => `${w}:*`).join(' & ');

    const results = await db
        .select({
            id: podcasts.id,
            title: podcasts.title,
            rank: sql<number>`ts_rank(search_tsv, to_tsquery('english', ${tsQuery}))`,
        })
        .from(podcasts)
        .where(sql`search_tsv @@ to_tsquery('english', ${tsQuery})`)
        .orderBy(sql`ts_rank(search_tsv, to_tsquery('english', ${tsQuery})) DESC`)
        .limit(limit)
        .offset(offset);

    return results;
}

// =============================================================================
// TRIGRAM SEARCH (Name matching)
// =============================================================================

/**
 * Trigram similarity search for names/titles
 */
export async function searchPodcastsTrigramName(
    query: string,
    options: {
        limit?: number;
        minSimilarity?: number;
    } = {}
): Promise<{
    id: string;
    title: string;
    hostName: string | null;
    publisher: string | null;
    similarity: number;
    matchField: 'title' | 'host_name' | 'publisher';
}[]> {
    const { limit = 20, minSimilarity = 0.3 } = options;
    const normalized = normalizeQuery(query);

    // Search title
    const titleMatches = await db
        .select({
            id: podcasts.id,
            title: podcasts.title,
            hostName: podcasts.hostName,
            publisher: podcasts.publisher,
            similarity: sql<number>`similarity(${podcasts.title}, ${normalized})`,
        })
        .from(podcasts)
        .where(sql`similarity(${podcasts.title}, ${normalized}) > ${minSimilarity}`)
        .orderBy(sql`similarity(${podcasts.title}, ${normalized}) DESC`)
        .limit(limit);

    // Search host name
    const hostMatches = await db
        .select({
            id: podcasts.id,
            title: podcasts.title,
            hostName: podcasts.hostName,
            publisher: podcasts.publisher,
            similarity: sql<number>`similarity(${podcasts.hostName}, ${normalized})`,
        })
        .from(podcasts)
        .where(sql`similarity(${podcasts.hostName}, ${normalized}) > ${minSimilarity}`)
        .orderBy(sql`similarity(${podcasts.hostName}, ${normalized}) DESC`)
        .limit(limit);

    // Search publisher
    const publisherMatches = await db
        .select({
            id: podcasts.id,
            title: podcasts.title,
            hostName: podcasts.hostName,
            publisher: podcasts.publisher,
            similarity: sql<number>`similarity(${podcasts.publisher}, ${normalized})`,
        })
        .from(podcasts)
        .where(sql`similarity(${podcasts.publisher}, ${normalized}) > ${minSimilarity}`)
        .orderBy(sql`similarity(${podcasts.publisher}, ${normalized}) DESC`)
        .limit(limit);

    // Combine and dedupe
    const seen = new Set<string>();
    const results: {
        id: string;
        title: string;
        hostName: string | null;
        publisher: string | null;
        similarity: number;
        matchField: 'title' | 'host_name' | 'publisher';
    }[] = [];

    for (const match of titleMatches) {
        if (!seen.has(match.id)) {
            seen.add(match.id);
            results.push({ ...match, matchField: 'title' });
        }
    }

    for (const match of hostMatches) {
        if (!seen.has(match.id)) {
            seen.add(match.id);
            results.push({ ...match, matchField: 'host_name' });
        }
    }

    for (const match of publisherMatches) {
        if (!seen.has(match.id)) {
            seen.add(match.id);
            results.push({ ...match, matchField: 'publisher' });
        }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
}
