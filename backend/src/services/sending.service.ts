import nodemailer from 'nodemailer';
import { eq, and, sql, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
    sendJobs,
    sendEvents,
    pitches,
    emailAccounts,
    userTiers,
    usageTracking,
    podcasts
} from '../db/schema.js';
import { config } from '../config/index.js';
import {
    NotFoundError,
    ForbiddenError,
    RateLimitError,
    AppError
} from '../utils/errors.js';
import { ERROR_CODES, SEND_JOB_CONFIG } from '@podcast-pitch/shared';
import { logger } from '../utils/logger.js';
import type { SendJob, SendEvent, UsageStats } from '@podcast-pitch/shared';

export class SendingService {
    static async scheduleSend(
        userId: string,
        pitchId: string,
        emailAccountId: string,
        scheduledAt?: Date
    ): Promise<SendJob> {
        // Verify pitch ownership
        const pitch = await db.query.pitches.findFirst({
            where: and(eq(pitches.id, pitchId), eq(pitches.userId, userId)),
        });

        if (!pitch) {
            throw new NotFoundError('Pitch');
        }

        // Verify email account ownership
        const emailAccount = await db.query.emailAccounts.findFirst({
            where: and(
                eq(emailAccounts.id, emailAccountId),
                eq(emailAccounts.userId, userId)
            ),
        });

        if (!emailAccount) {
            throw new NotFoundError('Email account');
        }

        // Check rate limits
        await this.checkRateLimits(userId);

        // Check for duplicate send
        const existingSend = await db.query.sendJobs.findFirst({
            where: and(
                eq(sendJobs.pitchId, pitchId),
                sql`${sendJobs.status} NOT IN ('failed', 'cancelled')`
            ),
        });

        if (existingSend) {
            throw new AppError(
                'A send job already exists for this pitch',
                409,
                ERROR_CODES.CONFLICT
            );
        }

        // Create send job
        const [job] = await db
            .insert(sendJobs)
            .values({
                pitchId,
                emailAccountId,
                scheduledAt: scheduledAt || new Date(),
                provider: emailAccount.providerType,
                status: 'pending',
            })
            .returning();

        // Create queued event
        await db.insert(sendEvents).values({
            sendJobId: job.id,
            eventType: 'queued',
        });

        // Update pitch status
        await db
            .update(pitches)
            .set({ status: 'scheduled', updatedAt: new Date() })
            .where(eq(pitches.id, pitchId));

        // TODO: Enqueue Cloud Tasks job for async processing
        // This would be done in production with Cloud Tasks

        return this.mapSendJob(job);
    }

    static async bulkScheduleSend(
        userId: string,
        pitchIds: string[],
        emailAccountId: string,
        scheduledAt?: Date,
        intervalMinutes: number = 5
    ): Promise<SendJob[]> {
        const jobs: SendJob[] = [];
        let currentSchedule = scheduledAt || new Date();

        for (const pitchId of pitchIds) {
            try {
                const job = await this.scheduleSend(
                    userId,
                    pitchId,
                    emailAccountId,
                    currentSchedule
                );
                jobs.push(job);

                // Stagger next send
                currentSchedule = new Date(currentSchedule.getTime() + intervalMinutes * 60 * 1000);
            } catch (error) {
                // Log error but continue with other pitches
                logger.warn({ pitchId, error }, 'Failed to schedule pitch');
            }
        }

        return jobs;
    }

    static async cancelJob(userId: string, jobId: string): Promise<SendJob> {
        const job = await this.getJobWithOwnerCheck(userId, jobId);

        if (job.status !== 'pending') {
            throw new AppError(
                'Only pending jobs can be cancelled',
                400,
                ERROR_CODES.VALIDATION_ERROR
            );
        }

        const [updated] = await db
            .update(sendJobs)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(sendJobs.id, jobId))
            .returning();

        // Update pitch status back to ready
        await db
            .update(pitches)
            .set({ status: 'ready', updatedAt: new Date() })
            .where(eq(pitches.id, job.pitchId));

