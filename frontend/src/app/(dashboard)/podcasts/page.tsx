'use client';

import { useState } from 'react';
import { podcastApi, targetListApi } from '@/lib/api';
import { Search, Plus, ExternalLink, Loader2 } from 'lucide-react';
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
}

export default function PodcastSearchPage() {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [podcasts, setPodcasts] = useState<Podcast[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedPodcasts, setSelectedPodcasts] = useState<Set<string>>(new Set());

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setHasSearched(true);

        try {
            const params: Record<string, any> = { limit: 50 };
            if (query) params.query = query;
            if (category) params.categories = [category];

            const result = await podcastApi.search(params);
            setPodcasts(result.podcasts);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
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

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Podcast Search</h1>
                {selectedPodcasts.size > 0 && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                            {selectedPodcasts.size} selected
                        </span>
                        <button className="btn-primary">
                            <Plus className="h-4 w-4 mr-2" />
                            Add to List
                        </button>
                    </div>
                )}
            </div>

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
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
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
