'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { pitchApi, emailAccountApi, sendApi } from '@/lib/api';
import { Loader2, ArrowLeft, Send, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';

interface Pitch {
    id: string;
    status: string;
    generatedSubject: string;
    generatedBody: string;
    editedSubject: string | null;
    editedBody: string | null;
    podcast?: {
        id: string;
        title: string;
        contactEmail: string | null;
    };
}

interface EmailAccount {
    id: string;
    fromEmail: string;
    fromName: string | null;
}

export default function ScheduleSendPage() {
    const params = useParams();
    const router = useRouter();
    const [pitch, setPitch] = useState<Pitch | null>(null);
    const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [sendNow, setSendNow] = useState(true);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [manualEmail, setManualEmail] = useState('');

    useEffect(() => {
        Promise.all([
            pitchApi.getById(params.id as string),
            emailAccountApi.getAll()
        ]).then(([pitchData, accounts]) => {
            setPitch(pitchData);
            setEmailAccounts(accounts);
            if (accounts.length > 0) {
                setSelectedAccount(accounts[0].id);
            }
        }).catch(err => {
            console.error('Failed to load data:', err);
            setError('Failed to load pitch data');
        }).finally(() => {
            setLoading(false);
        });
    }, [params.id]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pitch || !selectedAccount) return;

        // Get recipient email - either manual or from podcast
        const recipient = manualEmail || pitch.podcast?.contactEmail;
        if (!recipient) {
            setError('Please enter a recipient email address');
            return;
        }

        setSending(true);
        setError('');

        try {
            await sendApi.schedule(
                pitch.id,
                selectedAccount,
                sendNow ? undefined : scheduledAt,
                recipient
            );
            router.push('/pitches');
        } catch (err: any) {
            console.error('Failed to schedule send:', err);
            setError(err.message || 'Failed to schedule. Please try again.');
        } finally {
            setSending(false);
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
                <Link href="/pitches" className="btn-primary mt-4 inline-block">
                    Back to Pitches
                </Link>
            </div>
        );
    }

    const subject = pitch.editedSubject || pitch.generatedSubject;
    const recipientEmail = manualEmail || pitch.podcast?.contactEmail;

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href={`/pitches/${pitch.id}`}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Schedule Send</h1>
                    <p className="text-gray-500">Send pitch to {pitch.podcast?.title || 'podcast'}</p>
                </div>
            </div>

            {/* Preview */}
            <div className="card mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Email Preview</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                    <div className="mb-2">
                        <span className="text-gray-500">To: </span>
                        <span className="font-medium">
                            {recipientEmail || <span className="text-red-500">No email found for this podcast</span>}
                        </span>
                    </div>
                    <div className="mb-2">
                        <span className="text-gray-500">Subject: </span>
                        <span className="font-medium">{subject}</span>
                    </div>
                </div>
            </div>

            {/* Send Form */}
            <form onSubmit={handleSend} className="card">
                {error && (
                    <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                {!pitch.podcast?.contactEmail && (
                    <div className="mb-4">
                        <label className="label">Recipient Email</label>
                        <input
                            type="email"
                            value={manualEmail}
                            onChange={(e) => setManualEmail(e.target.value)}
                            className="input"
                            placeholder="Enter podcast contact email..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This podcast doesn't have a saved email. Enter one manually.
                        </p>
                    </div>
                )}

                {emailAccounts.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-gray-500 mb-4">
                            You need to connect an email account first.
                        </p>
                        <Link href="/settings/email" className="btn-primary">
                            Connect Email Account
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="mb-4">
                            <label className="label">Send From</label>
                            <select
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                                className="input"
                            >
                                {emailAccounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.fromName ? `${account.fromName} <${account.fromEmail}>` : account.fromEmail}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-6">
                            <label className="label">When to Send</label>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                    <input
                                        type="radio"
                                        name="sendTime"
                                        checked={sendNow}
                                        onChange={() => setSendNow(true)}
                                        className="text-primary-600"
                                    />
                                    <Send className="h-4 w-4 text-gray-500" />
                                    <span>Send immediately</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                    <input
                                        type="radio"
                                        name="sendTime"
                                        checked={!sendNow}
                                        onChange={() => setSendNow(false)}
                                        className="text-primary-600"
                                    />
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                    <span>Schedule for later</span>
                                </label>
                            </div>

                            {!sendNow && (
                                <div className="mt-3">
                                    <input
                                        type="datetime-local"
                                        value={scheduledAt}
                                        onChange={(e) => setScheduledAt(e.target.value)}
                                        className="input"
                                        min={new Date().toISOString().slice(0, 16)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Link href={`/pitches/${pitch.id}`} className="btn-secondary flex-1">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={sending || !recipientEmail || (!sendNow && !scheduledAt)}
                                className="btn-primary flex-1"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        {sendNow ? 'Sending...' : 'Scheduling...'}
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        {sendNow ? 'Send Now' : 'Schedule'}
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
}
