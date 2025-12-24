'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { podcastApi, targetListApi, pitchApi } from '@/lib/api';
import { Search, Plus, ExternalLink, Loader2, Mail, Sparkles } from 'lucide-react';
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
}

export default function PodcastSearchPage() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [podcasts, setPodcasts] = useState<Podcast[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [generatingPitch, setGeneratingPitch] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedPodcasts, setSelectedPodcasts] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);

    // List selection state
    const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
    const [showListModal, setShowListModal] = useState(false);
    const [addingToList, setAddingToList] = useState(false);

    useEffect(() => {
        fetchLists();
    }, []);

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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setHasSearched(true);
        setPage(1);

        try {
            const params: Record<string, any> = { limit: 50, page: 1 };
            if (query) params.query = query;
            if (category) params.categories = [category];

            const result = await podcastApi.search(params);
            setPodcasts(result.podcasts);
            setHasMore(result.hasMore);
            setTotal(result.total);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        setLoadingMore(true);
        const nextPage = page + 1;

        try {
            const params: Record<string, any> = { limit: 50, page: nextPage };
            if (query) params.query = query;
            if (category) params.categories = [category];

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
            router.push(`/pitches/${pitch.id}`);
        } catch (error) {
            console.error('Failed to generate pitch:', error);
            alert('Failed to generate pitch. Please try again.');
            setGeneratingPitch(null);
        }
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
                                placeholder="Search podcasts..."
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
                    <div className="flex items-end">
                        <button type="submit" className="btn-primary w-full md:w-auto" disabled={loading}>
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                'Search'
                            )}
                        </button>
                    </div>
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
