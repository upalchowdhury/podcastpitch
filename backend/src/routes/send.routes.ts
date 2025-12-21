import { Router } from 'express';
import { SendingService } from '../services/sending.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
    scheduleSendSchema,
    bulkScheduleSendSchema,
    idParamSchema
} from '@podcast-pitch/shared';

const router: ReturnType<typeof Router> = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/send/jobs
router.get('/jobs', async (req, res, next) => {
    try {
        const jobs = await SendingService.getUserJobs(req.user!.userId);
        res.json({ success: true, data: jobs });
    } catch (error) {
        next(error);
    }
});

// POST /api/send/schedule
router.post('/schedule', validateBody(scheduleSendSchema), async (req, res, next) => {
    try {
        const job = await SendingService.scheduleSend(
            req.user!.userId,
            req.body.pitchId,
            req.body.emailAccountId,
            req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined
        );
        res.status(201).json({ success: true, data: job });
    } catch (error) {
        next(error);
    }
});

// POST /api/send/bulk-schedule
router.post(
    '/bulk-schedule',
    validateBody(bulkScheduleSendSchema),
    async (req, res, next) => {
        try {
            const jobs = await SendingService.bulkScheduleSend(
                req.user!.userId,
                req.body.pitchIds,
                req.body.emailAccountId,
                req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
                req.body.intervalMinutes
            );
            res.status(201).json({ success: true, data: jobs });
        } catch (error) {
            next(error);
        }
    }
);

// GET /api/send/usage
router.get('/usage', async (req, res, next) => {
    try {
        const usage = await SendingService.getUsageStats(req.user!.userId);
        res.json({ success: true, data: usage });
    } catch (error) {
        next(error);
    }
});

// POST /api/send/jobs/:id/cancel
router.post('/jobs/:id/cancel', validateParams(idParamSchema), async (req, res, next) => {
    try {
        const job = await SendingService.cancelJob(req.user!.userId, req.params.id);
        res.json({ success: true, data: job });
    } catch (error) {
        next(error);
    }
});

export default router;
