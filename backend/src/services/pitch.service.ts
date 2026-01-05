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
        // Build expertise string with fallback
        const expertiseStr = profile.expertiseTopics?.length > 0
            ? profile.expertiseTopics.join(', ')
            : 'various topics';

        // Build credentials with fallback
        const credentialsStr = profile.credentials?.trim()
            ? profile.credentials
            : profile.bio?.trim()
                ? 'experienced professional'
                : '';

        const prompt = `You are an expert at writing podcast guest pitch emails. Generate a personalized pitch email for the following:

GUEST PROFILE:
- Name: ${profile.name}
- Bio: ${profile.bio || 'A professional seeking podcast appearances'}
- Expertise Areas: ${expertiseStr}
- Target Audience: ${profile.targetAudience || 'General audience'}
- Credentials/Achievements: ${credentialsStr || 'Industry professional'}

PODCAST:
- Title: ${podcast.title}
- Host: ${podcast.hostName || 'the host'}
- Description: ${podcast.description || 'A podcast in the ' + (podcast.categories?.[0] || 'general') + ' space'}
- Categories/Topics: ${podcast.categories?.join(', ') || 'General'}

${additionalContext ? `ADDITIONAL CONTEXT FROM USER: ${additionalContext}` : ''}

CRITICAL INSTRUCTIONS:
1. Generate a COMPLETE, READY-TO-SEND email. Do NOT include any placeholder text, bracketed suggestions, or template markers.
2. NEVER use brackets like [mention something], [your company], [specific episode], [your name], or similar. Every word must be final.
3. SIGN THE EMAIL WITH "${profile.name}" - NOT with "[Your Name]" or any other placeholder.
4. Reference the podcast's focus areas based on the categories and description provided - do NOT ask the guest to fill in details.
5. Use the guest's actual bio, credentials, and expertise - do NOT create placeholders for them to fill.
6. Suggest 2-3 SPECIFIC topic ideas based on the overlap between guest expertise and podcast categories.
7. If you don't have specific information, make reasonable inferences or write general but complete statements.

The email should:
- Open with a genuine connection to the podcast's subject matter (based on categories/description)
- Clearly explain why ${profile.name} would be a valuable guest using their actual credentials
- Propose specific conversation topics that align with both parties
- Include a clear call to action
- End with "Best regards," or "Sincerely," followed by "${profile.name}" (the actual name, NOT a placeholder)
- Be professional, warm, and under 300 words

Respond in JSON format:
{
  "subject": "Email subject line (specific and compelling, no placeholders)",
  "body": "Full email body (complete and ready to send, signed with ${profile.name})"
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
