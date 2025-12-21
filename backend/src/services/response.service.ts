import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { responses, pitches } from '../db/schema.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { Response, UpdateResponseInput } from '@podcast-pitch/shared';

export class ResponseService {
    static async getByPitchId(userId: string, pitchId: string): Promise<Response | null> {
        // Verify pitch ownership
        const pitch = await db.query.pitches.findFirst({
            where: eq(pitches.id, pitchId),
        });

        if (!pitch) {
            throw new NotFoundError('Pitch');
        }

        if (pitch.userId !== userId) {
            throw new ForbiddenError('Not authorized to access this pitch');
        }

        const response = await db.query.responses.findFirst({
            where: eq(responses.pitchId, pitchId),
        });

        return response ? this.mapResponse(response) : null;
    }

    static async update(
        userId: string,
        pitchId: string,
        data: UpdateResponseInput
    ): Promise<Response> {
        // Verify pitch ownership
        const pitch = await db.query.pitches.findFirst({
            where: eq(pitches.id, pitchId),
        });

        if (!pitch) {
            throw new NotFoundError('Pitch');
        }

        if (pitch.userId !== userId) {
            throw new ForbiddenError('Not authorized to access this pitch');
        }

        // Upsert response
        const existing = await db.query.responses.findFirst({
            where: eq(responses.pitchId, pitchId),
        });

        if (existing) {
            const [updated] = await db
                .update(responses)
                .set({
                    status: data.status,
                    notes: data.notes,
                    updatedAt: new Date(),
                })
                .where(eq(responses.pitchId, pitchId))
                .returning();

            return this.mapResponse(updated);
        } else {
            const [created] = await db
                .insert(responses)
                .values({
                    pitchId,
                    status: data.status,
                    notes: data.notes,
                })
                .returning();

            return this.mapResponse(created);
        }
    }

    static async getUserResponses(userId: string): Promise<Response[]> {
        const results = await db
            .select({ response: responses })
            .from(responses)
            .innerJoin(pitches, eq(responses.pitchId, pitches.id))
            .where(eq(pitches.userId, userId));

        return results.map(r => this.mapResponse(r.response));
    }

    private static mapResponse(r: typeof responses.$inferSelect): Response {
        return {
            id: r.id,
            pitchId: r.pitchId,
            status: r.status as Response['status'],
            notes: r.notes,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
        };
    }
}
