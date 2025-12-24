import { useAuthStore } from './store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RequestOptions extends RequestInit {
    skipAuth?: boolean;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private getHeaders(skipAuth = false): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (!skipAuth) {
            const token = useAuthStore.getState().token;
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    async request<T>(
        endpoint: string,
        options: RequestOptions = {}
    ): Promise<T> {
        const { skipAuth, ...fetchOptions } = options;

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...fetchOptions,
            headers: {
                ...this.getHeaders(skipAuth),
                ...fetchOptions.headers,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                useAuthStore.getState().logout();
            }
            throw new ApiError(
                data.error?.message || 'Request failed',
                data.error?.code || 'UNKNOWN_ERROR',
                response.status
            );
        }

        return data.data;
    }

    get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}

export class ApiError extends Error {
    code: string;
    status: number;

    constructor(message: string, code: string, status: number) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

export const api = new ApiClient(API_URL);

// Auth API
export const authApi = {
    login: (email: string, password: string) =>
        api.post<{ user: any; token: string }>('/api/auth/login', { email, password }, { skipAuth: true }),

    register: (email: string, password: string, name: string) =>
        api.post<{ user: any; token: string }>('/api/auth/register', { email, password, name }, { skipAuth: true }),

    googleAuth: (idToken: string) =>
        api.post<{ user: any; token: string }>('/api/auth/google', { idToken }, { skipAuth: true }),

    me: () => api.get<{ user: any }>('/api/auth/me'),
};

// Profile API
export const profileApi = {
    get: () => api.get<any>('/api/profile'),
    update: (data: any) => api.put<any>('/api/profile', data),
};

// Podcast API
export const podcastApi = {
    search: (params: Record<string, any>) => {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                query.append(key, String(value));
            }
        });
        return api.get<any>(`/api/podcasts/search?${query.toString()}`);
    },
    getById: (id: string) => api.get<any>(`/api/podcasts/${id}`),
};

// Target List API
export const targetListApi = {
    getAll: () => api.get<any[]>('/api/target-lists'),
    create: (name: string) => api.post<any>('/api/target-lists', { name }),
    update: (id: string, name: string) => api.put<any>(`/api/target-lists/${id}`, { name }),
    delete: (id: string) => api.delete(`/api/target-lists/${id}`),
    getItems: (id: string) => api.get<any[]>(`/api/target-lists/${id}/items`),
    addItems: (id: string, podcastIds: string[]) =>
        api.post<any>(`/api/target-lists/${id}/items`, { podcastIds }),
    removeItem: (listId: string, podcastId: string) =>
        api.delete(`/api/target-lists/${listId}/items/${podcastId}`),
};

// Pitch API
export const pitchApi = {
    getAll: () => api.get<any[]>('/api/pitches'),
    getById: (id: string) => api.get<any>(`/api/pitches/${id}`),
    generate: (podcastId: string, additionalContext?: string) =>
        api.post<any>('/api/pitches/generate', { podcastId, additionalContext }),
    update: (id: string, data: any) => api.put<any>(`/api/pitches/${id}`, data),
    regenerate: (id: string, additionalContext?: string) =>
        api.post<any>(`/api/pitches/${id}/regenerate`, { additionalContext }),
    delete: (id: string) => api.delete(`/api/pitches/${id}`),
};

// Email Account API
export const emailAccountApi = {
    getAll: () => api.get<any[]>('/api/email-accounts'),
    create: (data: any) => api.post<any>('/api/email-accounts', data),
    delete: (id: string) => api.delete(`/api/email-accounts/${id}`),
    verify: (id: string) => api.post<any>(`/api/email-accounts/${id}/verify`),
    checkHealth: (id: string) => api.get<any>(`/api/email-accounts/${id}/health`),
};

// Send API
export const sendApi = {
    schedule: (pitchId: string, emailAccountId: string, scheduledAt?: string, recipientEmail?: string) =>
        api.post<any>('/api/send/schedule?v=2', { pitchId, emailAccountId, scheduledAt, recipientEmail }),
    bulkSchedule: (data: any) => api.post<any[]>('/api/send/bulk-schedule', data),
    getJobs: () => api.get<any[]>('/api/send/jobs'),
    cancelJob: (id: string) => api.post<any>(`/api/send/jobs/${id}/cancel`),
    getUsage: () => api.get<any>('/api/send/usage'),
};

// Response API
export const responseApi = {
    getAll: () => api.get<any[]>('/api/responses'),
    getByPitch: (pitchId: string) => api.get<any>(`/api/responses/pitch/${pitchId}`),
    update: (pitchId: string, data: any) => api.put<any>(`/api/responses/pitch/${pitchId}`, data),
};

// Dashboard API
export const dashboardApi = {
    getStats: () => api.get<any>('/api/dashboard/stats'),
    getActivity: (limit?: number) =>
        api.get<any[]>(`/api/dashboard/activity${limit ? `?limit=${limit}` : ''}`),
};
