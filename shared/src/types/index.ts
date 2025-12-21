// =============================================================================
// USER & AUTH TYPES
// =============================================================================

export type AuthProvider = 'google' | 'email';

export interface User {
    id: string;
    email: string;
    authProvider: AuthProvider;
    createdAt: Date;
}

export interface UserProfile {
    userId: string;
    name: string;
    bio: string;
    expertiseTopics: string[];
    targetAudience: string;
    credentials: string;
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// EMAIL ACCOUNT TYPES
// =============================================================================

export type EmailProviderType = 'smtp' | 'smartlead';

export type EmailHealthStatus = 'healthy' | 'warning' | 'error' | 'unchecked';

export interface EmailAccount {
    id: string;
    userId: string;
    providerType: EmailProviderType;
    encryptedSecretRef: string; // Reference to Secret Manager
    fromName: string;
    fromEmail: string;
    domain: string;
    healthStatus: EmailHealthStatus;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface DomainHealthCheck {
    spf: {
        valid: boolean;
        record: string | null;
    };
    dkim: {
        valid: boolean;
        selector: string | null;
    };
    dmarc: {
        valid: boolean;
        policy: string | null;
    };
    checkedAt: Date;
}

// =============================================================================
// PODCAST TYPES
// =============================================================================

export interface Podcast {
    id: string;
    externalSource: string;
    externalId: string;
    title: string;
    description: string;
    categories: string[];
    language: string;
    hostName: string | null;
    contactEmail: string | null;
    website: string | null;
    audienceSizeEstimate: number | null;
    imageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface PodcastSearchParams {
    query?: string;
    categories?: string[];
    language?: string;
    minAudienceSize?: number;
    maxAudienceSize?: number;
    page?: number;
    limit?: number;
}

export interface PodcastSearchResult {
    podcasts: Podcast[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

// =============================================================================
// TARGET LIST TYPES
// =============================================================================

export interface TargetList {
    id: string;
    userId: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface TargetListItem {
    listId: string;
    podcastId: string;
    addedAt: Date;
}

export interface TargetListWithCount extends TargetList {
    podcastCount: number;
}

// =============================================================================
// PITCH TYPES
// =============================================================================

export type PitchStatus = 'draft' | 'ready' | 'scheduled' | 'sent' | 'failed';

export interface Pitch {
    id: string;
    userId: string;
    podcastId: string;
    generatedSubject: string;
    generatedBody: string;
    editedSubject: string | null;
    editedBody: string | null;
    status: PitchStatus;
    promptVersion: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface PitchWithPodcast extends Pitch {
    podcast: Podcast;
}

export interface GeneratePitchInput {
    podcastId: string;
    additionalContext?: string;
}

export interface GeneratePitchResult {
    subject: string;
    body: string;
    promptVersion: string;
}

// =============================================================================
// SENDING PIPELINE TYPES
// =============================================================================

export type SendJobStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface SendJob {
    id: string;
    pitchId: string;
    scheduledAt: Date;
    provider: EmailProviderType;
    status: SendJobStatus;
    attempts: number;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type SendEventType =
    | 'queued'
    | 'processing'
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'clicked'
    | 'bounced'
    | 'failed';

export interface SendEvent {
    id: string;
    sendJobId: string;
    eventType: SendEventType;
    timestamp: Date;
    metadata: Record<string, unknown>;
}

// =============================================================================
// RESPONSE TRACKING TYPES
// =============================================================================

export type ResponseStatus = 'no_response' | 'interested' | 'declined' | 'booked';

export interface Response {
    id: string;
    pitchId: string;
    status: ResponseStatus;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// BILLING & LIMITS TYPES
// =============================================================================

export type TierName = 'free' | 'starter' | 'pro' | 'enterprise';

export interface UserTier {
    userId: string;
    tierName: TierName;
    dailyLimit: number;
    monthlyLimit: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface UsageStats {
    dailySent: number;
    dailyRemaining: number;
    monthlySent: number;
    monthlyRemaining: number;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

// =============================================================================
// AUTH TYPES
// =============================================================================

export interface AuthTokenPayload {
    userId: string;
    email: string;
    iat: number;
    exp: number;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
}

export interface AuthResponse {
    user: User;
    token: string;
    expiresAt: Date;
}

export interface GoogleAuthRequest {
    idToken: string;
}
