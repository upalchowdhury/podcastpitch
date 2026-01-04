import { config } from '../config/index.js';

// =============================================================================
// LISTEN NOTES API TYPES
// =============================================================================

export interface ListenNotesSearchResult {
    id: string;
    title_original: string;
    description_original: string;
    publisher_original: string;
    website: string | null;
    email: string | null;  // PRO plan only
    rss: string | null;    // PRO plan only
    image: string | null;
    thumbnail: string | null;
    language: string;
    country: string;
    genre_ids: number[];
    listen_score: number | null;
    listen_score_global_rank: string | null;
    explicit_content: boolean;
    total_episodes: number;
    latest_episode_id: string | null;
    latest_pub_date_ms: number | null;
}

export interface ListenNotesSearchResponse {
    took: number;
    count: number;
    total: number;
    results: ListenNotesSearchResult[];
    next_offset: number;
}

export interface ListenNotesPodcastDetail {
    id: string;
    title: string;
    description: string;
    publisher: string;
    website: string | null;
    email: string | null;
    rss: string | null;
    image: string | null;
    language: string;
    country: string;
    genre_ids: number[];
    listen_score: number | null;
    listen_score_global_rank: string | null;
    explicit_content: boolean;
    total_episodes: number;
    is_claimed: boolean;
    type: string;
    episodes: ListenNotesEpisode[];
    next_episode_pub_date: number | null;
}

export interface ListenNotesEpisode {
    id: string;
    title: string;
    description: string;
    pub_date_ms: number;
    audio: string;
    audio_length_sec: number;
    link: string;
    image: string | null;
    explicit_content: boolean;
}

// =============================================================================
// MAPPED PODCAST TYPE (for local storage)
// =============================================================================

export interface ListenNotesPodcast {
    externalId: string;
    externalSource: 'listen_notes';
    title: string;
    description: string;
    publisher: string | null;
    categories: string[];
    language: string;
    country: string | null;
    hostName: string | null;
    contactEmail: string | null;
    rssUrl: string | null;
    websiteUrl: string | null;
    imageUrl: string | null;
    genreIds: number[];
    listenScore: number | null;
    listenScoreGlobalRank: string | null;
    explicitContent: boolean | null;
    hasGuestInterviews: boolean | null;
    hasSponsors: boolean | null;
    audienceSizeEstimate: number | null;
    // Raw payload for provenance
    rawPayload: Record<string, unknown>;
}

// =============================================================================
// LISTEN NOTES CLIENT
// =============================================================================

export class ListenNotesClient {
    private baseUrl: string;
    private apiKey: string;

    constructor() {
        this.baseUrl = config.listenNotes.baseUrl;
        this.apiKey = config.listenNotes.apiKey;
    }

    private getHeaders(): Record<string, string> {
        return {
            'X-ListenAPI-Key': this.apiKey,
            'Content-Type': 'application/json',
        };
    }

