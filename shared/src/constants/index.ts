// =============================================================================
// TIER CONFIGURATIONS
// =============================================================================

export const TIER_LIMITS = {
    free: {
        dailyLimit: 10,
        monthlyLimit: 50,
    },
    starter: {
        dailyLimit: 50,
        monthlyLimit: 500,
    },
    pro: {
        dailyLimit: 200,
        monthlyLimit: 3000,
    },
    enterprise: {
        dailyLimit: 1000,
        monthlyLimit: 20000,
    },
} as const;

// =============================================================================
// API ROUTES
// =============================================================================

export const API_ROUTES = {
    // Auth
    AUTH_LOGIN: '/api/auth/login',
    AUTH_REGISTER: '/api/auth/register',
    AUTH_GOOGLE: '/api/auth/google',
    AUTH_LOGOUT: '/api/auth/logout',
    AUTH_ME: '/api/auth/me',

    // Users & Profiles
    PROFILE: '/api/profile',
    PROFILE_UPDATE: '/api/profile',

    // Email Accounts
    EMAIL_ACCOUNTS: '/api/email-accounts',
    EMAIL_ACCOUNT: '/api/email-accounts/:id',
    EMAIL_ACCOUNT_VERIFY: '/api/email-accounts/:id/verify',
    EMAIL_ACCOUNT_HEALTH: '/api/email-accounts/:id/health',

    // Podcasts
    PODCASTS: '/api/podcasts',
    PODCAST: '/api/podcasts/:id',
    PODCASTS_SEARCH: '/api/podcasts/search',

    // Target Lists
    TARGET_LISTS: '/api/target-lists',
    TARGET_LIST: '/api/target-lists/:id',
    TARGET_LIST_ITEMS: '/api/target-lists/:id/items',
    TARGET_LIST_ITEM: '/api/target-lists/:id/items/:podcastId',

    // Pitches
    PITCHES: '/api/pitches',
    PITCH: '/api/pitches/:id',
    PITCH_GENERATE: '/api/pitches/generate',
    PITCH_REGENERATE: '/api/pitches/:id/regenerate',

    // Sending
    SEND_SCHEDULE: '/api/send/schedule',
    SEND_BULK_SCHEDULE: '/api/send/bulk-schedule',
    SEND_JOBS: '/api/send/jobs',
    SEND_JOB: '/api/send/jobs/:id',
    SEND_JOB_CANCEL: '/api/send/jobs/:id/cancel',

    // Tracking
    TRACKING_OPEN: '/t/open',
    TRACKING_CLICK: '/t/click',

    // Responses
    RESPONSES: '/api/responses',
    RESPONSE: '/api/responses/:id',

    // Dashboard & Analytics
    DASHBOARD_STATS: '/api/dashboard/stats',
    DASHBOARD_USAGE: '/api/dashboard/usage',
} as const;

// =============================================================================
// ERROR CODES
// =============================================================================

export const ERROR_CODES = {
    // Auth errors
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    TOKEN_INVALID: 'TOKEN_INVALID',
    UNAUTHORIZED: 'UNAUTHORIZED',

    // Resource errors
    NOT_FOUND: 'NOT_FOUND',
    FORBIDDEN: 'FORBIDDEN',
    CONFLICT: 'CONFLICT',

    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',

    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',
    MONTHLY_LIMIT_EXCEEDED: 'MONTHLY_LIMIT_EXCEEDED',

    // Email errors
    EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
    EMAIL_ACCOUNT_INVALID: 'EMAIL_ACCOUNT_INVALID',
    DOMAIN_HEALTH_WARNING: 'DOMAIN_HEALTH_WARNING',

    // Pitch errors
    PITCH_GENERATION_FAILED: 'PITCH_GENERATION_FAILED',
    DUPLICATE_PITCH: 'DUPLICATE_PITCH',

    // Server errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// =============================================================================
// PODCAST CATEGORIES
// =============================================================================

export const PODCAST_CATEGORIES = [
    'Arts',
    'Business',
    'Comedy',
    'Education',
    'Fiction',
    'Government',
    'Health & Fitness',
    'History',
    'Kids & Family',
    'Leisure',
    'Music',
    'News',
    'Religion & Spirituality',
    'Science',
    'Society & Culture',
    'Sports',
    'Technology',
    'True Crime',
    'TV & Film',
] as const;

// =============================================================================
// LANGUAGES
// =============================================================================

export const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'it', name: 'Italian' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ko', name: 'Korean' },
] as const;

// =============================================================================
// SEND JOB CONFIG
// =============================================================================

export const SEND_JOB_CONFIG = {
    maxAttempts: 3,
    retryDelayMs: 60000, // 1 minute
    taskTimeoutSeconds: 300, // 5 minutes
} as const;

// =============================================================================
// AI CONFIG
// =============================================================================

export const AI_CONFIG = {
    defaultModel: 'gpt-4-turbo-preview',
    maxTokens: 1500,
    temperature: 0.7,
    promptVersion: '1.0.0',
} as const;

// =============================================================================
// DOMAIN HEALTH CONFIG
// =============================================================================

export const DOMAIN_HEALTH_CONFIG = {
    dkimSelectors: ['google', 'selector1', 'selector2', 'default'],
    cacheTtlMs: 3600000, // 1 hour
} as const;
