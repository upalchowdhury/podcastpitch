'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi, profileApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Mic, Loader2 } from 'lucide-react';

const registerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const router = useRouter();
    const { setAuth, setProfile } = useAuthStore();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterForm) => {
        setError(null);
        setIsLoading(true);

        try {
            const { user, token } = await authApi.register(data.email, data.password, data.name);
            setAuth(user, token);

            try {
                const profile = await profileApi.get();
                setProfile(profile);
            } catch {
                // Profile fetch failed, continue anyway
            }

            router.push('/onboarding');
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <Link href="/" className="flex items-center gap-2">
                        <Mic className="h-10 w-10 text-primary-600" />
                        <span className="text-2xl font-bold text-gray-900">PodcastPitch</span>
                    </Link>
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
                    Create your account
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
                        Sign in
                    </Link>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-lg sm:rounded-xl sm:px-10">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {error && (
                            <div className="rounded-lg bg-red-50 p-4">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="name" className="label">
                                Full name
                            </label>
                            <input
                                {...register('name')}
                                type="text"
                                autoComplete="name"
                                className="input"
                                placeholder="John Doe"
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="email" className="label">
                                Email address
                            </label>
                            <input
                                {...register('email')}
                                type="email"
                                autoComplete="email"
                                className="input"
                                placeholder="you@example.com"
                            />
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className="label">
                                Password
                            </label>
                            <input
                                {...register('password')}
                                type="password"
                                autoComplete="new-password"
                                className="input"
                                placeholder="••••••••"
                            />
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                                Must be 8+ characters with uppercase, lowercase, and number
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Creating account...
                                </>
                            ) : (
                                'Create account'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
