import pino from 'pino';
import { config } from '../config/index.js';

// Use plain JSON logging - pipe through pino-pretty locally if needed:
// pnpm dev | pnpm pino-pretty
export const logger = pino({
    level: config.logging.level,
});

export function createChildLogger(context: Record<string, unknown>) {
    return logger.child(context);
}

