'use client';

import { useEffect, useState } from 'react';
import { responseApi, pitchApi } from '@/lib/api';
import { Loader2, MessageSquare, Check, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Response {
    id: string;
    pitchId: string;
    status: string;
    notes: string | null;
    updatedAt: string;
}

interface Pitch {
    id: string;
    status: string;
    podcast: {
        title: string;
        hostName: string | null;
    };
}

export default function ResponsesPage() {
    const [pitches, setPitches] = useState<Pitch[]>([]);
    const [responses, setResponses] = useState<Map<string, Response>>(new Map());
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [pitchesData, responsesData] = await Promise.all([
                pitchApi.getAll(),
                responseApi.getAll(),
            ]);

            // Filter to only sent pitches
            const sentPitches = pitchesData.filter((p: any) => p.status === 'sent');
            setPitches(sentPitches);

            // Create response map
            const responseMap = new Map<string, Response>();
            responsesData.forEach((r: Response) => {
                responseMap.set(r.pitchId, r);
            });
            setResponses(responseMap);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateResponse = async (pitchId: string, status: string) => {
        setUpdating(pitchId);
        try {
            const updated = await responseApi.update(pitchId, { status });
            setResponses((prev) => {
                const newMap = new Map(prev);
                newMap.set(pitchId, updated);
                return newMap;
            });
        } catch (error) {
            console.error('Failed to update response:', error);
        } finally {
            setUpdating(null);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'interested':
                return <Check className="h-4 w-4 text-green-600" />;
            case 'booked':
                return <Calendar className="h-4 w-4 text-blue-600" />;
            case 'declined':
                return <X className="h-4 w-4 text-red-600" />;
            default:
                return <MessageSquare className="h-4 w-4 text-gray-400" />;
        }
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
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Response Tracker</h1>

            {pitches.length === 0 ? (
                <div className="card text-center py-12">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                        No sent pitches to track yet. Send some pitches first!
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {pitches.map((pitch) => {
                        const response = responses.get(pitch.id);
                        const currentStatus = response?.status || 'no_response';

                        return (
                            <div key={pitch.id} className="card">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(currentStatus)}
                                        <div>
                                            <h3 className="font-semibold text-gray-900">
                                                {pitch.podcast.title}
                                            </h3>
                                            {pitch.podcast.hostName && (
                                                <p className="text-sm text-gray-500">
                                                    {pitch.podcast.hostName}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {['no_response', 'interested', 'declined', 'booked'].map(
                                            (status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => updateResponse(pitch.id, status)}
                                                    disabled={updating === pitch.id}
                                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currentStatus === status
                                                            ? status === 'interested'
                                                                ? 'bg-green-100 text-green-800'
                                                                : status === 'booked'
                                                                    ? 'bg-blue-100 text-blue-800'
                                                                    : status === 'declined'
                                                                        ? 'bg-red-100 text-red-800'
                                                                        : 'bg-gray-200 text-gray-700'
                                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {status === 'no_response'
                                                        ? 'No Response'
                                                        : status.charAt(0).toUpperCase() + status.slice(1)}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                                {response?.updatedAt && (
                                    <p className="text-xs text-gray-400 mt-3">
                                        Last updated {format(new Date(response.updatedAt), 'MMM d, yyyy')}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
