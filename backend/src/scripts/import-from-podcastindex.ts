import { db } from '../db/index.js';
import { podcasts, ingestionRuns } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { PodcastIndexClient, PodcastIndexPodcast } from '../services/podcastIndex.client.js';

const CATEGORIES_TO_IMPORT = [
    'technology',
    'business',
    'entrepreneurship',
    'marketing',
    'self-improvement',
    'health',
    'finance',
    'science',
    'education',
    'comedy',
    'news',
    'sports',
    'music',
    'society',
    'culture',
];

async function importFromPodcastIndex() {
    // Debug: Check if API credentials are available
    const apiKey = process.env.PODCAST_INDEX_API_KEY;
    const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
    console.log('🔑 API Key present:', apiKey ? `Yes (${apiKey.substring(0, 4)}...)` : 'NO - MISSING!');
    console.log('🔐 API Secret present:', apiSecret ? `Yes (${apiSecret.substring(0, 4)}...)` : 'NO - MISSING!');

    if (!apiKey || !apiSecret) {
        console.error('❌ FATAL: Podcast Index API credentials not configured!');
        console.error('Please set PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET environment variables');
        process.exit(1);
    }

    const client = new PodcastIndexClient();

    console.log('🎙️ Starting Podcast Index import...');

    const startTime = new Date();
    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const allPodcasts: PodcastIndexPodcast[] = [];

    // First, get trending podcasts
    console.log('\n📈 Fetching trending podcasts...');
    try {
        const trending = await client.getTrending(100);
        console.log(`   Found ${trending.length} trending podcasts`);
        allPodcasts.push(...trending);
    } catch (error) {
        console.error('❌ Error fetching trending:', error);
    }

    // Then search by each category
    for (const category of CATEGORIES_TO_IMPORT) {
        console.log(`\n🔍 Searching category: ${category}...`);
        try {
            const results = await client.searchByCategory(category, 50);
            console.log(`   Found ${results.length} podcasts for "${category}"`);
            allPodcasts.push(...results);

            // Rate limiting: wait 200ms between requests
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`❌ Error searching ${category}:`, error);
        }
    }

    // Deduplicate by externalId
    const uniquePodcasts = new Map<string, PodcastIndexPodcast>();
    for (const podcast of allPodcasts) {
        if (!uniquePodcasts.has(podcast.externalId)) {
            uniquePodcasts.set(podcast.externalId, podcast);
        }
    }

    console.log(`\n📦 Total unique podcasts to import: ${uniquePodcasts.size}`);

    // Import each podcast
    for (const podcast of uniquePodcasts.values()) {
        try {
            // Check if podcast exists
            const existing = await db.query.podcasts.findFirst({
                where: and(
                    eq(podcasts.externalSource, podcast.externalSource),
                    eq(podcasts.externalId, podcast.externalId)
                ),
            });

            if (existing) {
                // Update existing
                await db
                    .update(podcasts)
                    .set({
                        title: podcast.title,
                        description: podcast.description,
                        categories: podcast.categories,
                        language: podcast.language,
                        hostName: podcast.hostName || existing.hostName,
                        rssUrl: podcast.rssUrl || existing.rssUrl,
                        websiteUrl: podcast.websiteUrl || existing.websiteUrl,
                        imageUrl: podcast.imageUrl || existing.imageUrl,
                        audienceSizeEstimate: podcast.audienceSizeEstimate || existing.audienceSizeEstimate,
                        updatedAt: new Date(),
                    })
                    .where(eq(podcasts.id, existing.id));
                updatedCount++;
            } else {
                // Insert new
                await db.insert(podcasts).values({
                    externalSource: podcast.externalSource,
                    externalId: podcast.externalId,
                    title: podcast.title,
                    description: podcast.description,
                    categories: podcast.categories,
                    language: podcast.language,
                    hostName: podcast.hostName,
                    contactEmail: podcast.contactEmail,
                    rssUrl: podcast.rssUrl,
                    websiteUrl: podcast.websiteUrl,
                    imageUrl: podcast.imageUrl,
                    audienceSizeEstimate: podcast.audienceSizeEstimate,
                    contactSource: 'dataset',
                    contactConfidence: 0,
                    feedStatus: 'not_started',
                    contactEnrichStatus: 'not_started',
                });
                insertedCount++;
            }
        } catch (error) {
            failedCount++;
            console.error(`❌ Failed to import: ${podcast.title}`, error);
        }
    }

    const finishedTime = new Date();

    // Record ingestion run
    await db.insert(ingestionRuns).values({
        source: 'podcastindex',
        startedAt: startTime,
        finishedAt: finishedTime,
        insertedCount,
        updatedCount,
        failedCount,
        notes: {
            totalProcessed: uniquePodcasts.size,
            categoriesSearched: CATEGORIES_TO_IMPORT,
            durationMs: finishedTime.getTime() - startTime.getTime(),
        },
    });

    console.log('\n📊 Import Summary:');
    console.log(`   Inserted: ${insertedCount}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`   Duration: ${finishedTime.getTime() - startTime.getTime()}ms`);
    console.log('\n✨ Import complete!');

    process.exit(0);
}

importFromPodcastIndex().catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
});