    private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, value);
            }
        });

        const startTime = Date.now();

        console.log(`🎧 Listen Notes API: ${endpoint}`, { params });

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: this.getHeaders(),
        });

        const latency = Date.now() - startTime;

        // Log usage headers for quota tracking
        const usageHeaders = {
            'x-listenapi-usage': response.headers.get('x-listenapi-usage'),
            'x-listenapi-nextbillingdate': response.headers.get('x-listenapi-nextbillingdate'),
        };

        console.log(`🎧 Listen Notes API Response:`, {
            endpoint,
            status: response.status,
            latency: `${latency}ms`,
            ...usageHeaders,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Listen Notes API error:', errorText);

            if (response.status === 429) {
                throw new Error('Listen Notes API rate limit exceeded');
            }

            throw new Error(`Listen Notes API error: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Check if API key is configured
     */
    isConfigured(): boolean {
        return Boolean(this.apiKey && this.apiKey.trim().length > 0);
    }

    /**
     * Search podcasts by query
     * https://www.listennotes.com/api/docs/#get-api-v2-search
     */
    async search(options: {
        query: string;
        offset?: number;
        language?: string;
        region?: string;
        genreIds?: number[];
        safeMode?: boolean;
    }): Promise<{ podcasts: ListenNotesPodcast[]; nextOffset: number; total: number }> {
        const { query, offset = 0, language, region, genreIds, safeMode = true } = options;

        const params: Record<string, string> = {
            q: query,
            type: 'podcast',
            offset: offset.toString(),
            len_min: '1',
            page_size: config.listenNotes.lnPageSize.toString(),
        };

        if (language) params.language = language;
        if (region) params.region = region;
        if (genreIds && genreIds.length > 0) params.genre_ids = genreIds.join(',');
        if (safeMode) params.safe_mode = '1';

        const response = await this.request<ListenNotesSearchResponse>('/search', params);

        const podcasts = response.results.map(result => this.mapSearchResult(result));

        return {
            podcasts,
            nextOffset: response.next_offset,
            total: response.total,
        };
    }

    /**
     * Get podcast detail by ID
     * https://www.listennotes.com/api/docs/#get-api-v2-podcasts-id
     */
    async getPodcastDetail(podcastId: string, options: {
        sort?: 'recent_first' | 'oldest_first';
        nextEpisodePubDate?: number;
    } = {}): Promise<ListenNotesPodcast & { episodes: ListenNotesEpisode[] }> {
        const { sort = 'recent_first', nextEpisodePubDate } = options;

        const params: Record<string, string> = {
            sort,
        };

        if (nextEpisodePubDate) {
            params.next_episode_pub_date = nextEpisodePubDate.toString();
        }

        const response = await this.request<ListenNotesPodcastDetail>(`/podcasts/${podcastId}`, params);

        return {
            ...this.mapPodcastDetail(response),
            episodes: response.episodes || [],
        };
    }

    /**
     * Map search result to local podcast type
     */
    private mapSearchResult(result: ListenNotesSearchResult): ListenNotesPodcast {
        // Estimate audience size based on listen_score (heuristic)
        let audienceEstimate: number | null = null;
        if (result.listen_score) {
            // listen_score is 0-100, estimate audience
            audienceEstimate = Math.round(result.listen_score * result.listen_score * 50);
        }

        return {
            externalId: result.id,
            externalSource: 'listen_notes',
            title: result.title_original || 'Untitled Podcast',
            description: result.description_original || '',
            publisher: result.publisher_original || null,
            categories: [], // Will be resolved from genre_ids later
            language: result.language || 'en',
            country: result.country || null,
            hostName: result.publisher_original || null,
            contactEmail: result.email || null,
            rssUrl: result.rss || null,
            websiteUrl: result.website || null,
            imageUrl: result.image || result.thumbnail || null,
            genreIds: result.genre_ids || [],
            listenScore: result.listen_score,
            listenScoreGlobalRank: result.listen_score_global_rank,
            explicitContent: result.explicit_content,
            hasGuestInterviews: null, // Not available in search, only in detail
            hasSponsors: null,        // Not available in search, only in detail
            audienceSizeEstimate: audienceEstimate,
            rawPayload: result as unknown as Record<string, unknown>,
        };
    }

    /**
     * Map podcast detail to local podcast type
     */
    private mapPodcastDetail(detail: ListenNotesPodcastDetail): ListenNotesPodcast {
        let audienceEstimate: number | null = null;
        if (detail.listen_score) {
            audienceEstimate = Math.round(detail.listen_score * detail.listen_score * 50);
        }

        return {
            externalId: detail.id,
            externalSource: 'listen_notes',
            title: detail.title || 'Untitled Podcast',
            description: detail.description || '',
            publisher: detail.publisher || null,
            categories: [],
            language: detail.language || 'en',
            country: detail.country || null,
            hostName: detail.publisher || null,
            contactEmail: detail.email || null,
            rssUrl: detail.rss || null,
            websiteUrl: detail.website || null,
            imageUrl: detail.image || null,
            genreIds: detail.genre_ids || [],
            listenScore: detail.listen_score,
            listenScoreGlobalRank: detail.listen_score_global_rank,
            explicitContent: detail.explicit_content,
            hasGuestInterviews: null, // Would need to infer from episodes
            hasSponsors: null,
            audienceSizeEstimate: audienceEstimate,
            rawPayload: detail as unknown as Record<string, unknown>,
        };
    }
}

// Singleton instance
export const listenNotesClient = new ListenNotesClient();
