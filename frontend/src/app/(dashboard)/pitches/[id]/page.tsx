'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { pitchApi } from '@/lib/api';
import { Loader2, ArrowLeft, RefreshCw, Save, Send } from 'lucide-react';
import Link from 'next/link';

interface Pitch {
    id: string;
    status: string;
    generatedSubject: string;
    generatedBody: string;
    editedSubject: string | null;
    editedBody: string | null;
    podcast: {
        id: string;
        title: string;
        hostName: string | null;
        description: string;
    };
}

export default function PitchEditorPage() {
    const params = useParams();
    const router = useRouter();
    const [pitch, setPitch] = useState<Pitch | null>(null);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    useEffect(() => {
        fetchPitch();
    }, [params.id]);

    const fetchPitch = async () => {
        try {
            const data = await pitchApi.getById(params.id as string);
            setPitch(data);
            setSubject(data.editedSubject || data.generatedSubject);
            setBody(data.editedBody || data.generatedBody);
        } catch (error) {
            console.error('Failed to fetch pitch:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!pitch) return;
        setSaving(true);

        try {
            await pitchApi.update(pitch.id, {
                editedSubject: subject,
                editedBody: body,
            });
            // Show success feedback
        } catch (error) {
            console.error('Failed to save pitch:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerate = async () => {
        if (!pitch) return;
        setRegenerating(true);

        try {
            const updated = await pitchApi.regenerate(pitch.id);
            setPitch(updated);
            setSubject(updated.generatedSubject);
            setBody(updated.generatedBody);
        } catch (error) {
            console.error('Failed to regenerate pitch:', error);
        } finally {
            setRegenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    if (!pitch) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Pitch not found.</p>
                <Link href="/pitches" className="btn-primary mt-4">
                    Back to Pitches
                </Link>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/pitches"
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Pitch to {pitch.podcast?.title || 'Podcast'}
                    </h1>
                    {pitch.podcast?.hostName && (
                        <p className="text-gray-500">Hosted by {pitch.podcast.hostName}</p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        className="btn-secondary"
                    >
                        {regenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Regenerate
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-secondary"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save
                    </button>
                    <Link href={`/pitches/${pitch.id}/send`} className="btn-primary">
                        <Send className="h-4 w-4 mr-2" />
                        Schedule Send
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Editor */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="card">
                        <label className="label">Subject Line</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="input"
                            placeholder="Email subject..."
                        />
                    </div>
                    <div className="card">
                        <label className="label">Email Body</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            className="input min-h-[400px] font-mono text-sm"
                            placeholder="Email body..."
                        />
                    </div>
                </div>

                {/* Podcast Info */}
                <div className="card h-fit">
                    <h3 className="font-semibold text-gray-900 mb-4">Podcast Info</h3>
                    {pitch.podcast ? (
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-gray-500">Title</p>
                                <p className="font-medium">{pitch.podcast.title}</p>
                            </div>
                            {pitch.podcast.hostName && (
                                <div>
                                    <p className="text-gray-500">Host</p>
                                    <p className="font-medium">{pitch.podcast.hostName}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-gray-500">Description</p>
                                <p className="text-gray-600 line-clamp-4">
                                    {pitch.podcast.description}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Podcast info not available</p>
                    )}
                </div>
            </div>
        </div>
    );
}
