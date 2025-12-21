import { eq, sql, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
    pitches,
    sendJobs,
    responses,
    sendEvents
} from '../db/schema.js';

interface DashboardStats {
    totalPitches: number;
    sentPitches: number;
    openedPitches: number;
    responseRate: number;
    responsesByStatus: {
        interested: number;
        declined: number;
        booked: number;
        noResponse: number;
    };
}

interface ActivityItem {
    type: 'pitch_created' | 'email_sent' | 'email_opened' | 'response_updated';
    timestamp: Date;
    details: Record<string, unknown>;
}

export class DashboardService {
    static async getStats(userId: string): Promise<DashboardStats> {
        // Total pitches
        const [pitchCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(pitches)
            .where(eq(pitches.userId, userId));

        // Sent pitches
        const [sentCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(pitches)
            .where(and(eq(pitches.userId, userId), eq(pitches.status, 'sent')));

        // Opened pitches
        const [openedCount] = await db
            .select({ count: sql<number>`count(DISTINCT ${sendJobs.pitchId})::int` })
            .from(sendEvents)
            .innerJoin(sendJobs, eq(sendEvents.sendJobId, sendJobs.id))
            .innerJoin(pitches, eq(sendJobs.pitchId, pitches.id))
            .where(
                and(
                    eq(pitches.userId, userId),
                    eq(sendEvents.eventType, 'opened')
                )
            );

        // Response counts by status
        const responseCounts = await db
            .select({
                status: responses.status,
                count: sql<number>`count(*)::int`,
            })
            .from(responses)
            .innerJoin(pitches, eq(responses.pitchId, pitches.id))
            .where(eq(pitches.userId, userId))
            .groupBy(responses.status);

        const responsesByStatus = {
            interested: 0,
            declined: 0,
            booked: 0,
            noResponse: 0,
        };

        for (const r of responseCounts) {
            switch (r.status) {
                case 'interested':
                    responsesByStatus.interested = r.count;
                    break;
                case 'declined':
                    responsesByStatus.declined = r.count;
                    break;
                case 'booked':
                    responsesByStatus.booked = r.count;
                    break;
                case 'no_response':
                    responsesByStatus.noResponse = r.count;
                    break;
            }
        }

        const totalResponses = responsesByStatus.interested +
            responsesByStatus.declined +
            responsesByStatus.booked;

        const responseRate = sentCount.count > 0
            ? (totalResponses / sentCount.count) * 100
            : 0;

        return {
            totalPitches: pitchCount.count,
            sentPitches: sentCount.count,
            openedPitches: openedCount.count,
            responseRate: Math.round(responseRate * 10) / 10,
            responsesByStatus,
        };
    }

    static async getRecentActivity(
        userId: string,
        limit: number = 20
    ): Promise<ActivityItem[]> {
        // Get recent pitch creations
        const recentPitches = await db
            .select({
                id: pitches.id,
                createdAt: pitches.createdAt,
                podcastId: pitches.podcastId,
            })
            .from(pitches)
            .where(eq(pitches.userId, userId))
            .orderBy(sql`${pitches.createdAt} DESC`)
            .limit(limit);

        // Get recent send events
        const recentEvents = await db
            .select({
                eventType: sendEvents.eventType,
                timestamp: sendEvents.timestamp,
                pitchId: sendJobs.pitchId,
            })
            .from(sendEvents)
            .innerJoin(sendJobs, eq(sendEvents.sendJobId, sendJobs.id))
            .innerJoin(pitches, eq(sendJobs.pitchId, pitches.id))
            .where(eq(pitches.userId, userId))
            .orderBy(sql`${sendEvents.timestamp} DESC`)
            .limit(limit);

        const activities: ActivityItem[] = [];

        for (const pitch of recentPitches) {
            activities.push({
                type: 'pitch_created',
                timestamp: pitch.createdAt,
                details: { pitchId: pitch.id, podcastId: pitch.podcastId },
            });
        }

        for (const event of recentEvents) {
            let type: ActivityItem['type'];
            switch (event.eventType) {
                case 'sent':
                    type = 'email_sent';
                    break;
                case 'opened':
                    type = 'email_opened';
                    break;
                default:
                    continue;
            }

            activities.push({
                type,
                timestamp: event.timestamp,
                details: { pitchId: event.pitchId },
            });
        }

        // Sort by timestamp descending
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return activities.slice(0, limit);
    }
}
