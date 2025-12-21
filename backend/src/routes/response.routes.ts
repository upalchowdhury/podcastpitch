import { Router } from 'express';
import { ResponseService } from '../services/response.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { updateResponseSchema, idParamSchema } from '@podcast-pitch/shared';

const router: ReturnType<typeof Router> = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/responses
router.get('/', async (req, res, next) => {
    try {
        const responses = await ResponseService.getUserResponses(req.user!.userId);
        res.json({ success: true, data: responses });
    } catch (error) {
        next(error);
    }
});

// GET /api/responses/pitch/:pitchId
router.get('/pitch/:pitchId', async (req, res, next) => {
    try {
        const response = await ResponseService.getByPitchId(
            req.user!.userId,
            req.params.pitchId
        );
        res.json({ success: true, data: response });
    } catch (error) {
        next(error);
    }
});

// PUT /api/responses/pitch/:pitchId
router.put(
    '/pitch/:pitchId',
    validateBody(updateResponseSchema),
    async (req, res, next) => {
        try {
            const response = await ResponseService.update(
                req.user!.userId,
                req.params.pitchId,
                req.body
            );
            res.json({ success: true, data: response });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
