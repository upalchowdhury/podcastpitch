'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { clsx } from 'clsx';
import {
    Mic,
    LayoutDashboard,
    Search,
    List,
    Mail,
    Settings,
    MessageSquare,
    Send,
    LogOut,
    User,
} from 'lucide-react';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Podcast Search', href: '/podcasts', icon: Search },
    { name: 'Target Lists', href: '/lists', icon: List },
    { name: 'My Pitches', href: '/pitches', icon: Mail },
    { name: 'Send Queue', href: '/send', icon: Send },
    { name: 'Responses', href: '/responses', icon: MessageSquare },
];

const secondaryNavigation = [
    { name: 'Email Accounts', href: '/settings/email', icon: Mail },
    { name: 'Profile', href: '/settings/profile', icon: User },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user, profile, logout } = useAuthStore();

    return (
        <div className="flex h-full w-64 flex-col bg-gray-900">
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 px-4 border-b border-gray-800">
                <Mic className="h-8 w-8 text-primary-500" />
                <span className="text-xl font-bold text-white">PodcastPitch</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={clsx(
                                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary-600 text-white'
                                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.name}
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                <div className="mt-8">
                    <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Settings
                    </h3>
                    <ul className="mt-2 space-y-1">
                        {secondaryNavigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className={clsx(
                                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                            isActive
                                                ? 'bg-gray-800 text-white'
                                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                        )}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {item.name}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </nav>

            {/* User section */}
            <div className="border-t border-gray-800 p-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                            {profile?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                            {profile?.name || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={() => {
                            logout();
                            window.location.href = '/login';
                        }}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
