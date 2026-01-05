'use client';

import { useEffect, useState } from 'react';
import { emailAccountApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Plus, Trash2, Loader2, Mail, CheckCircle, AlertCircle, AlertTriangle, PlayCircle, ExternalLink } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface EmailAccount {
    id: string;
    providerType: string;
    fromName: string;
    fromEmail: string;
    domain: string;
    healthStatus: string;
    isVerified: boolean;
}

interface EmailAccountForm {
    providerType: 'smtp';
    fromName: string;
    fromEmail: string;
    host: string;
    port: number;
    username: string;
    password: string;
}

export default function EmailSettingsPage() {
    const [accounts, setAccounts] = useState<EmailAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [adding, setAdding] = useState(false);
    const { setHasEmailAccount } = useAuthStore();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<EmailAccountForm>({
        defaultValues: {
            providerType: 'smtp',
            port: 587,
        },
    });

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const data = await emailAccountApi.getAll();
            setAccounts(data);
            setHasEmailAccount(data.length > 0);
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: EmailAccountForm) => {
        setAdding(true);
        try {
            const account = await emailAccountApi.create({
                providerType: data.providerType,
                fromName: data.fromName,
                fromEmail: data.fromEmail,
                smtpConfig: {
                    host: data.host,
                    port: data.port,
                    secure: data.port === 465,
                    username: data.username,
                    password: data.password,
                },
            });
            const newAccounts = [account, ...accounts];
            setAccounts(newAccounts);
            setHasEmailAccount(true);
            reset();
            setShowAdd(false);
        } catch (error) {
            console.error('Failed to add account:', error);
        } finally {
            setAdding(false);
        }
    };

    const deleteAccount = async (id: string) => {
        if (!confirm('Are you sure you want to delete this email account?')) return;

        try {
            await emailAccountApi.delete(id);
            const newAccounts = accounts.filter((a) => a.id !== id);
            setAccounts(newAccounts);
            setHasEmailAccount(newAccounts.length > 0);
        } catch (error) {
            console.error('Failed to delete account:', error);
        }
    };

    const getHealthIcon = (status: string) => {
        switch (status) {
            case 'healthy':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case 'error':
                return <AlertCircle className="h-5 w-5 text-red-500" />;
            default:
                return <AlertCircle className="h-5 w-5 text-gray-400" />;
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
        <div className="max-w-3xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Email Accounts</h1>
                    <p className="text-gray-500">
                        Configure email accounts for sending pitches.
                    </p>
                </div>
                <button onClick={() => setShowAdd(true)} className="btn-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Account
                </button>
            </div>

            {/* Setup Required Banner - Show only if no accounts */}
            {accounts.length === 0 && !showAdd && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <AlertTriangle className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-amber-800 mb-1">
                                Email Setup Required
                            </h3>
                            <p className="text-amber-700 text-sm mb-4">
                                You need to configure an SMTP email account before you can send pitches.
                                Watch the tutorial below to learn how to set up SMTP with your email provider.
                            </p>
                            <button
                                onClick={() => setShowAdd(true)}
                                className="btn-primary bg-amber-600 hover:bg-amber-700"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Set Up Email Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Tutorial Section */}
            <div className="card mb-6">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                        <PlayCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                            How to Set Up SMTP Email
                        </h3>
                        <p className="text-gray-500 text-sm mb-4">
                            Watch this quick tutorial to learn how to configure your SMTP settings for sending emails.
                        </p>

                        {/* Embedded YouTube Video */}
                        <div className="aspect-video w-full max-w-2xl rounded-lg overflow-hidden bg-gray-100 mb-3">
                            <iframe
                                src="https://www.youtube.com/embed/ZfEK3WP73eY"
                                title="How to Set Up SMTP Email"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="w-full h-full"
                            />
                        </div>

                        <a
                            href="https://www.youtube.com/watch?v=ZfEK3WP73eY"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Open in YouTube
                        </a>
                    </div>
                </div>
            </div>

            {/* Add Account Form */}
            {showAdd && (
                <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 space-y-4">
                    <h3 className="font-semibold text-gray-900">Add SMTP Account</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">From Name</label>
                            <input
                                {...register('fromName', { required: 'Required' })}
                                className="input"
                                placeholder="John Doe"
                            />
                        </div>
                        <div>
                            <label className="label">From Email</label>
                            <input
                                {...register('fromEmail', { required: 'Required' })}
                                type="email"
                                className="input"
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">SMTP Host</label>
                            <input
                                {...register('host', { required: 'Required' })}
                                className="input"
                                placeholder="smtp.example.com"
                            />
                        </div>
                        <div>
                            <label className="label">Port</label>
                            <input
                                {...register('port', { required: 'Required', valueAsNumber: true })}
                                type="number"
                                className="input"
                                placeholder="587"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Username</label>
                            <input
                                {...register('username', { required: 'Required' })}
                                className="input"
                                placeholder="username"
                            />
                        </div>
                        <div>
                            <label className="label">Password</label>
                            <input
                                {...register('password', { required: 'Required' })}
                                type="password"
                                className="input"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setShowAdd(false);
                                reset();
                            }}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button type="submit" disabled={adding} className="btn-primary">
                            {adding ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Add Account
                        </button>
                    </div>
                </form>
            )}

            {/* Accounts List */}
            {accounts.length === 0 && !showAdd ? (
                <div className="card text-center py-12">
                    <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                        No email accounts configured. Add one to start sending pitches.
                    </p>
                </div>
            ) : accounts.length > 0 ? (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Your Email Accounts</h3>
                    {accounts.map((account) => (
                        <div key={account.id} className="card">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {getHealthIcon(account.healthStatus)}
                                    <div>
                                        <p className="font-semibold text-gray-900">
                                            {account.fromName}
                                        </p>
                                        <p className="text-sm text-gray-500">{account.fromEmail}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="badge bg-gray-100 text-gray-600">
                                        {account.providerType.toUpperCase()}
                                    </span>
                                    {account.isVerified && (
                                        <span className="badge-success">Verified</span>
                                    )}
                                    <button
                                        onClick={() => deleteAccount(account.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
