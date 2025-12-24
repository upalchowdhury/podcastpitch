import { db } from '../src/db/index.js';
import { sendJobs, pitches } from '../src/db/schema.js';
import { sql, eq, or } from 'drizzle-orm';

async function cleanup() {
    console.log('Deleting all send jobs...');
    await db.delete(sendJobs).where(sql`1=1`);
    console.log('✓ Send jobs deleted');

    console.log('Resetting pitch statuses...');
    await db.update(pitches)
        .set({ status: 'ready' })
        .where(or(
            eq(pitches.status, 'scheduled'),
            eq(pitches.status, 'sent'),
            eq(pitches.status, 'failed')
        ));
    console.log('✓ Pitch statuses reset');

    console.log('Done!');
    process.exit(0);
}

cleanup().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
