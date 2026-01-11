import { Router } from 'express';
import { PodcastService } from '../services/podcast.service.js';
import { validateQuery, validateParams } from '../middleware/validate.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { podcastSearchSchema, idParamSchema } from '@podcast-pitch/shared';

const router: ReturnType<typeof Router> = Router();

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

// GET /api/podcasts/search/v2
// Enhanced search with topics, FTS, and trigram matching
router.get(
    '/search/v2',
    optionalAuthMiddleware,
    validateQuery(podcastSearchSchema),
    async (req, res, next) => {
        try {
            const result = await PodcastService.searchEnhanced(req.query as any);
            res.json({
                success: true,
                data: result,
                meta: {
                    queryIntent: result.queryIntent,
                    resolvedTopics: result.resolvedTopics.map(t => ({
                        slug: t.slug,
                        displayName: t.displayName,
                        matchedVia: t.matchedVia,
                    })),
                },
            });
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
