import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { ERROR_CODES } from '@podcast-pitch/shared';

export const errorHandler: ErrorRequestHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    // Log the error
    logger.error({
        err,
        method: req.method,
        url: req.url,
        userId: req.user?.userId,
    }, 'Request error');

    // Handle known application errors
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        });
        return;
    }

    // Handle unknown errors
    res.status(500).json({
        success: false,
        error: {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'An unexpected error occurred',
        },
    });
};

export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({
        success: false,
        error: {
            code: ERROR_CODES.NOT_FOUND,
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
}
