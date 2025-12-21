import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { targetLists, targetListItems, podcasts } from '../db/schema.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';
import type { TargetList, TargetListWithCount, Podcast } from '@podcast-pitch/shared';

export class TargetListService {
    static async getUserLists(userId: string): Promise<TargetListWithCount[]> {
        const lists = await db.query.targetLists.findMany({
            where: eq(targetLists.userId, userId),
            orderBy: (targetLists, { desc }) => [desc(targetLists.createdAt)],
        });

        // Get counts for each list
        const counts = await db
            .select({
                listId: targetListItems.listId,
                count: sql<number>`count(*)::int`,
            })
            .from(targetListItems)
            .where(inArray(targetListItems.listId, lists.map(l => l.id)))
            .groupBy(targetListItems.listId);

        const countMap = new Map(counts.map(c => [c.listId, c.count]));

        return lists.map(list => ({
            id: list.id,
            userId: list.userId,
            name: list.name,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
            podcastCount: countMap.get(list.id) || 0,
        }));
    }

    static async create(userId: string, name: string): Promise<TargetList> {
        const [list] = await db
            .insert(targetLists)
            .values({ userId, name })
            .returning();

        return {
            id: list.id,
            userId: list.userId,
            name: list.name,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
        };
    }

    static async update(
        userId: string,
        listId: string,
        name: string
    ): Promise<TargetList> {
        const list = await this.getListWithOwnerCheck(userId, listId);

        const [updated] = await db
            .update(targetLists)
            .set({ name, updatedAt: new Date() })
            .where(eq(targetLists.id, listId))
            .returning();

        return {
            id: updated.id,
            userId: updated.userId,
            name: updated.name,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
        };
    }

    static async delete(userId: string, listId: string): Promise<void> {
        await this.getListWithOwnerCheck(userId, listId);
        await db.delete(targetLists).where(eq(targetLists.id, listId));
    }

    static async getListPodcasts(
        userId: string,
        listId: string
    ): Promise<Podcast[]> {
        await this.getListWithOwnerCheck(userId, listId);

        const items = await db
            .select({
                podcast: podcasts,
                addedAt: targetListItems.addedAt,
            })
            .from(targetListItems)
            .innerJoin(podcasts, eq(targetListItems.podcastId, podcasts.id))
            .where(eq(targetListItems.listId, listId))
            .orderBy(targetListItems.addedAt);

        return items.map(item => ({
            id: item.podcast.id,
            externalSource: item.podcast.externalSource,
            externalId: item.podcast.externalId,
            title: item.podcast.title,
            description: item.podcast.description,
            categories: item.podcast.categories,
            language: item.podcast.language,
            hostName: item.podcast.hostName,
            contactEmail: item.podcast.contactEmail,
            website: item.podcast.websiteUrl,
            audienceSizeEstimate: item.podcast.audienceSizeEstimate,
            imageUrl: item.podcast.imageUrl,
            createdAt: item.podcast.createdAt,
            updatedAt: item.podcast.updatedAt,
        }));
    }

    static async addPodcasts(
        userId: string,
        listId: string,
        podcastIds: string[]
    ): Promise<number> {
        await this.getListWithOwnerCheck(userId, listId);

        // Filter out duplicates
        const existing = await db
            .select({ podcastId: targetListItems.podcastId })
            .from(targetListItems)
            .where(
                and(
                    eq(targetListItems.listId, listId),
                    inArray(targetListItems.podcastId, podcastIds)
                )
            );

        const existingIds = new Set(existing.map(e => e.podcastId));
        const newIds = podcastIds.filter(id => !existingIds.has(id));

        if (newIds.length === 0) {
            return 0;
        }

        await db.insert(targetListItems).values(
            newIds.map(podcastId => ({
                listId,
                podcastId,
            }))
        );

        return newIds.length;
    }

    static async removePodcast(
        userId: string,
        listId: string,
        podcastId: string
    ): Promise<void> {
        await this.getListWithOwnerCheck(userId, listId);

        await db
            .delete(targetListItems)
            .where(
                and(
                    eq(targetListItems.listId, listId),
                    eq(targetListItems.podcastId, podcastId)
                )
            );
    }

    private static async getListWithOwnerCheck(
        userId: string,
        listId: string
    ): Promise<TargetList> {
        const list = await db.query.targetLists.findFirst({
            where: eq(targetLists.id, listId),
        });

        if (!list) {
            throw new NotFoundError('Target list');
        }

        if (list.userId !== userId) {
            throw new ForbiddenError('Not authorized to access this list');
        }

        return {
            id: list.id,
            userId: list.userId,
            name: list.name,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
        };
    }
}
