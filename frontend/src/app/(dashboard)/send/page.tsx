'use client';

import { useEffect, useState } from 'react';
import { sendApi } from '@/lib/api';
import { Loader2, Send, XCircle, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface SendJob {
    id: string;
    pitchId: string;
    status: string;
    scheduledAt: string;
    attempts: number;
    lastError: string | null;
    createdAt: string;
}

export default function SendQueuePage() {
    const [jobs, setJobs] = useState<SendJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState<string | null>(null);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            const data = await sendApi.getJobs();
            setJobs(data);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const cancelJob = async (id: string) => {
        setCancelling(id);
        try {
            await sendApi.cancelJob(id);
            setJobs(jobs.map((j) => (j.id === id ? { ...j, status: 'cancelled' } : j)));
        } catch (error) {
            console.error('Failed to cancel job:', error);
        } finally {
            setCancelling(null);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock className="h-5 w-5 text-yellow-500" />;
            case 'processing':
                return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
            case 'sent':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'failed':
                return <AlertCircle className="h-5 w-5 text-red-500" />;
            case 'cancelled':
                return <XCircle className="h-5 w-5 text-gray-400" />;
            default:
                return <Clock className="h-5 w-5 text-gray-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, string> = {
            pending: 'badge-warning',
            processing: 'badge-info',
            sent: 'badge-success',
            failed: 'badge-error',
            cancelled: 'badge bg-gray-100 text-gray-600',
        };
        return badges[status] || 'badge bg-gray-100 text-gray-600';
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
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Send Queue</h1>

            {jobs.length === 0 ? (
                <div className="card text-center py-12">
                    <Send className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                        No scheduled sends yet. Create a pitch and schedule it to send.
                    </p>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Scheduled
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Attempts
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Error
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {jobs.map((job) => (
                                <tr key={job.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(job.status)}
                                            <span className={getStatusBadge(job.status)}>
                                                {job.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {format(new Date(job.scheduledAt), 'MMM d, yyyy h:mm a')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {job.attempts}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                                        {job.lastError || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        {job.status === 'pending' && (
                                            <button
                                                onClick={() => cancelJob(job.id)}
                                                disabled={cancelling === job.id}
                                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            >
                                                {cancelling === job.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    'Cancel'
                                                )}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
