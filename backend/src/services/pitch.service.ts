import { GoogleGenerativeAI } from '@google/generative-ai';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pitches, podcasts, userProfiles } from '../db/schema.js';
import { config } from '../config/index.js';
import { NotFoundError, ForbiddenError, ConflictError, AppError } from '../utils/errors.js';
import { AI_CONFIG, ERROR_CODES } from '@podcast-pitch/shared';
import type {
    Pitch,
    PitchWithPodcast,
    GeneratePitchResult,
    UpdatePitchInput
} from '@podcast-pitch/shared';

const genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);

export class PitchService {
    static async generate(
        userId: string,
        podcastId: string,
        additionalContext?: string
    ): Promise<Pitch> {
        // Check for existing pitch
        const existing = await db.query.pitches.findFirst({
            where: and(
                eq(pitches.userId, userId),
                eq(pitches.podcastId, podcastId)
            ),
        });

        if (existing) {
            throw new ConflictError('Pitch already exists for this podcast. Use regenerate instead.');
        }

        // Get user profile and podcast
        const [profile, podcast] = await Promise.all([
            db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) }),
            db.query.podcasts.findFirst({ where: eq(podcasts.id, podcastId) }),
        ]);

        if (!profile) {
            throw new NotFoundError('User profile');
        }

        if (!podcast) {
            throw new NotFoundError('Podcast');
        }

        // Generate pitch using AI
        const generated = await this.generateWithAI(profile, podcast, additionalContext);

        // Save pitch
        const [pitch] = await db
            .insert(pitches)
            .values({
                userId,
                podcastId,
                generatedSubject: generated.subject,
                generatedBody: generated.body,
                promptVersion: generated.promptVersion,
                status: 'draft',
            })
            .returning();

        return this.mapPitch(pitch);
    }

    static async regenerate(
        userId: string,
        pitchId: string,
        additionalContext?: string
    ): Promise<Pitch> {
        const pitch = await this.getPitchWithOwnerCheck(userId, pitchId);

        if (pitch.status === 'sent') {
            throw new AppError('Cannot regenerate a sent pitch', 400, ERROR_CODES.VALIDATION_ERROR);
        }

        // Get user profile and podcast
        const [profile, podcast] = await Promise.all([
            db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) }),
            db.query.podcasts.findFirst({ where: eq(podcasts.id, pitch.podcastId) }),
        ]);

        if (!profile || !podcast) {
            throw new NotFoundError('Profile or Podcast');
        }

        // Generate new pitch
        const generated = await this.generateWithAI(profile, podcast, additionalContext);

        // Update pitch
        const [updated] = await db
            .update(pitches)
            .set({
                generatedSubject: generated.subject,
                generatedBody: generated.body,
                editedSubject: null,
                editedBody: null,
                promptVersion: generated.promptVersion,
                status: 'draft',
                updatedAt: new Date(),
            })
            .where(eq(pitches.id, pitchId))
            .returning();

        return this.mapPitch(updated);
    }

    static async update(
        userId: string,
        pitchId: string,
        data: UpdatePitchInput
    ): Promise<Pitch> {
        const pitch = await this.getPitchWithOwnerCheck(userId, pitchId);

        if (pitch.status === 'sent') {
            throw new AppError('Cannot edit a sent pitch', 400, ERROR_CODES.VALIDATION_ERROR);
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() };

        if (data.editedSubject !== undefined) {
            updateData.editedSubject = data.editedSubject;
        }
        if (data.editedBody !== undefined) {
            updateData.editedBody = data.editedBody;
        }

        // If user has edited, mark as ready
        if (data.editedSubject || data.editedBody) {
            updateData.status = 'ready';
        }

        const [updated] = await db
            .update(pitches)
            .set(updateData)
            .where(eq(pitches.id, pitchId))
            .returning();

        return this.mapPitch(updated);
    }

    static async getById(userId: string, pitchId: string): Promise<PitchWithPodcast> {
        const result = await db
            .select({
                pitch: pitches,
                podcast: podcasts,
            })
            .from(pitches)
            .innerJoin(podcasts, eq(pitches.podcastId, podcasts.id))
            .where(eq(pitches.id, pitchId))
            .limit(1);

        if (result.length === 0) {
            throw new NotFoundError('Pitch');
        }

        const { pitch, podcast } = result[0];

        if (pitch.userId !== userId) {
            throw new ForbiddenError('Not authorized to access this pitch');
        }

        return {
            ...this.mapPitch(pitch),
            podcast: {
                id: podcast.id,
                externalSource: podcast.externalSource,
                externalId: podcast.externalId,
                title: podcast.title,
                description: podcast.description,
                categories: podcast.categories,
                language: podcast.language,
                hostName: podcast.hostName,
                contactEmail: podcast.contactEmail,
                website: podcast.websiteUrl,
                audienceSizeEstimate: podcast.audienceSizeEstimate,
                imageUrl: podcast.imageUrl,
                createdAt: podcast.createdAt,
                updatedAt: podcast.updatedAt,
            },
        };
    }

    static async getUserPitches(userId: string): Promise<PitchWithPodcast[]> {
        const results = await db
            .select({
                pitch: pitches,
                podcast: podcasts,
            })
            .from(pitches)
            .innerJoin(podcasts, eq(pitches.podcastId, podcasts.id))
            .where(eq(pitches.userId, userId))
            .orderBy(sql`${pitches.createdAt} DESC`);

        return results.map(({ pitch, podcast }) => ({
            ...this.mapPitch(pitch),
            podcast: {
                id: podcast.id,
                externalSource: podcast.externalSource,
                externalId: podcast.externalId,
                title: podcast.title,
                description: podcast.description,
                categories: podcast.categories,
                language: podcast.language,
                hostName: podcast.hostName,
                contactEmail: podcast.contactEmail,
                website: podcast.websiteUrl,
                audienceSizeEstimate: podcast.audienceSizeEstimate,
                imageUrl: podcast.imageUrl,
                createdAt: podcast.createdAt,
                updatedAt: podcast.updatedAt,
            },
        }));
    }

    static async delete(userId: string, pitchId: string): Promise<void> {
        const pitch = await this.getPitchWithOwnerCheck(userId, pitchId);

        if (pitch.status === 'sent') {
            throw new AppError('Cannot delete a sent pitch', 400, ERROR_CODES.VALIDATION_ERROR);
        }

        await db.delete(pitches).where(eq(pitches.id, pitchId));
    }

    private static async generateWithAI(
        profile: typeof userProfiles.$inferSelect,
        podcast: typeof podcasts.$inferSelect,
        additionalContext?: string
    ): Promise<GeneratePitchResult> {
        const prompt = `You are an expert at writing podcast guest pitch emails. Generate a personalized pitch email for the following:

GUEST PROFILE:
- Name: ${profile.name}
- Bio: ${profile.bio}
- Expertise: ${profile.expertiseTopics.join(', ')}
- Target Audience: ${profile.targetAudience}
- Credentials: ${profile.credentials}

PODCAST:
- Title: ${podcast.title}
- Host: ${podcast.hostName || 'Unknown'}
- Description: ${podcast.description}
- Categories: ${podcast.categories.join(', ')}

${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}

Generate a compelling, personalized pitch email. The email should:
1. Show genuine familiarity with the podcast
2. Clearly explain why the guest would be valuable
3. Suggest specific topics they could discuss
4. Be professional but warm in tone
5. Be concise (under 300 words)

Respond in JSON format:
{
  "subject": "Email subject line",
  "body": "Full email body"
}`;

        try {
            const model = genAI.getGenerativeModel({ model: config.ai.geminiModel || 'gemini-1.5-flash' });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            if (!content) {
                throw new Error('No response from AI');
            }

            // Extract JSON from response (Gemini may wrap it in markdown code blocks)
            let jsonStr = content;
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            }

            const parsed = JSON.parse(jsonStr.trim()) as { subject: string; body: string };

            return {
                subject: parsed.subject,
                body: parsed.body,
                promptVersion: AI_CONFIG.promptVersion,
            };
        } catch (error) {
            throw new AppError(
                'Failed to generate pitch',
                500,
                ERROR_CODES.PITCH_GENERATION_FAILED,
                { error: error instanceof Error ? error.message : 'Unknown error' }
            );
        }
    }

    private static async getPitchWithOwnerCheck(
        userId: string,
        pitchId: string
    ): Promise<Pitch> {
        const pitch = await db.query.pitches.findFirst({
            where: eq(pitches.id, pitchId),
        });

        if (!pitch) {
            throw new NotFoundError('Pitch');
        }

        if (pitch.userId !== userId) {
            throw new ForbiddenError('Not authorized to access this pitch');
        }

        return this.mapPitch(pitch);
    }

    private static mapPitch(p: typeof pitches.$inferSelect): Pitch {
        return {
            id: p.id,
            userId: p.userId,
            podcastId: p.podcastId,
            generatedSubject: p.generatedSubject,
            generatedBody: p.generatedBody,
            editedSubject: p.editedSubject,
            editedBody: p.editedBody,
            status: p.status as Pitch['status'],
            promptVersion: p.promptVersion,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        };
    }
}
