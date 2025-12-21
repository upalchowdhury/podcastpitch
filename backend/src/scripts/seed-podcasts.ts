import { db } from '../db/index.js';
import { podcasts, ingestionRuns } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import samplePodcasts from '../data/sample-podcasts.json' assert { type: 'json' };

interface PodcastImport {
    externalSource: string;
    externalId: string;
    title: string;
    description: string;
    categories: string[];
    language: string;
    hostName?: string;
    contactEmail?: string;
    rssUrl?: string;
    websiteUrl?: string;
    audienceSizeEstimate?: number;
}

async function seedPodcasts() {
    console.log('🌱 Starting podcast seed...');
    console.log(`📦 Found ${samplePodcasts.length} podcasts to import`);

    const startTime = new Date();
    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    for (const podcast of samplePodcasts as PodcastImport[]) {
        try {
            // Check if podcast already exists
            const existing = await db.query.podcasts.findFirst({
                where: and(
                    eq(podcasts.externalSource, podcast.externalSource),
                    eq(podcasts.externalId, podcast.externalId)
                ),
            });

            if (existing) {
                // Update existing podcast
                await db
                    .update(podcasts)
                    .set({
                        title: podcast.title,
                        description: podcast.description,
                        categories: podcast.categories,
                        language: podcast.language,
                        hostName: podcast.hostName || existing.hostName,
                        contactEmail: podcast.contactEmail || existing.contactEmail,
                        rssUrl: podcast.rssUrl || existing.rssUrl,
                        websiteUrl: podcast.websiteUrl || existing.websiteUrl,
                        audienceSizeEstimate: podcast.audienceSizeEstimate || existing.audienceSizeEstimate,
                        contactSource: podcast.contactEmail ? 'dataset' : existing.contactSource,
                        contactConfidence: podcast.contactEmail ? 85 : existing.contactConfidence,
                        updatedAt: new Date(),
                    })
                    .where(eq(podcasts.id, existing.id));
                updatedCount++;
                console.log(`📝 Updated: ${podcast.title}`);
            } else {
                // Insert new podcast
                await db.insert(podcasts).values({
                    externalSource: podcast.externalSource,
                    externalId: podcast.externalId,
                    title: podcast.title,
                    description: podcast.description,
                    categories: podcast.categories,
                    language: podcast.language,
                    hostName: podcast.hostName || null,
                    contactEmail: podcast.contactEmail || null,
                    rssUrl: podcast.rssUrl || null,
                    websiteUrl: podcast.websiteUrl || null,
                    audienceSizeEstimate: podcast.audienceSizeEstimate || null,
                    contactSource: podcast.contactEmail ? 'dataset' : 'dataset',
                    contactConfidence: podcast.contactEmail ? 85 : 0,
                    feedStatus: 'not_started',
                    contactEnrichStatus: 'not_started',
                });
                insertedCount++;
                console.log(`✅ Inserted: ${podcast.title}`);
            }
        } catch (error) {
            failedCount++;
            console.error(`❌ Failed: ${podcast.title}`, error);
        }
    }

    const finishedTime = new Date();

    // Record ingestion run
    await db.insert(ingestionRuns).values({
        source: 'sample-seed',
        startedAt: startTime,
        finishedAt: finishedTime,
        insertedCount,
        updatedCount,
        failedCount,
        notes: {
            totalProcessed: samplePodcasts.length,
            durationMs: finishedTime.getTime() - startTime.getTime(),
        },
    });

    console.log('\n📊 Seed Summary:');
    console.log(`   Inserted: ${insertedCount}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`   Duration: ${finishedTime.getTime() - startTime.getTime()}ms`);
    console.log('\n✨ Seed complete!');

    process.exit(0);
}

seedPodcasts().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
});
