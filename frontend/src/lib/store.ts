'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserProfile } from '@podcast-pitch/shared';

interface AuthState {
    user: User | null;
    token: string | null;
    profile: UserProfile | null;
    isLoading: boolean;
    setAuth: (user: User, token: string) => void;
    setProfile: (profile: UserProfile) => void;
    logout: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            profile: null,
            isLoading: true,
            setAuth: (user, token) => set({ user, token, isLoading: false }),
            setProfile: (profile) => set({ profile }),
            logout: () => set({ user: null, token: null, profile: null, isLoading: false }),
            setLoading: (isLoading) => set({ isLoading }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                profile: state.profile,
            }),
        }
    )
);
