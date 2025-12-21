'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { authApi, profileApi } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
    const { token, setAuth, setProfile, setLoading, logout } = useAuthStore();

    useEffect(() => {
        const initAuth = async () => {
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const { user } = await authApi.me();
                const profile = await profileApi.get();
                setAuth(user, token);
                setProfile(profile);
            } catch (error) {
                logout();
            }
        };

        initAuth();
    }, []);

    return <>{children}</>;
}
