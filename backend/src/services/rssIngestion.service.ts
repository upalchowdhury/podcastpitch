import { db } from '../db/index.js';
import { podcasts, podcastEpisodes } from '../db/schema.js';
import { eq, and, or, lt, isNull, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

interface RSSChannel {
    title?: string;
    description?: string;
    link?: string;
    language?: string;
    'itunes:author'?: string;
    'itunes:email'?: string;
    'itunes:owner'?: { 'itunes:email'?: string; 'itunes:name'?: string };
    image?: { url?: string };
    'itunes:image'?: { $?: { href?: string } };
    item?: RSSItem[];
}

interface RSSItem {
    title?: string;
    description?: string;
    guid?: string | { _?: string };
    pubDate?: string;
    link?: string;
    enclosure?: { $?: { url?: string } };
}

interface FetchResult {
    podcastId: string;
    success: boolean;
    status: 'ok' | 'not_modified' | 'failed' | 'blocked';
    episodesAdded?: number;
    error?: string;
}

export class RSSIngestionService {
    private static readonly MAX_EPISODES = 20;

    /**
     * Fetch and process RSS feed for a single podcast
     */
    static async fetchFeed(podcastId: string): Promise<FetchResult> {
        try {
            const podcast = await db.query.podcasts.findFirst({
                where: eq(podcasts.id, podcastId),
            });

            if (!podcast || !podcast.rssUrl) {
                return { podcastId, success: false, status: 'failed', error: 'Podcast or RSS URL not found' };
            }

            // Fetch RSS feed
            const headers: Record<string, string> = {
                'User-Agent': 'PodcastPitchBot/1.0 (contact: support@podcastpitch.com)',
            };

            // Add conditional headers if we have etag/last-modified
            if (podcast.feedEtag) {
                headers['If-None-Match'] = podcast.feedEtag;
            }
            if (podcast.feedLastModified) {
                headers['If-Modified-Since'] = podcast.feedLastModified;
            }

            const response = await fetch(podcast.rssUrl, {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(30000), // 30 second timeout
            });

            // Handle 304 Not Modified
            if (response.status === 304) {
                await db
                    .update(podcasts)
                    .set({
                        feedLastFetchedAt: new Date(),
                        feedStatus: 'not_modified',
                    })
                    .where(eq(podcasts.id, podcastId));
                return { podcastId, success: true, status: 'not_modified' };
            }

            // Handle blocked (403, 429)
            if (response.status === 403 || response.status === 429) {
                await db
                    .update(podcasts)
                    .set({
                        feedLastFetchedAt: new Date(),
                        feedStatus: 'blocked',
                        lastError: `HTTP ${response.status}`,
                    })
                    .where(eq(podcasts.id, podcastId));
                return { podcastId, success: false, status: 'blocked', error: `HTTP ${response.status}` };
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const xmlText = await response.text();
            const channel = await this.parseRSS(xmlText);

            if (!channel) {
                throw new Error('Failed to parse RSS feed');
            }

            // Extract and update podcast metadata
            const updateData: Record<string, unknown> = {
                feedLastFetchedAt: new Date(),
                feedStatus: 'ok',
                lastError: null,
            };

            // Save etag and last-modified for future requests
            const etag = response.headers.get('etag');
            const lastModified = response.headers.get('last-modified');
            if (etag) updateData.feedEtag = etag;
            if (lastModified) updateData.feedLastModified = lastModified;

            // Update missing fields from RSS
            if (!podcast.websiteUrl && channel.link) {
                updateData.websiteUrl = channel.link;
            }
            if (!podcast.hostName && (channel['itunes:author'] || channel['itunes:owner']?.['itunes:name'])) {
                updateData.hostName = channel['itunes:author'] || channel['itunes:owner']?.['itunes:name'];
            }
            if (!podcast.imageUrl) {
                const imageUrl = channel['itunes:image']?.$?.href || channel.image?.url;
                if (imageUrl) updateData.imageUrl = imageUrl;
            }

            // Check for contact email in feed
            const feedEmail = channel['itunes:owner']?.['itunes:email'] || channel['itunes:email'];
            if (feedEmail && (!podcast.contactEmail || podcast.contactConfidence < 70)) {
                updateData.contactEmail = feedEmail;
                updateData.contactSource = 'rss';
                updateData.contactConfidence = 75;
            }

            await db.update(podcasts).set(updateData).where(eq(podcasts.id, podcastId));

            // Upsert episodes
            const episodesAdded = await this.upsertEpisodes(podcastId, channel.item || []);

            return { podcastId, success: true, status: 'ok', episodesAdded };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ podcastId, error: errorMessage }, 'RSS fetch failed');

            await db
                .update(podcasts)
                .set({
                    feedLastFetchedAt: new Date(),
                    feedStatus: 'failed',
                    lastError: errorMessage,
                })
                .where(eq(podcasts.id, podcastId));

            return { podcastId, success: false, status: 'failed', error: errorMessage };
        }
    }

    /**
     * Get podcasts that need RSS refresh
     */
    static async getPodcastsNeedingRefresh(limit = 100): Promise<string[]> {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const results = await db
            .select({ id: podcasts.id })
            .from(podcasts)
            .where(
                and(
                    sql`${podcasts.rssUrl} IS NOT NULL`,
                    or(
                        isNull(podcasts.feedLastFetchedAt),
                        lt(podcasts.feedLastFetchedAt, oneDayAgo)
                    ),
                    sql`${podcasts.feedStatus} != 'blocked'`
                )
            )
            .limit(limit);

        return results.map(r => r.id);
    }

    /**
     * Batch process multiple podcasts
     */
    static async batchFetch(podcastIds: string[], concurrency = 5): Promise<FetchResult[]> {
        const results: FetchResult[] = [];

        for (let i = 0; i < podcastIds.length; i += concurrency) {
            const batch = podcastIds.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                batch.map(id => this.fetchFeed(id))
            );
            results.push(...batchResults);

            // Rate limiting: wait 1 second between batches
            if (i + concurrency < podcastIds.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return results;
    }

    private static async parseRSS(xmlText: string): Promise<RSSChannel | null> {
        try {
            // Simple XML parsing using regex (no external dep needed for basic RSS)
            const channel: RSSChannel = {};

            // Extract channel info
            const channelMatch = xmlText.match(/<channel>([\s\S]*)<\/channel>/);
            if (!channelMatch) return null;
            const channelXml = channelMatch[1];

            // Title
            const titleMatch = channelXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
            if (titleMatch) channel.title = this.decodeHtml(titleMatch[1]);

            // Description
            const descMatch = channelXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
            if (descMatch) channel.description = this.decodeHtml(descMatch[1]);

            // Link
            const linkMatch = channelXml.match(/<link>([^<]*)<\/link>/);
            if (linkMatch) channel.link = linkMatch[1].trim();

            // Language
            const langMatch = channelXml.match(/<language>([^<]*)<\/language>/);
            if (langMatch) channel.language = langMatch[1];

            // iTunes author
            const authorMatch = channelXml.match(/<itunes:author>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/itunes:author>/);
            if (authorMatch) channel['itunes:author'] = this.decodeHtml(authorMatch[1]);

            // iTunes owner email
            const ownerMatch = channelXml.match(/<itunes:owner>[\s\S]*?<itunes:email>([^<]*)<\/itunes:email>[\s\S]*?<\/itunes:owner>/);
            if (ownerMatch) {
                channel['itunes:owner'] = { 'itunes:email': ownerMatch[1] };
            }

            // iTunes image
            const itunesImgMatch = channelXml.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/);
            if (itunesImgMatch) {
                channel['itunes:image'] = { $: { href: itunesImgMatch[1] } };
            }

            // Parse items (episodes)
            const items: RSSItem[] = [];
            const itemRegex = /<item>([\s\S]*?)<\/item>/g;
            let itemMatch;
            let count = 0;

            while ((itemMatch = itemRegex.exec(channelXml)) !== null && count < this.MAX_EPISODES) {
                const itemXml = itemMatch[1];
                const item: RSSItem = {};

                const itemTitleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
                if (itemTitleMatch) item.title = this.decodeHtml(itemTitleMatch[1]);

                const itemDescMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
                if (itemDescMatch) item.description = this.decodeHtml(itemDescMatch[1]).substring(0, 500);

                const guidMatch = itemXml.match(/<guid[^>]*>([^<]*)<\/guid>/);
                if (guidMatch) item.guid = guidMatch[1];

                const pubDateMatch = itemXml.match(/<pubDate>([^<]*)<\/pubDate>/);
                if (pubDateMatch) item.pubDate = pubDateMatch[1];

                const enclosureMatch = itemXml.match(/<enclosure[^>]*url="([^"]*)"[^>]*\/?>/);
                if (enclosureMatch) item.enclosure = { $: { url: enclosureMatch[1] } };

                items.push(item);
                count++;
            }

            channel.item = items;
            return channel;
        } catch (error) {
            logger.error({ error }, 'RSS parse error');
            return null;
        }
    }

    private static decodeHtml(html: string): string {
        return html
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/<[^>]*>/g, '') // Strip HTML tags
            .trim();
    }

    private static async upsertEpisodes(podcastId: string, items: RSSItem[]): Promise<number> {
        let added = 0;

        for (const item of items) {
            if (!item.guid && !item.title) continue;

            const guid = typeof item.guid === 'string' ? item.guid : item.guid?._ || item.title || '';

            try {
                // Check if episode exists
                const existing = await db.query.podcastEpisodes.findFirst({
                    where: and(
                        eq(podcastEpisodes.podcastId, podcastId),
                        eq(podcastEpisodes.guid, guid.substring(0, 500))
                    ),
                });

                if (!existing) {
                    await db.insert(podcastEpisodes).values({
                        podcastId,
                        guid: guid.substring(0, 500),
                        title: (item.title || 'Untitled').substring(0, 500),
                        description: item.description?.substring(0, 5000) || null,
                        url: item.enclosure?.$?.url?.substring(0, 1000) || null,
                        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
                    });
                    added++;
                }
            } catch (error) {
                // Skip duplicate errors
                logger.debug({ error, guid }, 'Episode upsert skipped');
            }
        }

        return added;
    }
}
