import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
    level: config.logging.level,
    ...(config.env === 'development' && {
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
