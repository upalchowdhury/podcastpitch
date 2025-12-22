import { ContactEnrichmentService } from '../services/contactEnrichment.service.js';

async function runContactEnrichment() {
    console.log('🔍 Starting Contact Email Enrichment...');

    // Get podcasts that need contact enrichment
    const podcastIds = await ContactEnrichmentService.getPodcastsNeedingEnrichment(50);
    console.log(`Found ${podcastIds.length} podcasts needing contact enrichment`);

    if (podcastIds.length === 0) {
        console.log('No podcasts need contact enrichment. Done!');
        process.exit(0);
    }

    // Process slowly to be respectful
    const results = await ContactEnrichmentService.batchEnrich(podcastIds, 1);

    // Summarize results
    const stats = {
        found: results.filter(r => r.status === 'found').length,
        notFound: results.filter(r => r.status === 'not_found').length,
        failed: results.filter(r => r.status === 'failed').length,
        blocked: results.filter(r => r.status === 'blocked').length,
    };

    console.log('\n📊 Contact Enrichment Summary:');
    console.log(`   Emails Found: ${stats.found}`);
    console.log(`   Not Found: ${stats.notFound}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Blocked: ${stats.blocked}`);

    // Show found emails
    const found = results.filter(r => r.status === 'found' && r.email);
    if (found.length > 0) {
        console.log('\n📧 Emails discovered:');
        found.forEach(r => {
            console.log(`   ${r.email} (confidence: ${r.confidence})`);
        });
    }

    console.log('\n✨ Contact enrichment complete!');

    process.exit(0);
}

runContactEnrichment().catch((error) => {
    console.error('Contact enrichment failed:', error);
    process.exit(1);
});
