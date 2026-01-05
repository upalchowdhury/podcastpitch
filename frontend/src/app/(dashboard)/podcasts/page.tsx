'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { podcastApi, targetListApi, pitchApi } from '@/lib/api';
import { Search, Plus, ExternalLink, Loader2, Mail, Sparkles, Filter, Calendar, Users } from 'lucide-react';
import { PODCAST_CATEGORIES } from '@podcast-pitch/shared';

interface Podcast {
    id: string;
    title: string;
    description: string;
    hostName: string | null;
    categories: string[];
    audienceSizeEstimate: number | null;
    imageUrl: string | null;
    website: string | null;
    contactEmail: string | null;
    latestEpisodePubDate?: string | null;
    totalEpisodes?: number | null;
}

function PodcastSearchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Search state - initialize from URL
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [category, setCategory] = useState(searchParams.get('category') || '');
    const [minAudience, setMinAudience] = useState(searchParams.get('minAudience') || '');
    const [maxAudience, setMaxAudience] = useState(searchParams.get('maxAudience') || '');
    const [activeOnly, setActiveOnly] = useState(searchParams.get('activeOnly') === 'true');

    // Results state
    const [podcasts, setPodcasts] = useState<Podcast[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [generatingPitch, setGeneratingPitch] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedPodcasts, setSelectedPodcasts] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [showFilters, setShowFilters] = useState(false);

    // List selection state
    const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
    const [showListModal, setShowListModal] = useState(false);
    const [addingToList, setAddingToList] = useState(false);

    useEffect(() => {
        fetchLists();
    }, []);

    // Restore search from URL on mount
    useEffect(() => {
        const q = searchParams.get('q');
        const cat = searchParams.get('category');
        if (q || cat) {
            executeSearch({
                query: q || '',
                category: cat || '',
                minAudience: searchParams.get('minAudience') || '',
                maxAudience: searchParams.get('maxAudience') || '',
                activeOnly: searchParams.get('activeOnly') === 'true',
                page: 1,
            });
        }
    }, []); // Only run on mount

    const fetchLists = async () => {
        try {
            const data = await targetListApi.getAll();
            setLists(data);
        } catch (error) {
            console.error('Failed to fetch lists:', error);
        }
    };

    const addToList = async (listId: string) => {
        setAddingToList(true);
        try {
            await targetListApi.addItems(listId, Array.from(selectedPodcasts));
            setShowListModal(false);
            setSelectedPodcasts(new Set());
            router.push(`/lists/${listId}`);
        } catch (error) {
            console.error('Failed to add to list:', error);
            alert('Failed to add podcasts to list. Please try again.');
        } finally {
            setAddingToList(false);
        }
    };

    const executeSearch = async (searchState: {
        query: string;
        category: string;
        minAudience: string;
        maxAudience: string;
        activeOnly: boolean;
        page: number;
    }) => {
        setLoading(true);
        setHasSearched(true);

        try {
            const params: Record<string, any> = { limit: 50, page: searchState.page };
            if (searchState.query) params.query = searchState.query;
            if (searchState.category) params.categories = [searchState.category];
            if (searchState.minAudience) params.minAudienceSize = parseInt(searchState.minAudience);
            if (searchState.maxAudience) params.maxAudienceSize = parseInt(searchState.maxAudience);
            if (searchState.activeOnly) params.activeOnly = true;

            const result = await podcastApi.search(params);
            setPodcasts(result.podcasts);
            setHasMore(result.hasMore);
            setTotal(result.total);
            setPage(searchState.page);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        // Update URL with search params
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (category) params.set('category', category);
        if (minAudience) params.set('minAudience', minAudience);
        if (maxAudience) params.set('maxAudience', maxAudience);
        if (activeOnly) params.set('activeOnly', 'true');

        // Update URL without navigation (preserves history)
        const newUrl = params.toString() ? `/podcasts?${params.toString()}` : '/podcasts';
        window.history.replaceState({}, '', newUrl);

        await executeSearch({
            query,
            category,
            minAudience,
            maxAudience,
            activeOnly,
            page: 1,
        });
    };

    const loadMore = async () => {
        setLoadingMore(true);
        const nextPage = page + 1;

        try {
            const params: Record<string, any> = { limit: 50, page: nextPage };
            if (query) params.query = query;
            if (category) params.categories = [category];
            if (minAudience) params.minAudienceSize = parseInt(minAudience);
            if (maxAudience) params.maxAudienceSize = parseInt(maxAudience);
            if (activeOnly) params.activeOnly = true;

            const result = await podcastApi.search(params);
            setPodcasts([...podcasts, ...result.podcasts]);
            setHasMore(result.hasMore);
            setPage(nextPage);
        } catch (error) {
            console.error('Load more failed:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const togglePodcast = (id: string) => {
        const newSelected = new Set(selectedPodcasts);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedPodcasts(newSelected);
    };

    const generatePitch = async (podcastId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setGeneratingPitch(podcastId);

        try {
            const pitch = await pitchApi.generate(podcastId);
            // Open in new tab to preserve search state
            window.open(`/pitches/${pitch.id}`, '_blank');
            setGeneratingPitch(null);
        } catch (error) {
            console.error('Failed to generate pitch:', error);
            alert('Failed to generate pitch. Please try again.');
            setGeneratingPitch(null);
        }
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
        return `${Math.floor(diffDays / 365)}y ago`;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Podcast Search</h1>
                {selectedPodcasts.size > 0 && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                            {selectedPodcasts.size} selected
                        </span>
                        <button
                            onClick={() => setShowListModal(true)}
                            className="btn-primary"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add to List
                        </button>
                    </div>
                )}
            </div>

            {/* List Selection Modal */}
            {showListModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Add {selectedPodcasts.size} podcast{selectedPodcasts.size > 1 ? 's' : ''} to list
                        </h2>

                        {lists.length === 0 ? (
                            <div className="text-center py-6">
                                <p className="text-gray-500 mb-4">No lists yet. Create your first list.</p>
                                <button
                                    onClick={() => {
                                        setShowListModal(false);
                                        router.push('/lists');
                                    }}
                                    className="btn-primary"
                                >
                                    Create a List
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {lists.map(list => (
                                    <button
                                        key={list.id}
                                        onClick={() => addToList(list.id)}
                                        disabled={addingToList}
                                        className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-between group"
                                    >
                                        <span className="font-medium text-gray-900">{list.name}</span>
                                        {addingToList ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                                        ) : (
                                            <Plus className="h-4 w-4 text-gray-400 group-hover:text-primary-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t flex justify-between">
                            <button
                                onClick={() => router.push('/lists')}
                                className="text-sm text-primary-600 hover:text-primary-700"
                            >
                                Create New List
                            </button>
                            <button
                                onClick={() => setShowListModal(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Form */}
            <form onSubmit={handleSearch} className="card mb-6">
                <div className="flex flex-col gap-4">
                    {/* Main search row */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="label">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="input pl-10"
                                    placeholder="Search podcasts (e.g., AI, marketing, health)..."
                                />
                            </div>
                        </div>
                        <div className="w-full md:w-64">
                            <label className="label">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="input"
                            >
                                <option value="">All Categories</option>
                                {PODCAST_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowFilters(!showFilters)}
                                className={`btn-secondary ${showFilters ? 'bg-primary-100' : ''}`}
                            >
                                <Filter className="h-5 w-5" />
                            </button>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    'Search'
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Advanced filters */}
                    {showFilters && (
                        <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="label flex items-center gap-1">
                                    <Users className="h-4 w-4" />
                                    Min Audience Size
                                </label>
                                <input
                                    type="number"
                                    value={minAudience}
                                    onChange={(e) => setMinAudience(e.target.value)}
                                    className="input"
                                    placeholder="e.g., 1000"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="label flex items-center gap-1">
                                    <Users className="h-4 w-4" />
                                    Max Audience Size
                                </label>
                                <input
                                    type="number"
                                    value={maxAudience}
                                    onChange={(e) => setMaxAudience(e.target.value)}
                                    className="input"
                                    placeholder="e.g., 100000"
                                    min="0"
                                />
                            </div>
                            <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-100">
                                    <input
                                        type="checkbox"
                                        checked={activeOnly}
                                        onChange={(e) => setActiveOnly(e.target.checked)}
                                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                    />
                                    <span className="flex items-center gap-1 text-sm text-gray-700">
                                        <Calendar className="h-4 w-4" />
                                        Active podcasts only (last 6 months)
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </form>

            {/* Results */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
            ) : podcasts.length > 0 ? (
                <>
                    <div className="grid gap-4">
                        {podcasts.map((podcast) => (
                            <div
                                key={podcast.id}
                                className={`card cursor-pointer transition-colors ${selectedPodcasts.has(podcast.id)
                                    ? 'ring-2 ring-primary-500 bg-primary-50'
                                    : 'hover:bg-gray-50'
                                    }`}
                                onClick={() => togglePodcast(podcast.id)}
                            >
                                <div className="flex gap-4">
                                    {podcast.imageUrl ? (
                                        <img
                                            src={podcast.imageUrl}
                                            alt={podcast.title}
                                            className="w-20 h-20 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">
                                            <span className="text-2xl">🎙️</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-semibold text-gray-900 truncate">
                                                    {podcast.title}
                                                </h3>
                                                {podcast.hostName && (
                                                    <p className="text-sm text-gray-500">
                                                        Hosted by {podcast.hostName}
                                                    </p>
                                                )}
                                            </div>
                                            {podcast.website && (
                                                <a
                                                    href={podcast.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-gray-400 hover:text-gray-600"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="h-5 w-5" />
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                                            {podcast.description}
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {podcast.categories.slice(0, 3).map((cat) => (
                                                <span key={cat} className="badge-info">
                                                    {cat}
                                                </span>
                                            ))}
                                            {podcast.audienceSizeEstimate && (
                                                <span className="badge bg-gray-100 text-gray-700">
                                                    {podcast.audienceSizeEstimate.toLocaleString()} listeners
                                                </span>
                                            )}
                                            {podcast.latestEpisodePubDate && (
                                                <span className="badge bg-blue-100 text-blue-700 flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDate(podcast.latestEpisodePubDate)}
                                                </span>
                                            )}
                                            {podcast.totalEpisodes && (
                                                <span className="badge bg-purple-100 text-purple-700">
                                                    {podcast.totalEpisodes} episodes
                                                </span>
                                            )}
                                            {podcast.contactEmail && (
                                                <a
                                                    href={`mailto:${podcast.contactEmail}`}
                                                    className="badge bg-green-100 text-green-700 flex items-center gap-1 hover:bg-green-200"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Mail className="h-3 w-3" />
                                                    {podcast.contactEmail}
                                                </a>
                                            )}
                                        </div>
                                        <div className="mt-3">
                                            <button
                                                onClick={(e) => generatePitch(podcast.id, e)}
                                                disabled={generatingPitch === podcast.id}
                                                className="btn-primary text-sm py-1.5 px-3"
                                            >
                                                {generatingPitch === podcast.id ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="h-4 w-4 mr-1" />
                                                        Generate Pitch
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 flex flex-col items-center gap-3">
                        <p className="text-sm text-gray-500">
                            Showing {podcasts.length} of {total} podcasts
                        </p>
                        {hasMore && (
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="btn-secondary"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Loading...
                                    </>
                                ) : (
                                    'Load More'
                                )}
                            </button>
                        )}
                    </div>
                </>
            ) : hasSearched ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">No podcasts found. Try a different search.</p>
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className="text-gray-500">
                        Search for podcasts to start building your outreach list.
                    </p>
                </div>
            )}
        </div>
    );
}

export default function PodcastSearchPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        }>
            <PodcastSearchContent />
        </Suspense>
    );
}
