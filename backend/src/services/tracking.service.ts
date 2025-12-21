import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sendJobs, sendEvents } from '../db/schema.js';
import { logger } from '../utils/logger.js';

export class TrackingService {
    static async recordOpen(sendJobId: string): Promise<void> {
        try {
            // Verify job exists
            const job = await db.query.sendJobs.findFirst({
                where: eq(sendJobs.id, sendJobId),
            });

            if (!job) {
                logger.warn({ sendJobId }, 'Open tracking: job not found');
                return;
            }

            // Record open event
            await db.insert(sendEvents).values({
                sendJobId,
                eventType: 'opened',
                metadata: {
                    recordedAt: new Date().toISOString(),
                },
            });

            logger.info({ sendJobId }, 'Open tracked');
        } catch (error) {
            logger.error({ sendJobId, error }, 'Failed to record open');
        }
    }

    static async recordClick(
        sendJobId: string,
        url: string
    ): Promise<void> {
        try {
            // Record click event
            await db.insert(sendEvents).values({
                sendJobId,
                eventType: 'clicked',
                metadata: {
                    url,
                    recordedAt: new Date().toISOString(),
                },
            });

            logger.info({ sendJobId, url }, 'Click tracked');
        } catch (error) {
            logger.error({ sendJobId, url, error }, 'Failed to record click');
        }
    }
}