        return this.mapSendJob(updated);
    }

    static async getUserJobs(userId: string): Promise<SendJob[]> {
        const jobs = await db
            .select({ job: sendJobs })
            .from(sendJobs)
            .innerJoin(pitches, eq(sendJobs.pitchId, pitches.id))
            .where(eq(pitches.userId, userId))
            .orderBy(sql`${sendJobs.scheduledAt} DESC`);

        return jobs.map(({ job }) => this.mapSendJob(job));
    }

    static async getUsageStats(userId: string): Promise<UsageStats> {
        const tier = await db.query.userTiers.findFirst({
            where: eq(userTiers.userId, userId),
        });

        if (!tier) {
            throw new NotFoundError('User tier');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Get daily usage
        const dailyUsage = await db.query.usageTracking.findFirst({
            where: and(
                eq(usageTracking.userId, userId),
                eq(usageTracking.date, today)
            ),
        });

        // Get monthly usage
        const [monthlyResult] = await db
            .select({ total: sql<number>`COALESCE(SUM(${usageTracking.emailsSent}), 0)::int` })
            .from(usageTracking)
            .where(
                and(
                    eq(usageTracking.userId, userId),
                    gte(usageTracking.date, startOfMonth)
                )
            );

        const dailySent = dailyUsage?.emailsSent || 0;
        const monthlySent = monthlyResult?.total || 0;

        return {
            dailySent,
            dailyRemaining: Math.max(0, tier.dailyLimit - dailySent),
            monthlySent,
            monthlyRemaining: Math.max(0, tier.monthlyLimit - monthlySent),
        };
    }

    static async processSendJob(jobId: string): Promise<void> {
        const jobLog = logger.child({ jobId });

        const job = await db.query.sendJobs.findFirst({
            where: eq(sendJobs.id, jobId),
        });

        if (!job || job.status !== 'pending') {
            jobLog.warn('Job not found or not pending');
            return;
        }

        // Mark as processing
        await db
            .update(sendJobs)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(sendJobs.id, jobId));

        await db.insert(sendEvents).values({
            sendJobId: jobId,
            eventType: 'processing',
        });

        try {
            // Get pitch and email account
            const pitch = await db.query.pitches.findFirst({
                where: eq(pitches.id, job.pitchId),
            });

            if (!pitch) {
                throw new Error('Pitch not found');
            }

            const emailAccount = await db.query.emailAccounts.findFirst({
                where: eq(emailAccounts.id, job.emailAccountId),
            });

            if (!emailAccount) {
                throw new Error('Email account not found');
            }

            const podcast = await db.query.podcasts.findFirst({
                where: eq(podcasts.id, pitch.podcastId),
            });

            if (!podcast || !podcast.contactEmail) {
                throw new Error('Podcast contact email not found');
            }

            // Get subject and body (prefer edited versions)
            const subject = pitch.editedSubject || pitch.generatedSubject;
            const body = pitch.editedBody || pitch.generatedBody;

            // Send email (SMTP implementation)
            if (emailAccount.providerType === 'smtp') {
                await this.sendViaSMTP(
                    emailAccount,
                    podcast.contactEmail,
                    subject,
                    body,
                    jobId
                );
            } else {
                throw new Error(`Provider ${emailAccount.providerType} not implemented`);
            }

            // Mark as sent
            await db
                .update(sendJobs)
                .set({ status: 'sent', updatedAt: new Date() })
                .where(eq(sendJobs.id, jobId));

            await db.insert(sendEvents).values({
                sendJobId: jobId,
                eventType: 'sent',
            });

            // Update pitch status
            await db
                .update(pitches)
                .set({ status: 'sent', updatedAt: new Date() })
                .where(eq(pitches.id, pitch.id));

            // Update usage tracking
            await this.incrementUsage(pitch.userId);

            jobLog.info('Job completed successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Increment attempts
            const newAttempts = job.attempts + 1;

            if (newAttempts >= SEND_JOB_CONFIG.maxAttempts) {
                // Mark as failed
                await db
                    .update(sendJobs)
                    .set({
                        status: 'failed',
                        attempts: newAttempts,
                        lastError: errorMessage,
                        updatedAt: new Date(),
                    })
                    .where(eq(sendJobs.id, jobId));

                await db.insert(sendEvents).values({
                    sendJobId: jobId,
                    eventType: 'failed',
                    metadata: { error: errorMessage },
                });

                // Update pitch status
                await db
                    .update(pitches)
                    .set({ status: 'failed', updatedAt: new Date() })
                    .where(eq(pitches.id, job.pitchId));
            } else {
                // Update for retry
                await db
                    .update(sendJobs)
                    .set({
                        status: 'pending',
                        attempts: newAttempts,
                        lastError: errorMessage,
                        scheduledAt: new Date(Date.now() + SEND_JOB_CONFIG.retryDelayMs),
                        updatedAt: new Date(),
                    })
                    .where(eq(sendJobs.id, jobId));
            }

            jobLog.error({ error: errorMessage }, 'Job failed');
        }
    }

    private static async sendViaSMTP(
        emailAccount: typeof emailAccounts.$inferSelect,
        to: string,
        subject: string,
        body: string,
        jobId: string
    ): Promise<void> {
        // In production, fetch SMTP config from Secret Manager
        // For now, we'll use a placeholder
        const transporter = nodemailer.createTransport({
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
                user: 'placeholder',
                pass: 'placeholder',
            },
        });

        // Add tracking pixel
        const trackingPixel = `<img src="${config.urls.api}/t/open?send_job_id=${jobId}" width="1" height="1" style="display:none" />`;
        const htmlBody = `${body.replace(/\n/g, '<br>')}\n${trackingPixel}`;

        await transporter.sendMail({
            from: `${emailAccount.fromName} <${emailAccount.fromEmail}>`,
            to,
            subject,
            text: body,
            html: htmlBody,
        });
    }

    private static async checkRateLimits(userId: string): Promise<void> {
        const stats = await this.getUsageStats(userId);

        if (stats.dailyRemaining <= 0) {
            throw new RateLimitError('daily');
        }

        if (stats.monthlyRemaining <= 0) {
            throw new RateLimitError('monthly');
        }
    }

    private static async incrementUsage(userId: string): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await db
            .insert(usageTracking)
            .values({
                userId,
                date: today,
                emailsSent: 1,
            })
            .onConflictDoUpdate({
                target: [usageTracking.userId, usageTracking.date],
                set: {
                    emailsSent: sql`${usageTracking.emailsSent} + 1`,
                },
            });
    }

    private static async getJobWithOwnerCheck(
        userId: string,
        jobId: string
    ): Promise<SendJob> {
        const result = await db
            .select({ job: sendJobs, pitch: pitches })
            .from(sendJobs)
            .innerJoin(pitches, eq(sendJobs.pitchId, pitches.id))
            .where(eq(sendJobs.id, jobId))
            .limit(1);

        if (result.length === 0) {
            throw new NotFoundError('Send job');
        }

        const { job, pitch } = result[0];

        if (pitch.userId !== userId) {
            throw new ForbiddenError('Not authorized to access this job');
        }

        return this.mapSendJob(job);
    }

    private static mapSendJob(job: typeof sendJobs.$inferSelect): SendJob {
        return {
            id: job.id,
            pitchId: job.pitchId,
            scheduledAt: job.scheduledAt,
            provider: job.provider as SendJob['provider'],
            status: job.status as SendJob['status'],
            attempts: job.attempts,
            lastError: job.lastError,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        };
    }
}
