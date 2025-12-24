import { db } from '../src/db/index.js';
import { sendJobs } from '../src/db/schema.js';
import { desc } from 'drizzle-orm';

async function check() {
    const jobs = await db
        .select({
            id: sendJobs.id,
            recipientEmail: sendJobs.recipientEmail,
            status: sendJobs.status
        })
        .from(sendJobs)
        .orderBy(desc(sendJobs.createdAt))
        .limit(5);
    console.log('Jobs:', JSON.stringify(jobs, null, 2));
}

check().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
