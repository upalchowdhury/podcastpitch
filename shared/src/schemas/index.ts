import { z } from 'zod';

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

export const googleAuthSchema = z.object({
    idToken: z.string().min(1, 'ID token is required'),
});

// =============================================================================
// USER PROFILE SCHEMAS
// =============================================================================

export const userProfileSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    bio: z.string().max(2000, 'Bio is too long'),
    expertiseTopics: z.array(z.string()).max(10, 'Maximum 10 expertise topics'),
    targetAudience: z.string().max(500, 'Target audience description is too long'),
    credentials: z.string().max(1000, 'Credentials is too long'),
});

export const updateProfileSchema = userProfileSchema.partial();

// =============================================================================
// EMAIL ACCOUNT SCHEMAS
// =============================================================================

export const smtpConfigSchema = z.object({
    host: z.string().min(1, 'SMTP host is required'),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean().default(true),
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
});

export const createEmailAccountSchema = z.object({
    providerType: z.enum(['smtp', 'smartlead']),
    fromName: z.string().min(1, 'From name is required').max(100),
    fromEmail: z.string().email('Invalid from email'),
    smtpConfig: smtpConfigSchema.optional(),
    smartleadApiKey: z.string().optional(),
}).refine(
    (data) => {
        if (data.providerType === 'smtp') {
            return data.smtpConfig !== undefined;
        }
        if (data.providerType === 'smartlead') {
            return data.smartleadApiKey !== undefined;
        }
        return true;
    },
    { message: 'Provider-specific configuration is required' }
);

// =============================================================================
// PODCAST SCHEMAS
// =============================================================================

export const podcastSearchSchema = z.object({
    query: z.string().optional(),
    categories: z.union([z.string(), z.array(z.string())])
        .transform(val => typeof val === 'string' ? [val] : val)
        .optional(),
    language: z.string().optional(),
    minAudienceSize: z.coerce.number().int().min(0).optional(),
    maxAudienceSize: z.coerce.number().int().min(0).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const podcastIngestionSchema = z.object({
    externalSource: z.string().min(1),
    externalId: z.string().min(1),
    title: z.string().min(1).max(500),
    description: z.string().max(10000),
    categories: z.array(z.string()),
    language: z.string().default('en'),
    hostName: z.string().max(200).nullable(),
    contactEmail: z.string().email().nullable(),
    website: z.string().url().nullable(),
    audienceSizeEstimate: z.number().int().min(0).nullable(),
    imageUrl: z.string().url().nullable(),
});

// =============================================================================
// TARGET LIST SCHEMAS
// =============================================================================

export const createTargetListSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
});

export const updateTargetListSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
});

export const addToTargetListSchema = z.object({
    podcastIds: z.array(z.string().uuid()).min(1, 'At least one podcast is required'),
});

// =============================================================================
// PITCH SCHEMAS
// =============================================================================

export const generatePitchSchema = z.object({
    podcastId: z.string().uuid('Invalid podcast ID'),
    additionalContext: z.string().max(1000).optional(),
});

export const updatePitchSchema = z.object({
    editedSubject: z.string().max(200).optional(),
    editedBody: z.string().max(10000).optional(),
});

export const regeneratePitchSchema = z.object({
    additionalContext: z.string().max(1000).optional(),
});

// =============================================================================
// SENDING SCHEMAS
// =============================================================================

export const scheduleSendSchema = z.object({
    pitchId: z.string().uuid('Invalid pitch ID'),
    scheduledAt: z.string().datetime().optional(), // ISO 8601, defaults to now
    emailAccountId: z.string().uuid('Invalid email account ID'),
    recipientEmail: z.string().email('Invalid recipient email').optional(),
});

export const bulkScheduleSendSchema = z.object({
    pitchIds: z.array(z.string().uuid()).min(1).max(100, 'Maximum 100 pitches per batch'),
    scheduledAt: z.string().datetime().optional(),
    emailAccountId: z.string().uuid('Invalid email account ID'),
    intervalMinutes: z.number().int().min(1).max(60).default(5), // Stagger sends
});

// =============================================================================
// RESPONSE TRACKING SCHEMAS
// =============================================================================

export const updateResponseSchema = z.object({
    status: z.enum(['no_response', 'interested', 'declined', 'booked']),
    notes: z.string().max(2000).nullable().optional(),
});

// =============================================================================
// PAGINATION SCHEMAS
// =============================================================================

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// ID PARAMS SCHEMA
// =============================================================================

export const idParamSchema = z.object({
    id: z.string().uuid('Invalid ID'),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SmtpConfigInput = z.infer<typeof smtpConfigSchema>;
export type CreateEmailAccountInput = z.infer<typeof createEmailAccountSchema>;
export type PodcastSearchInput = z.infer<typeof podcastSearchSchema>;
export type PodcastIngestionInput = z.infer<typeof podcastIngestionSchema>;
export type CreateTargetListInput = z.infer<typeof createTargetListSchema>;
export type UpdateTargetListInput = z.infer<typeof updateTargetListSchema>;
export type AddToTargetListInput = z.infer<typeof addToTargetListSchema>;
export type GeneratePitchInput = z.infer<typeof generatePitchSchema>;
export type UpdatePitchInput = z.infer<typeof updatePitchSchema>;
export type RegeneratePitchInput = z.infer<typeof regeneratePitchSchema>;
export type ScheduleSendInput = z.infer<typeof scheduleSendSchema>;
export type BulkScheduleSendInput = z.infer<typeof bulkScheduleSendSchema>;
export type UpdateResponseInput = z.infer<typeof updateResponseSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
