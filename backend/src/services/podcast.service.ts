import { eq, and, sql, ilike, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { podcasts } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import type {
    Podcast,
    PodcastSearchParams,
    PodcastSearchResult,
    PodcastIngestionInput
} from '@podcast-pitch/shared';

export class PodcastService {
    static async search(params: PodcastSearchParams): Promise<PodcastSearchResult> {
        const {
            query,
            categories,
            language,
            minAudienceSize,
            maxAudienceSize,
            page = 1,
            limit = 20
        } = params;

        const offset = (page - 1) * limit;
        const conditions = [];

        // Text search
        if (query) {
            conditions.push(
                sql`(
          ${podcasts.title} ILIKE ${'%' + query + '%'} OR 
          ${podcasts.description} ILIKE ${'%' + query + '%'} OR
          ${podcasts.hostName} ILIKE ${'%' + query + '%'}
        )`
            );
        }

        // Category filter
        if (categories && categories.length > 0) {
            conditions.push(
                sql`${podcasts.categories} ?| array[${sql.raw(categories.map(c => `'${c}'`).join(','))}]`
            );
        }

        // Language filter
        if (language) {
            conditions.push(eq(podcasts.language, language));
        }

        // Audience size filters
        if (minAudienceSize !== undefined) {
            conditions.push(sql`${podcasts.audienceSizeEstimate} >= ${minAudienceSize}`);
        }
        if (maxAudienceSize !== undefined) {
            conditions.push(sql`${podcasts.audienceSizeEstimate} <= ${maxAudienceSize}`);
        }

        const whereClause = conditions.length > 0
            ? and(...conditions)
            : undefined;

        // Get total count
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(podcasts)
            .where(whereClause);

        // Get paginated results
        const results = await db
            .select()
            .from(podcasts)
            .where(whereClause)
            .orderBy(sql`${podcasts.audienceSizeEstimate} DESC NULLS LAST`)
            .limit(limit)
            .offset(offset);

        return {
            podcasts: results.map(this.mapPodcast),
            total: count,
            page,
            limit,
            hasMore: offset + results.length < count,
        };
    }

    static async getById(id: string): Promise<Podcast> {
        const podcast = await db.query.podcasts.findFirst({
            where: eq(podcasts.id, id),
        });

        if (!podcast) {
            throw new NotFoundError('Podcast');
        }

        return this.mapPodcast(podcast);
    }

    static async upsert(data: PodcastIngestionInput): Promise<Podcast> {
        const [result] = await db
            .insert(podcasts)
            .values({
                externalSource: data.externalSource,
                externalId: data.externalId,
                title: data.title,
                description: data.description,
                categories: data.categories,
                language: data.language,
                hostName: data.hostName,
                contactEmail: data.contactEmail,
                websiteUrl: data.website,
                audienceSizeEstimate: data.audienceSizeEstimate,
                imageUrl: data.imageUrl,
            })
            .onConflictDoUpdate({
                target: [podcasts.externalSource, podcasts.externalId],
                set: {
                    title: data.title,
                    description: data.description,
                    categories: data.categories,
                    language: data.language,
                    hostName: data.hostName,
                    contactEmail: data.contactEmail,
                    websiteUrl: data.website,
                    audienceSizeEstimate: data.audienceSizeEstimate,
                    imageUrl: data.imageUrl,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return this.mapPodcast(result);
    }

    static async bulkUpsert(data: PodcastIngestionInput[]): Promise<number> {
        let count = 0;

        // Process in batches of 100
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);

            await db
                .insert(podcasts)
                .values(batch.map(p => ({
                    externalSource: p.externalSource,
                    externalId: p.externalId,
                    title: p.title,
                    description: p.description,
                    categories: p.categories,
                    language: p.language,
                    hostName: p.hostName,
                    contactEmail: p.contactEmail,
                    websiteUrl: p.website,
                    audienceSizeEstimate: p.audienceSizeEstimate,
                    imageUrl: p.imageUrl,
                })))
                .onConflictDoUpdate({
                    target: [podcasts.externalSource, podcasts.externalId],
                    set: {
                        title: sql`excluded.title`,
                        description: sql`excluded.description`,
                        categories: sql`excluded.categories`,
                        language: sql`excluded.language`,
                        hostName: sql`excluded.host_name`,
                        contactEmail: sql`excluded.contact_email`,
                        websiteUrl: sql`excluded.website_url`,
                        audienceSizeEstimate: sql`excluded.audience_size_estimate`,
                        imageUrl: sql`excluded.image_url`,
                        updatedAt: new Date(),
                    },
                });

            count += batch.length;
        }

        return count;
    }

    private static mapPodcast(p: typeof podcasts.$inferSelect): Podcast {
        return {
            id: p.id,
            externalSource: p.externalSource,
            externalId: p.externalId,
            title: p.title,
            description: p.description,
            categories: p.categories,
            language: p.language,
            hostName: p.hostName,
            contactEmail: p.contactEmail,
            website: p.websiteUrl,
            audienceSizeEstimate: p.audienceSizeEstimate,
            imageUrl: p.imageUrl,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        };
    }
}
