import pino from 'pino';
import { config } from '../config/index.js';

// Only use pino-pretty in local development (when NODE_ENV is explicitly 'development')
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
    level: config.logging.level,
    // Only use pino-pretty transport in local development
    ...(isDevelopment && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
            },
        },
    }),
});

export function createChildLogger(context: Record<string, unknown>) {
    return logger.child(context);
}
