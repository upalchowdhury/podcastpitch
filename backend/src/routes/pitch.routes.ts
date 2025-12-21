import { Router } from 'express';
import { PitchService } from '../services/pitch.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
    generatePitchSchema,
    updatePitchSchema,
    regeneratePitchSchema,
    idParamSchema
} from '@podcast-pitch/shared';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/pitches
router.get('/', async (req, res, next) => {
    try {
        const pitches = await PitchService.getUserPitches(req.user!.userId);
        res.json({ success: true, data: pitches });
    } catch (error) {
        next(error);
    }
});

// POST /api/pitches/generate
router.post('/generate', validateBody(generatePitchSchema), async (req, res, next) => {
    try {
        const pitch = await PitchService.generate(
            req.user!.userId,
            req.body.podcastId,
            req.body.additionalContext
        );
        res.status(201).json({ success: true, data: pitch });
    } catch (error) {
        next(error);
    }
});

// GET /api/pitches/:id
router.get('/:id', validateParams(idParamSchema), async (req, res, next) => {
    try {
        const pitch = await PitchService.getById(req.user!.userId, req.params.id);
        res.json({ success: true, data: pitch });
    } catch (error) {
        next(error);
    }
});

// PUT /api/pitches/:id
router.put(
    '/:id',
    validateParams(idParamSchema),
    validateBody(updatePitchSchema),
    async (req, res, next) => {
        try {
            const pitch = await PitchService.update(
                req.user!.userId,
                req.params.id,
                req.body
            );
            res.json({ success: true, data: pitch });
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/pitches/:id/regenerate
router.post(
    '/:id/regenerate',
    validateParams(idParamSchema),
    validateBody(regeneratePitchSchema),
    async (req, res, next) => {
        try {
            const pitch = await PitchService.regenerate(
                req.user!.userId,
                req.params.id,
                req.body.additionalContext
            );
            res.json({ success: true, data: pitch });
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /api/pitches/:id
router.delete('/:id', validateParams(idParamSchema), async (req, res, next) => {
    try {
        await PitchService.delete(req.user!.userId, req.params.id);
        res.json({ success: true, data: { message: 'Pitch deleted' } });
    } catch (error) {
        next(error);
    }
});

export default router;
