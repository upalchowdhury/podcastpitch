'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { targetListApi, pitchApi } from '@/lib/api';
import Link from 'next/link';
import {
    ArrowLeft, Trash2, Loader2, Sparkles, ExternalLink, Mail,
    Circle, CheckCircle2, Send, MessageSquare
} from 'lucide-react';

// The API returns flat Podcast objects, not nested
interface Podcast {
    id: string;
    title: string;
    description: string;
    hostName: string | null;
    categories: string[];
    imageUrl: string | null;
    website: string | null;
    contactEmail: string | null;
}

type ProgressStatus = 'not_started' | 'pitch_generated' | 'sent' | 'responded';

interface PodcastWithPitch extends Podcast {
    pitch?: {
        id: string;
        status: string;
    } | null;
}

export default function ListDetailPage() {
    const params = useParams();
    const router = useRouter();
    const listId = params.id as string;

    const [podcasts, setPodcasts] = useState<PodcastWithPitch[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingPitch, setGeneratingPitch] = useState<string | null>(null);

    useEffect(() => {
        fetchList();
    }, [listId]);

    const fetchList = async () => {
        try {
            // API returns array of Podcast objects directly
            const items = await targetListApi.getItems(listId);
            setPodcasts(items.map((p: Podcast) => ({ ...p, pitch: null })));
        } catch (error) {
            console.error('Failed to fetch list:', error);
        } finally {
            setLoading(false);
        }
    };

    const removePodcast = async (podcastId: string) => {
        if (!confirm('Remove this podcast from the list?')) return;

        try {
            await targetListApi.removeItem(listId, podcastId);
            setPodcasts(prev => prev.filter(p => p.id !== podcastId));
        } catch (error) {
            console.error('Failed to remove podcast:', error);
        }
    };

    const generatePitch = async (podcastId: string) => {
        setGeneratingPitch(podcastId);

        try {
            const pitch = await pitchApi.generate(podcastId);
            // Update the podcast with the new pitch
            setPodcasts(prev => prev.map(p =>
                p.id === podcastId
                    ? { ...p, pitch: { id: pitch.id, status: pitch.status } }
                    : p
            ));
        } catch (error) {
            console.error('Failed to generate pitch:', error);
            alert('Failed to generate pitch. Please try again.');
        } finally {
            setGeneratingPitch(null);
        }
    };

    const getProgressStatus = (podcast: PodcastWithPitch): ProgressStatus => {
        if (!podcast.pitch) return 'not_started';
        if (podcast.pitch.status === 'responded') return 'responded';
        if (podcast.pitch.status === 'sent') return 'sent';
        return 'pitch_generated';
    };

    const getProgressBadge = (status: ProgressStatus) => {
        switch (status) {
            case 'not_started':
                return (
                    <span className="badge bg-gray-100 text-gray-600 flex items-center gap-1">
                        <Circle className="h-3 w-3" />
                        Not Started
                    </span>
                );
            case 'pitch_generated':
                return (
                    <span className="badge bg-blue-100 text-blue-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Pitch Ready
                    </span>
                );
            case 'sent':
                return (
                    <span className="badge bg-yellow-100 text-yellow-700 flex items-center gap-1">
                        <Send className="h-3 w-3" />
                        Sent
                    </span>
                );
            case 'responded':
                return (
                    <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Responded
                    </span>
                );
        }
    };

    const getProgressStats = () => {
        const stats = {
            total: podcasts.length,
            notStarted: 0,
            pitchReady: 0,
            sent: 0,
            responded: 0
        };

        podcasts.forEach(p => {
            const status = getProgressStatus(p);
            if (status === 'not_started') stats.notStarted++;
            else if (status === 'pitch_generated') stats.pitchReady++;
            else if (status === 'sent') stats.sent++;
            else if (status === 'responded') stats.responded++;
        });

        return stats;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    const stats = getProgressStats();

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/lists"
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">Target List</h1>
                    <p className="text-sm text-gray-500">{podcasts.length} podcasts</p>
                </div>
                <Link href="/podcasts" className="btn-primary">
                    Add Podcasts
                </Link>
            </div>

            {/* Progress Overview */}
            {podcasts.length > 0 && (
                <div className="card mb-6 bg-gradient-to-r from-primary-50 to-blue-50">
                    <h3 className="font-semibold text-gray-900 mb-3">Progress Overview</h3>
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-gray-400">{stats.notStarted}</div>
                            <div className="text-xs text-gray-500">Not Started</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-blue-600">{stats.pitchReady}</div>
                            <div className="text-xs text-gray-500">Pitch Ready</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-yellow-600">{stats.sent}</div>
                            <div className="text-xs text-gray-500">Sent</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-600">{stats.responded}</div>
                            <div className="text-xs text-gray-500">Responded</div>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                        {stats.responded > 0 && (
                            <div
                                className="bg-green-500 h-full"
                                style={{ width: `${(stats.responded / stats.total) * 100}%` }}
                            />
                        )}
                        {stats.sent > 0 && (
                            <div
                                className="bg-yellow-500 h-full"
                                style={{ width: `${(stats.sent / stats.total) * 100}%` }}
                            />
                        )}
                        {stats.pitchReady > 0 && (
                            <div
                                className="bg-blue-500 h-full"
                                style={{ width: `${(stats.pitchReady / stats.total) * 100}%` }}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Podcast Items */}
            {podcasts.length === 0 ? (
                <div className="card text-center py-12">
                    <p className="text-gray-500 mb-4">
                        No podcasts in this list yet.
                    </p>
                    <Link href="/podcasts" className="btn-primary">
                        Search & Add Podcasts
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {podcasts.map((podcast) => {
                        const status = getProgressStatus(podcast);
                        return (
                            <div key={podcast.id} className="card">
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
                                                <h3 className="font-semibold text-gray-900">
                                                    {podcast.title}
                                                </h3>
                                                {podcast.hostName && (
                                                    <p className="text-sm text-gray-500">
                                                        Hosted by {podcast.hostName}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getProgressBadge(status)}
                                                {podcast.website && (
                                                    <a
                                                        href={podcast.website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1 text-gray-400 hover:text-gray-600"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => removePodcast(podcast.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                                            {podcast.description}
                                        </p>

                                        <div className="flex items-center gap-2 mt-3">
                                            {podcast.contactEmail && (
                                                <a
                                                    href={`mailto:${podcast.contactEmail}`}
                                                    className="badge bg-green-100 text-green-700 flex items-center gap-1"
                                                >
                                                    <Mail className="h-3 w-3" />
                                                    {podcast.contactEmail}
                                                </a>
                                            )}

                                            {/* Action buttons based on status */}
                                            {status === 'not_started' && (
                                                <button
                                                    onClick={() => generatePitch(podcast.id)}
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
                                            )}

                                            {podcast.pitch && status !== 'not_started' && (
                                                <Link
                                                    href={`/pitches/${podcast.pitch.id}`}
                                                    className="btn-secondary text-sm py-1.5 px-3"
                                                >
                                                    View Pitch
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
