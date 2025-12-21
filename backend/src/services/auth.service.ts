import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userProfiles, userTiers } from '../db/schema.js';
import { config } from '../config/index.js';
import {
    UnauthorizedError,
    ConflictError,
    NotFoundError
} from '../utils/errors.js';
import { TIER_LIMITS } from '@podcast-pitch/shared';
import type { User, AuthResponse, AuthTokenPayload } from '@podcast-pitch/shared';

export class AuthService {
    private static readonly SALT_ROUNDS = 12;

    static async register(
        email: string,
        password: string,
        name: string
    ): Promise<AuthResponse> {
        // Check if email exists
        const existing = await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase()),
        });

        if (existing) {
            throw new ConflictError('Email already registered');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

        // Create user, profile, and tier in transaction
        const result = await db.transaction(async (tx) => {
            const [user] = await tx.insert(users).values({
                email: email.toLowerCase(),
                passwordHash,
                authProvider: 'email',
            }).returning();

            await tx.insert(userProfiles).values({
                userId: user.id,
                name,
            });

            await tx.insert(userTiers).values({
                userId: user.id,
                tierName: 'free',
                dailyLimit: TIER_LIMITS.free.dailyLimit,
                monthlyLimit: TIER_LIMITS.free.monthlyLimit,
            });

            return user;
        });

        return this.generateAuthResponse(result);
    }

    static async login(email: string, password: string): Promise<AuthResponse> {
        const user = await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase()),
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            throw new UnauthorizedError('Invalid credentials');
        }

        return this.generateAuthResponse(user);
    }

    static async googleAuth(idToken: string): Promise<AuthResponse> {
        // Verify Google ID token
        // In production, use Google's API to verify
        // For now, we'll decode and trust (implement proper verification)
        const decoded = jwt.decode(idToken) as { email?: string; name?: string } | null;

        if (!decoded?.email) {
            throw new UnauthorizedError('Invalid Google token');
        }

        let user = await db.query.users.findFirst({
            where: eq(users.email, decoded.email.toLowerCase()),
        });

        if (!user) {
            // Create new user
            const result = await db.transaction(async (tx) => {
                const [newUser] = await tx.insert(users).values({
                    email: decoded.email!.toLowerCase(),
                    authProvider: 'google',
                }).returning();

                await tx.insert(userProfiles).values({
                    userId: newUser.id,
                    name: decoded.name || '',
                });

                await tx.insert(userTiers).values({
                    userId: newUser.id,
                    tierName: 'free',
                    dailyLimit: TIER_LIMITS.free.dailyLimit,
                    monthlyLimit: TIER_LIMITS.free.monthlyLimit,
                });

                return newUser;
            });
            user = result;
        }

        return this.generateAuthResponse(user);
    }

    static async getUserById(userId: string): Promise<User> {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        if (!user) {
            throw new NotFoundError('User');
        }

        return {
            id: user.id,
            email: user.email,
            authProvider: user.authProvider as 'google' | 'email',
            createdAt: user.createdAt,
        };
    }

    private static generateAuthResponse(user: typeof users.$inferSelect): AuthResponse {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        const payload: AuthTokenPayload = {
            userId: user.id,
            email: user.email,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(expiresAt.getTime() / 1000),
        };

        const token = jwt.sign(payload, config.auth.jwtSecret);

        return {
            user: {
                id: user.id,
                email: user.email,
                authProvider: user.authProvider as 'google' | 'email',
                createdAt: user.createdAt,
            },
            token,
            expiresAt,
        };
    }
}
