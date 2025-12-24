import crypto from 'crypto';

interface PodcastIndexFeed {
    id: number;
    podcastGuid: string;
    title: string;
    url: string;
    originalUrl: string;
    link: string;
    description: string;
    author: string;
    ownerName: string;
    image: string;
    artwork: string;
    lastUpdateTime: number;
    categories: Record<string, string>;
    language: string;
    explicit: boolean;
    episodeCount: number;
    itunesId: number | null;
}

interface SearchResponse {
    status: string;
    feeds: PodcastIndexFeed[];
    count: number;
    query: string;
    description: string;
}

interface TrendingResponse {
    status: string;
    feeds: PodcastIndexFeed[];
    count: number;
    max: number;
    since: number;
    description: string;
}

export interface PodcastIndexPodcast {
    externalId: string;
    externalSource: 'podcastindex';
    title: string;
    description: string;
    categories: string[];
    language: string;
    hostName: string | null;
    contactEmail: string | null;
    rssUrl: string;
    websiteUrl: string | null;
    imageUrl: string | null;
    audienceSizeEstimate: number | null;
}

export class PodcastIndexClient {
    private baseUrl = 'https://api.podcastindex.org/api/1.0';
    private userAgent = 'PodcastPitch/1.0';

    constructor() {
        // Credentials are read at request time from process.env, not at construction
    }

    private getCredentials(): { apiKey: string; apiSecret: string } {
        // TEMPORARY HARDCODE FOR DEBUGGING - REVERT AFTER TESTING
        const apiKey = 'TJWZJKN9PQ98VUGKAKQJ';
        const apiSecret = 'MqGbXtmNMXtwdqkjS6Be^DhS';

        console.log('🔑 Using hardcoded credentials for debugging');
        console.log('   API Key length:', apiKey.length);
        console.log('   API Secret length:', apiSecret.length);

        return { apiKey, apiSecret };
    }

    private getAuthHeaders(): Record<string, string> {
        const { apiKey, apiSecret } = this.getCredentials();
        const authDate = Math.floor(Date.now() / 1000).toString();
        const authString = apiKey + apiSecret + authDate;
        const authHash = crypto.createHash('sha1').update(authString).digest('hex');

        return {
            'User-Agent': this.userAgent,
            'X-Auth-Date': authDate,
            'X-Auth-Key': apiKey,
            'Authorization': authHash,
        };
    }

    private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Podcast Index API error: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Search podcasts by term
     */
    async search(query: string, limit = 100): Promise<PodcastIndexPodcast[]> {
        const response = await this.request<SearchResponse>('/search/byterm', {
            q: query,
            max: limit.toString(),
            clean: 'true',
        });

        return response.feeds.map(this.mapFeed);
    }

    /**
     * Get trending podcasts
     */
    async getTrending(limit = 100, lang = 'en'): Promise<PodcastIndexPodcast[]> {
        const response = await this.request<TrendingResponse>('/podcasts/trending', {
            max: limit.toString(),
            lang,
        });

        return response.feeds.map(this.mapFeed);
    }

    /**
     * Search by category
     */
    async searchByCategory(category: string, limit = 100): Promise<PodcastIndexPodcast[]> {
        const response = await this.request<SearchResponse>('/search/byterm', {
            q: category,
            max: limit.toString(),
            clean: 'true',
        });

        return response.feeds.map(this.mapFeed);
    }

    /**
     * Get recently updated podcasts
     */
    async getRecent(limit = 100): Promise<PodcastIndexPodcast[]> {
        const response = await this.request<{ feeds: PodcastIndexFeed[]; count: number }>('/recent/feeds', {
            max: limit.toString(),
            lang: 'en',
        });

        return response.feeds.map(this.mapFeed);
    }

    private mapFeed(feed: PodcastIndexFeed): PodcastIndexPodcast {
        // Extract categories from the categories object
        const categories = feed.categories
            ? Object.values(feed.categories)
            : [];

        // Estimate audience based on episode count (rough heuristic)
        const audienceEstimate = feed.episodeCount
            ? Math.min(feed.episodeCount * 1000, 500000)
            : null;

        return {
            externalId: feed.id.toString(),
            externalSource: 'podcastindex',
            title: feed.title || 'Untitled Podcast',
            description: feed.description || '',
            categories,
            language: feed.language || 'en',
            hostName: feed.author || feed.ownerName || null,
            contactEmail: null, // Will be enriched later via RSS/website
            rssUrl: feed.url,
            websiteUrl: feed.link || null,
            imageUrl: feed.artwork || feed.image || null,
            audienceSizeEstimate: audienceEstimate,
        };
    }
}

export const podcastIndexClient = new PodcastIndexClient();
