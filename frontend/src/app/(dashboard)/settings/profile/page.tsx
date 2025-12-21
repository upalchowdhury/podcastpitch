'use client';

import { useEffect, useState } from 'react';
import { profileApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useForm } from 'react-hook-form';
import { Loader2, Save, Check } from 'lucide-react';

interface ProfileForm {
    name: string;
    bio: string;
    expertiseTopics: string;
    targetAudience: string;
    credentials: string;
}

export default function ProfileSettingsPage() {
    const { profile, setProfile } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ProfileForm>();

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const data = await profileApi.get();
            setProfile(data);
            reset({
                name: data.name || '',
                bio: data.bio || '',
                expertiseTopics: data.expertiseTopics?.join(', ') || '',
                targetAudience: data.targetAudience || '',
                credentials: data.credentials || '',
            });
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: ProfileForm) => {
        setSaving(true);
        setSaved(false);

        try {
            const updated = await profileApi.update({
                name: data.name,
                bio: data.bio,
                expertiseTopics: data.expertiseTopics
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                targetAudience: data.targetAudience,
                credentials: data.credentials,
            });
            setProfile(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Failed to update profile:', error);
        } finally {
            setSaving(false);
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
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Settings</h1>
            <p className="text-gray-500 mb-6">
                This information is used to generate personalized pitches for podcasts.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="card space-y-4">
                    <div>
                        <label className="label">Name</label>
                        <input
                            {...register('name', { required: 'Name is required' })}
                            className="input"
                            placeholder="Your full name"
                        />
                        {errors.name && (
                            <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="label">Bio</label>
                        <textarea
                            {...register('bio')}
                            className="input min-h-[100px]"
                            placeholder="A brief bio about yourself, your background, and what you do..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This helps AI craft personalized pitches that highlight your expertise.
                        </p>
                    </div>

                    <div>
                        <label className="label">Expertise Topics</label>
                        <input
                            {...register('expertiseTopics')}
                            className="input"
                            placeholder="e.g., AI, startups, marketing, health"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Comma-separated list of topics you're an expert in.
                        </p>
                    </div>

                    <div>
                        <label className="label">Target Audience</label>
                        <textarea
                            {...register('targetAudience')}
                            className="input min-h-[80px]"
                            placeholder="Describe the type of podcast listeners you want to reach..."
                        />
                    </div>

                    <div>
                        <label className="label">Credentials</label>
                        <textarea
                            {...register('credentials')}
                            className="input min-h-[80px]"
                            placeholder="Your notable achievements, titles, publications, companies..."
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Saving...
                            </>
                        ) : saved ? (
                            <>
                                <Check className="h-4 w-4 mr-2" />
                                Saved!
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
