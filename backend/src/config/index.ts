import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
    env: process.env.NODE_ENV || 'development',
    environment: process.env.ENV || 'dev',

    server: {
        port: parseInt(process.env.PORT || '3001', 10),
        host: process.env.HOST || '0.0.0.0',
    },

    worker: {
        port: parseInt(process.env.WORKER_PORT || '3002', 10),
    },

    database: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/podcast_pitch',
    },

    auth: {
        jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
        jwtExpiresIn: '7d',
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },

    gcp: {
        projectId: process.env.GCP_PROJECT_ID || '',
        region: process.env.GCP_REGION || 'us-central1',
        cloudTasksQueue: process.env.CLOUD_TASKS_QUEUE || 'email-send-queue',
        cloudTasksLocation: process.env.CLOUD_TASKS_LOCATION || 'us-central1',
    },

    urls: {
        api: process.env.API_URL || 'http://localhost:3001',
        worker: process.env.WORKER_URL || 'http://localhost:3002',
        frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
    },

    ai: {
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    },

    email: {
        smartleadApiKey: process.env.SMARTLEAD_API_KEY || '',
        smartleadEnabled: process.env.SMARTLEAD_ENABLED === 'true',
    },

    limits: {
        defaultDailyLimit: parseInt(process.env.DEFAULT_DAILY_SEND_LIMIT || '50', 10),
        defaultMonthlyLimit: parseInt(process.env.DEFAULT_MONTHLY_SEND_LIMIT || '500', 10),
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
    },
};

// Validate required config in production
export function validateConfig(): void {
    if (config.env === 'production') {
        const required = [
            'DATABASE_URL',
            'JWT_SECRET',
            'GCP_PROJECT_ID',
        ];

        const missing = required.filter(key => !process.env[key]);

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }
}
