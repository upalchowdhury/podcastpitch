'use client';

import { useEffect, useState } from 'react';
import { pitchApi } from '@/lib/api';
import Link from 'next/link';
import { PenLine, Trash2, Send, Loader2, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Pitch {
    id: string;
    status: string;
    generatedSubject: string;
    editedSubject: string | null;
    createdAt: string;
    podcast: {
        id: string;
        title: string;
        hostName: string | null;
        imageUrl: string | null;
    };
}

export default function PitchesPage() {
    const [pitches, setPitches] = useState<Pitch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPitches();
    }, []);

    const fetchPitches = async () => {
        try {
            const data = await pitchApi.getAll();
            setPitches(data);
        } catch (error) {
            console.error('Failed to fetch pitches:', error);
        } finally {
            setLoading(false);
        }
    };

    const deletePitch = async (id: string) => {
        if (!confirm('Are you sure you want to delete this pitch?')) return;

        try {
            await pitchApi.delete(id);
            setPitches(pitches.filter((p) => p.id !== id));
        } catch (error) {
            console.error('Failed to delete pitch:', error);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, string> = {
            draft: 'badge bg-gray-100 text-gray-700',
            ready: 'badge-info',
            scheduled: 'badge-warning',
            sent: 'badge-success',
            failed: 'badge-error',
        };
        return badges[status] || 'badge bg-gray-100 text-gray-700';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Pitches</h1>
                <Link href="/podcasts" className="btn-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Pitch
                </Link>
            </div>

            {pitches.length === 0 ? (
                <div className="card text-center py-12">
                    <p className="text-gray-500 mb-4">
                        You haven't created any pitches yet.
                    </p>
                    <Link href="/podcasts" className="btn-primary">
                        Search Podcasts
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {pitches.map((pitch) => (
                        <div key={pitch.id} className="card">
                            <div className="flex items-start gap-4">
                                {pitch.podcast.imageUrl ? (
                                    <img
                                        src={pitch.podcast.imageUrl}
                                        alt={pitch.podcast.title}
                                        className="w-16 h-16 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                                        <span className="text-xl">🎙️</span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-gray-900">
                                            {pitch.podcast.title}
                                        </h3>
                                        <span className={getStatusBadge(pitch.status)}>
                                            {pitch.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2">
                                        Subject: {pitch.editedSubject || pitch.generatedSubject}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Created {format(new Date(pitch.createdAt), 'MMM d, yyyy')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={`/pitches/${pitch.id}`}
                                        className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                                    >
                                        <PenLine className="h-5 w-5" />
                                    </Link>
                                    {(pitch.status === 'ready' || pitch.status === 'draft') && (
                                        <Link
                                            href={`/pitches/${pitch.id}/send`}
                                            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                                        >
                                            <Send className="h-5 w-5" />
                                        </Link>
                                    )}
                                    {pitch.status !== 'sent' && (
                                        <button
                                            onClick={() => deletePitch(pitch.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
