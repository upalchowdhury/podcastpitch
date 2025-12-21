import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { AuthTokenPayload } from '@podcast-pitch/shared';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                email: string;
            };
        }
    }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.substring(7);

        const payload = jwt.verify(token, config.auth.jwtSecret) as AuthTokenPayload;

        req.user = {
            userId: payload.userId,
            email: payload.email,
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            next(new UnauthorizedError('Token expired'));
        } else if (error instanceof jwt.JsonWebTokenError) {
            next(new UnauthorizedError('Invalid token'));
        } else {
            next(error);
        }
    }
}

export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const payload = jwt.verify(token, config.auth.jwtSecret) as AuthTokenPayload;

            req.user = {
                userId: payload.userId,
                email: payload.email,
            };
        }

        next();
    } catch {
        // Ignore auth errors for optional auth
        next();
    }
}
