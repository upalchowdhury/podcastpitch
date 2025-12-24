/**
 * Quick test script for Podcast Index API authentication
 * Run with: cd backend && npx tsx src/scripts/test-podcastindex-auth.ts
 */
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const apiKey = process.env.PODCAST_INDEX_API_KEY;
const apiSecret = process.env.PODCAST_INDEX_API_SECRET;

console.log('🔑 Testing Podcast Index API Authentication\n');
console.log('API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : '❌ NOT SET');
console.log('API Secret:', apiSecret ? `${apiSecret.substring(0, 8)}...` : '❌ NOT SET');

if (!apiKey || !apiSecret) {
    console.error('\n❌ Missing PODCAST_INDEX_API_KEY or PODCAST_INDEX_API_SECRET in .env');
    process.exit(1);
}

async function testAuth() {
    const authDate = Math.floor(Date.now() / 1000).toString();
    const authString = apiKey + apiSecret + authDate;
    const authHash = crypto.createHash('sha1').update(authString).digest('hex');

    console.log('\n📡 Making test request to /podcasts/trending...');
    console.log('X-Auth-Date:', authDate);
    console.log('Authorization hash:', authHash.substring(0, 16) + '...');

    const response = await fetch('https://api.podcastindex.org/api/1.0/podcasts/trending?max=5', {
        method: 'GET',
        headers: {
            'User-Agent': 'PodcastPitch/1.0',
            'X-Auth-Date': authDate,
            'X-Auth-Key': apiKey!,
            'Authorization': authHash,
        },
    });

    console.log('\nResponse Status:', response.status, response.statusText);

    if (response.ok) {
        const data = await response.json();
        console.log('✅ SUCCESS! Found', data.count, 'trending podcasts');
        console.log('\nSample podcasts:');
        data.feeds?.slice(0, 3).forEach((feed: any) => {
            console.log(`  - ${feed.title}`);
        });
    } else {
        const text = await response.text();
        console.error('❌ FAILED:', text);
    }
}

testAuth().catch(console.error);
