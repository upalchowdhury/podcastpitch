import { ERROR_CODES } from '@podcast-pitch/shared';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: Record<string, unknown>;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = ERROR_CODES.INTERNAL_ERROR,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 400, ERROR_CODES.VALIDATION_ERROR, details);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
        super(message, 401, ERROR_CODES.UNAUTHORIZED);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
        super(message, 403, ERROR_CODES.FORBIDDEN);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, ERROR_CODES.CONFLICT);
    }
}

export class RateLimitError extends AppError {
    constructor(limitType: 'daily' | 'monthly') {
        const code = limitType === 'daily'
            ? ERROR_CODES.DAILY_LIMIT_EXCEEDED
            : ERROR_CODES.MONTHLY_LIMIT_EXCEEDED;
        super(`${limitType} send limit exceeded`, 429, code);
    }
}
