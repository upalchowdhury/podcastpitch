/**
 * Test script for podcast search functionality
 * 
 * Run with: npx ts-node src/scripts/test-search.ts
 */

import { db } from '../db';
import { podcasts } from '../db/schema';
import { sql, eq, desc, and, or, ilike } from 'drizzle-orm';

// Test queries that should return relevant results
const TEST_QUERIES = [
    { query: 'ai', expected: ['artificial intelligence', 'AI', 'machine learning'] },
    { query: 'ai infra', expected: ['AI', 'infrastructure'] },
    { query: 'machine learning', expected: ['machine learning', 'ML', 'data science'] },
    { query: 'entrepreneurship', expected: ['entrepreneur', 'business', 'startup'] },
    { query: 'health fitness', expected: ['health', 'fitness', 'workout'] },
];

// Words that should NOT match when searching for 'ai'
const FALSE_POSITIVE_WORDS = ['trail', 'train', 'brain', 'maintain', 'certain', 'captain'];

async function testSearch(query: string): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing search: "${query}"`);
    console.log('='.repeat(60));

    // Parse query into words
    const words = query
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length >= 2)
        .map(word => word.replace(/[^a-z0-9]/g, ''))
        .filter(word => word.length >= 2)
        .slice(0, 5);

    console.log(`\nWords to search: [${words.join(', ')}]`);

    // Build the full-text search query
    const tsQuery = words.map(w => `${w}:*`).join(' | ');
    console.log(`Full-text query: ${tsQuery}`);

    // Build regex patterns for word boundaries
    const regexPatterns = words.map(w => `(^|[^a-z])${w}([^a-z]|$)`);
    console.log(`Regex patterns: ${regexPatterns.join(', ')}`);

    try {
        // Test full-text search
        console.log('\n--- Full-Text Search Results ---');
        const ftsResults = await db
            .select({
                id: podcasts.id,
                title: podcasts.title,
                description: sql<string>`LEFT(${podcasts.description}, 100)`,
            })
            .from(podcasts)
            .where(
                or(
                    sql`to_tsvector('english', COALESCE(${podcasts.title}, '')) @@ to_tsquery('english', ${tsQuery})`,
                    sql`to_tsvector('english', COALESCE(${podcasts.description}, '')) @@ to_tsquery('english', ${tsQuery})`
                )
            )
            .orderBy(desc(podcasts.listenScore))
            .limit(10);

        console.log(`Found ${ftsResults.length} results via full-text search`);
        ftsResults.forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.title}`);
        });

        // Test regex search for title
        console.log('\n--- Regex Search Results (Title only) ---');
        const regexConditions = words.map(w =>
            sql`${podcasts.title} ~* ${`(^|[^a-z])${w}([^a-z]|$)`}`
        );

        const regexResults = await db
            .select({
                id: podcasts.id,
                title: podcasts.title,
            })
            .from(podcasts)
            .where(or(...regexConditions))
            .orderBy(desc(podcasts.listenScore))
            .limit(10);

        console.log(`Found ${regexResults.length} results via regex search`);
        regexResults.forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.title}`);
        });

        // Verify no false positives for 'ai'
        if (query === 'ai') {
            console.log('\n--- Checking for False Positives ---');
            for (const falseWord of FALSE_POSITIVE_WORDS) {
                const badResults = await db
                    .select({ count: sql<number>`count(*)::int` })
                    .from(podcasts)
                    .where(
                        and(
                            ilike(podcasts.title, `%${falseWord}%`),
                            or(
                                sql`to_tsvector('english', ${podcasts.title}) @@ to_tsquery('english', 'ai:*')`,
                                sql`${podcasts.title} ~* '(^|[^a-z])ai([^a-z]|$)'`
                            )
                        )
                    );

                const count = badResults[0]?.count || 0;
                if (count > 0) {
                    console.log(`  ⚠️ Found ${count} podcast(s) with "${falseWord}" matching AI search`);
                } else {
                    console.log(`  ✅ No false positives for "${falseWord}"`);
                }
            }
        }

    } catch (error) {
        console.error(`Error testing search:`, error);
    }
}

async function testDatabaseContent(): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Database Content Summary');
    console.log('='.repeat(60));

    // Count total podcasts
    const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(podcasts);
    console.log(`\nTotal podcasts in database: ${total}`);

    // Count by source
    const sources = await db
        .select({
            source: podcasts.externalSource,
            count: sql<number>`count(*)::int`,
        })
        .from(podcasts)
        .groupBy(podcasts.externalSource);
    console.log('\nBy source:');
    sources.forEach(s => console.log(`  - ${s.source}: ${s.count}`));

    // Sample of recent podcasts
    console.log('\n5 Most Recent Podcasts:');
    const recent = await db
        .select({
            title: podcasts.title,
            source: podcasts.externalSource,
            lastSeenAt: podcasts.lastSeenAt,
        })
        .from(podcasts)
        .orderBy(desc(podcasts.lastSeenAt))
        .limit(5);
    recent.forEach((p, i) => {
        console.log(`  ${i + 1}. [${p.source}] ${p.title} (seen: ${p.lastSeenAt?.toISOString()})`);
    });

    // Sample podcasts with 'AI' in title
    console.log('\nPodcasts with "AI" in title:');
    const aiPodcasts = await db
        .select({
            title: podcasts.title,
            listenScore: podcasts.listenScore,
        })
        .from(podcasts)
        .where(sql`${podcasts.title} ~* '(^|[^a-z])ai([^a-z]|$)'`)
        .orderBy(desc(podcasts.listenScore))
        .limit(10);

    if (aiPodcasts.length === 0) {
        console.log('  No podcasts found with AI in title');
    } else {
        aiPodcasts.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.title} (score: ${p.listenScore})`);
        });
    }
}

async function main() {
    console.log('🔍 Podcast Search Test Suite\n');

    // Test database content first
    await testDatabaseContent();

    // Run search tests
    for (const test of TEST_QUERIES) {
        await testSearch(test.query);
    }

    console.log('\n✅ Tests completed!');
    process.exit(0);
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
