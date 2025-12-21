import { Router } from 'express';
import { PodcastService } from '../services/podcast.service.js';
import { validateQuery, validateParams } from '../middleware/validate.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { podcastSearchSchema, idParamSchema } from '@podcast-pitch/shared';

const router = Router();

// GET /api/podcasts/search
router.get(
    '/search',
    optionalAuthMiddleware,
    validateQuery(podcastSearchSchema),
    async (req, res, next) => {
        try {
            const result = await PodcastService.search(req.query as any);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

// GET /api/podcasts/:id
router.get(
    '/:id',
    optionalAuthMiddleware,
    validateParams(idParamSchema),
    async (req, res, next) => {
        try {
            const podcast = await PodcastService.getById(req.params.id);
            res.json({ success: true, data: podcast });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
