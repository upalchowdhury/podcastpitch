/**
 * Topic Aggregation Job
 * 
 * Populates podcast_topics table from:
 * 1. Listen Notes genre_ids → topics mapping
 * 2. Episode topics → podcast topics (recency-weighted aggregation)
 * 
 * Run with: npx tsx src/scripts/topic-aggregation-job.ts
 */

import { db, pool } from '../db/index.js';
import {
    podcasts,
    podcastTopics,
    topics,
    genreTopicMapping,
    podcastEpisodes,
    episodeTopics
} from '../db/schema.js';
import { eq, sql, desc, and, inArray } from 'drizzle-orm';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    // Maximum podcasts to process per run (for batching)
    batchSize: 500,
    // Minimum weight to store (skip very weak associations)
    minWeight: 0.1,
    // Recency decay factor (episodes older than this get reduced weight)
    recencyDecayDays: 180,
    // Maximum topics per podcast
    maxTopicsPerPodcast: 10,
};

// =============================================================================
// GENRE MAPPING AGGREGATION
// =============================================================================

/**
 * Map Listen Notes genre_ids to topics for all podcasts
 */
async function aggregateFromGenres(): Promise<number> {
    console.log('📊 Aggregating topics from Listen Notes genres...');

    // Get all genre → topic mappings
    const mappings = await db
        .select({
            genreId: genreTopicMapping.genreId,
            topicId: genreTopicMapping.topicId,
        })
        .from(genreTopicMapping);

    if (mappings.length === 0) {
        console.log('  ⚠️  No genre mappings found. Run seed-topics.ts first.');
        return 0;
    }

    console.log(`  Found ${mappings.length} genre→topic mappings`);

    // Build a lookup map
    const genreToTopic = new Map<number, string>();
    for (const m of mappings) {
        genreToTopic.set(m.genreId, m.topicId);
    }

    // Get all podcasts with genre_ids
    const podcastsWithGenres = await db
        .select({
            id: podcasts.id,
            genreIds: podcasts.genreIds,
        })
        .from(podcasts)
        .where(sql`${podcasts.genreIds} IS NOT NULL AND jsonb_array_length(${podcasts.genreIds}) > 0`);

    console.log(`  Found ${podcastsWithGenres.length} podcasts with genre_ids`);

    let upsertCount = 0;

    for (const podcast of podcastsWithGenres) {
        const genreIds = podcast.genreIds as number[] | null;
        if (!genreIds || genreIds.length === 0) continue;

        for (const genreId of genreIds) {
            const topicId = genreToTopic.get(genreId);
            if (!topicId) continue;

            try {
                await db
                    .insert(podcastTopics)
                    .values({
                        podcastId: podcast.id,
                        topicId,
                        weight: 0.7, // Medium-high confidence from API category
                        source: 'category_map',
                        evidenceCount: 1,
                    })
                    .onConflictDoUpdate({
                        target: [podcastTopics.podcastId, podcastTopics.topicId],
                        set: {
                            // Only update if new source is equal or better
                            weight: sql`GREATEST(${podcastTopics.weight}, 0.7)`,
                            updatedAt: new Date(),
                        },
                    });
                upsertCount++;
            } catch (error) {
                // Ignore duplicate key errors
            }
        }
    }

    console.log(`  ✅ Upserted ${upsertCount} podcast-topic associations from genres`);
    return upsertCount;
}

// =============================================================================
// EPISODE-BASED AGGREGATION
// =============================================================================

/**
 * Aggregate episode topics into podcast topics with recency weighting
 */
