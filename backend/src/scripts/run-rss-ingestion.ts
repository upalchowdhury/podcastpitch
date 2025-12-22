import { RSSIngestionService } from '../services/rssIngestion.service.js';

async function runRSSIngestion() {
    console.log('📡 Starting RSS Feed Ingestion...');

    // Get podcasts that need RSS refresh
    const podcastIds = await RSSIngestionService.getPodcastsNeedingRefresh(100);
    console.log(`Found ${podcastIds.length} podcasts needing RSS refresh`);

    if (podcastIds.length === 0) {
        console.log('No podcasts need RSS refresh. Done!');
        process.exit(0);
    }

    // Process in batches
    const results = await RSSIngestionService.batchFetch(podcastIds, 5);

    // Summarize results
    const stats = {
        ok: results.filter(r => r.status === 'ok').length,
        notModified: results.filter(r => r.status === 'not_modified').length,
        failed: results.filter(r => r.status === 'failed').length,
        blocked: results.filter(r => r.status === 'blocked').length,
        totalEpisodes: results.reduce((sum, r) => sum + (r.episodesAdded || 0), 0),
    };

    console.log('\n📊 RSS Ingestion Summary:');
    console.log(`   Successful: ${stats.ok}`);
    console.log(`   Not Modified (304): ${stats.notModified}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Blocked: ${stats.blocked}`);
    console.log(`   Episodes Added: ${stats.totalEpisodes}`);
    console.log('\n✨ RSS ingestion complete!');

    process.exit(0);
}

runRSSIngestion().catch((error) => {
    console.error('RSS ingestion failed:', error);
    process.exit(1);
});
