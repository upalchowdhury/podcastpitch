'use client';

import { useEffect, useState } from 'react';
import { dashboardApi, sendApi } from '@/lib/api';
import {
    Mail,
    Eye,
    MessageSquare,
    TrendingUp,
    Loader2,
    AlertCircle
} from 'lucide-react';

interface DashboardStats {
    totalPitches: number;
    sentPitches: number;
    openedPitches: number;
    responseRate: number;
    responsesByStatus: {
        interested: number;
        declined: number;
        booked: number;
        noResponse: number;
    };
}

interface UsageStats {
    dailySent: number;
    dailyRemaining: number;
    monthlySent: number;
    monthlyRemaining: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsData, usageData] = await Promise.all([
                    dashboardApi.getStats(),
                    sendApi.getUsage(),
                ]);
                setStats(statsData);
                setUsage(usageData);
            } catch (err: any) {
                setError(err.message || 'Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Pitches"
                    value={stats?.totalPitches || 0}
                    icon={<Mail className="h-6 w-6 text-primary-600" />}
                    color="primary"
                />
                <StatCard
                    title="Emails Sent"
                    value={stats?.sentPitches || 0}
                    icon={<TrendingUp className="h-6 w-6 text-green-600" />}
                    color="green"
                />
                <StatCard
                    title="Emails Opened"
                    value={stats?.openedPitches || 0}
                    icon={<Eye className="h-6 w-6 text-blue-600" />}
                    color="blue"
                />
                <StatCard
                    title="Response Rate"
                    value={`${stats?.responseRate || 0}%`}
                    icon={<MessageSquare className="h-6 w-6 text-accent-600" />}
                    color="purple"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Usage Card */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Limits</h2>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Daily</span>
                                <span className="font-medium">
                                    {usage?.dailySent || 0} / {(usage?.dailySent || 0) + (usage?.dailyRemaining || 0)}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-primary-600 h-2 rounded-full transition-all"
                                    style={{
                                        width: `${((usage?.dailySent || 0) /
                                                ((usage?.dailySent || 0) + (usage?.dailyRemaining || 1))) *
                                            100
                                            }%`,
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Monthly</span>
                                <span className="font-medium">
                                    {usage?.monthlySent || 0} / {(usage?.monthlySent || 0) + (usage?.monthlyRemaining || 0)}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-accent-600 h-2 rounded-full transition-all"
                                    style={{
                                        width: `${((usage?.monthlySent || 0) /
                                                ((usage?.monthlySent || 0) + (usage?.monthlyRemaining || 1))) *
                                            100
                                            }%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Response Breakdown */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Responses</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <ResponseStat
                            label="Interested"
                            value={stats?.responsesByStatus.interested || 0}
                            color="green"
                        />
                        <ResponseStat
                            label="Booked"
                            value={stats?.responsesByStatus.booked || 0}
                            color="blue"
                        />
                        <ResponseStat
                            label="Declined"
                            value={stats?.responsesByStatus.declined || 0}
                            color="red"
                        />
                        <ResponseStat
                            label="No Response"
                            value={stats?.responsesByStatus.noResponse || 0}
                            color="gray"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    color,
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}) {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-${color}-50`}>{icon}</div>
            </div>
        </div>
    );
}

function ResponseStat({
    label,
    value,
    color,
}: {
    label: string;
    value: number;
    color: string;
}) {
    const colorClasses: Record<string, string> = {
        green: 'bg-green-100 text-green-800',
        blue: 'bg-blue-100 text-blue-800',
        red: 'bg-red-100 text-red-800',
        gray: 'bg-gray-100 text-gray-800',
    };

    return (
        <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );
}