async function aggregateFromEpisodes(): Promise<number> {
    console.log('\n📊 Aggregating topics from episodes...');

    const now = Date.now();
    const decayMs = CONFIG.recencyDecayDays * 24 * 60 * 60 * 1000;

    // Get podcasts that have episode_topics
    const podcastsWithEpisodeTopics = await db
        .select({
            podcastId: podcastEpisodes.podcastId,
        })
        .from(episodeTopics)
        .innerJoin(podcastEpisodes, eq(episodeTopics.episodeId, podcastEpisodes.id))
        .groupBy(podcastEpisodes.podcastId);

    console.log(`  Found ${podcastsWithEpisodeTopics.length} podcasts with episode topics`);

    if (podcastsWithEpisodeTopics.length === 0) {
        console.log('  ⚠️  No episode topics found. Topic tagging from episodes not yet implemented.');
        return 0;
    }

    let upsertCount = 0;

    for (const { podcastId } of podcastsWithEpisodeTopics) {
        // Get all episode topics for this podcast with episode dates
        const episodeData = await db
            .select({
                topicId: episodeTopics.topicId,
                weight: episodeTopics.weight,
                publishedAt: podcastEpisodes.publishedAt,
            })
            .from(episodeTopics)
            .innerJoin(podcastEpisodes, eq(episodeTopics.episodeId, podcastEpisodes.id))
            .where(eq(podcastEpisodes.podcastId, podcastId));

        // Aggregate by topic with recency weighting
        const topicScores = new Map<string, { totalWeight: number; count: number }>();

        for (const ep of episodeData) {
            // Calculate recency decay
            let recencyMultiplier = 1.0;
            if (ep.publishedAt) {
                const ageMs = now - ep.publishedAt.getTime();
                if (ageMs > decayMs) {
                    recencyMultiplier = Math.max(0.3, 1.0 - (ageMs - decayMs) / decayMs);
                }
            }

            const weightedScore = ep.weight * recencyMultiplier;
            const existing = topicScores.get(ep.topicId);
            if (existing) {
                existing.totalWeight += weightedScore;
                existing.count++;
            } else {
                topicScores.set(ep.topicId, { totalWeight: weightedScore, count: 1 });
            }
        }

        // Normalize and upsert top topics
        const sortedTopics = Array.from(topicScores.entries())
            .map(([topicId, data]) => ({
                topicId,
                weight: Math.min(1.0, data.totalWeight / Math.max(1, data.count)),
                evidenceCount: data.count,
            }))
            .filter(t => t.weight >= CONFIG.minWeight)
            .sort((a, b) => b.weight - a.weight)
            .slice(0, CONFIG.maxTopicsPerPodcast);

        for (const topicData of sortedTopics) {
            try {
                await db
                    .insert(podcastTopics)
                    .values({
                        podcastId,
                        topicId: topicData.topicId,
                        weight: topicData.weight,
                        source: 'episode_inferred',
                        evidenceCount: topicData.evidenceCount,
                    })
                    .onConflictDoUpdate({
                        target: [podcastTopics.podcastId, podcastTopics.topicId],
                        set: {
                            // Prefer episode inference over category mapping
                            weight: sql`CASE 
                                WHEN ${podcastTopics.source} = 'episode_inferred' 
                                THEN GREATEST(${podcastTopics.weight}, ${topicData.weight})
                                ELSE ${topicData.weight}
                            END`,
                            source: 'episode_inferred',
                            evidenceCount: topicData.evidenceCount,
                            updatedAt: new Date(),
                        },
                    });
                upsertCount++;
            } catch (error) {
                console.error(`  Error upserting topic for podcast ${podcastId}:`, error);
            }
        }
    }

    console.log(`  ✅ Upserted ${upsertCount} podcast-topic associations from episodes`);
    return upsertCount;
}

// =============================================================================
// STATISTICS
// =============================================================================

async function showStats(): Promise<void> {
    const [topicCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(podcastTopics);

    const [podcastCount] = await db
        .select({ count: sql<number>`count(DISTINCT podcast_id)::int` })
        .from(podcastTopics);

    const topTopics = await db
        .select({
            displayName: topics.displayName,
            count: sql<number>`count(*)::int`,
            avgWeight: sql<number>`avg(${podcastTopics.weight})::real`,
        })
        .from(podcastTopics)
        .innerJoin(topics, eq(podcastTopics.topicId, topics.id))
        .groupBy(topics.displayName)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

    console.log('\n📊 Topic Aggregation Statistics:');
    console.log(`   Total podcast-topic associations: ${topicCount?.count || 0}`);
    console.log(`   Unique podcasts with topics: ${podcastCount?.count || 0}`);
    console.log('\n   Top 10 Topics:');
    for (const t of topTopics) {
        console.log(`     - ${t.displayName}: ${t.count} podcasts (avg weight: ${t.avgWeight?.toFixed(2)})`);
    }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
    console.log('🚀 Topic Aggregation Job Started\n');
    const startTime = Date.now();

    try {
        // Step 1: Aggregate from genres
        const genreCount = await aggregateFromGenres();

        // Step 2: Aggregate from episodes
        const episodeCount = await aggregateFromEpisodes();

        // Show statistics
        await showStats();

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✨ Job completed in ${duration}s`);
        console.log(`   Genre mappings: ${genreCount}`);
        console.log(`   Episode inferences: ${episodeCount}`);
    } catch (error) {
        console.error('❌ Error in topic aggregation:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
