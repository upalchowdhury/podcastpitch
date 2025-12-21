import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            const data = req[target];
            const parsed = schema.parse(data);
            req[target] = parsed;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const path = err.path.join('.');
                    acc[path] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(new ValidationError('Validation failed', details));
            } else {
                next(error);
            }
        }
    };
}

export const validateBody = (schema: ZodSchema) => validate(schema, 'body');
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');
