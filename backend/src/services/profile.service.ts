import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userProfiles } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import type { UserProfile, UpdateProfileInput } from '@podcast-pitch/shared';

export class ProfileService {
    static async getProfile(userId: string): Promise<UserProfile> {
        const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.userId, userId),
        });

        if (!profile) {
            throw new NotFoundError('Profile');
        }

        return {
            userId: profile.userId,
            name: profile.name,
            bio: profile.bio,
            expertiseTopics: profile.expertiseTopics,
            targetAudience: profile.targetAudience,
            credentials: profile.credentials,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
        };
    }

    static async updateProfile(
        userId: string,
        data: UpdateProfileInput
    ): Promise<UserProfile> {
        const [updated] = await db
            .update(userProfiles)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(userProfiles.userId, userId))
            .returning();

        if (!updated) {
            throw new NotFoundError('Profile');
        }

        return {
            userId: updated.userId,
            name: updated.name,
            bio: updated.bio,
            expertiseTopics: updated.expertiseTopics,
            targetAudience: updated.targetAudience,
            credentials: updated.credentials,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
        };
    }
}
