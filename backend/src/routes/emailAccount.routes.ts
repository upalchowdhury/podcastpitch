import { Router } from 'express';
import { EmailAccountService } from '../services/emailAccount.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { createEmailAccountSchema, idParamSchema } from '@podcast-pitch/shared';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/email-accounts
router.get('/', async (req, res, next) => {
    try {
        const accounts = await EmailAccountService.getUserAccounts(req.user!.userId);
        res.json({ success: true, data: accounts });
    } catch (error) {
        next(error);
    }
});

// POST /api/email-accounts
router.post('/', validateBody(createEmailAccountSchema), async (req, res, next) => {
    try {
        const account = await EmailAccountService.create(req.user!.userId, req.body);
        res.status(201).json({ success: true, data: account });
    } catch (error) {
        next(error);
    }
});

// GET /api/email-accounts/:id
router.get('/:id', validateParams(idParamSchema), async (req, res, next) => {
    try {
        const account = await EmailAccountService.getById(
            req.user!.userId,
            req.params.id
        );
        res.json({ success: true, data: account });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/email-accounts/:id
router.delete('/:id', validateParams(idParamSchema), async (req, res, next) => {
    try {
        await EmailAccountService.delete(req.user!.userId, req.params.id);
        res.json({ success: true, data: { message: 'Email account deleted' } });
    } catch (error) {
        next(error);
    }
});

// POST /api/email-accounts/:id/verify
router.post('/:id/verify', validateParams(idParamSchema), async (req, res, next) => {
    try {
        const verified = await EmailAccountService.verify(
            req.user!.userId,
            req.params.id
        );
        res.json({ success: true, data: { verified } });
    } catch (error) {
        next(error);
    }
});

// GET /api/email-accounts/:id/health
router.get('/:id/health', validateParams(idParamSchema), async (req, res, next) => {
    try {
        // First verify ownership
        await EmailAccountService.getById(req.user!.userId, req.params.id);
        const health = await EmailAccountService.checkDomainHealth(req.params.id);
        res.json({ success: true, data: health });
    } catch (error) {
        next(error);
    }
});

export default router;
