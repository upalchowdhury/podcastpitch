import { Router } from 'express';
import { TargetListService } from '../services/targetList.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
    createTargetListSchema,
    updateTargetListSchema,
    addToTargetListSchema,
    idParamSchema
} from '@podcast-pitch/shared';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/target-lists
router.get('/', async (req, res, next) => {
    try {
        const lists = await TargetListService.getUserLists(req.user!.userId);
        res.json({ success: true, data: lists });
    } catch (error) {
        next(error);
    }
});

// POST /api/target-lists
router.post('/', validateBody(createTargetListSchema), async (req, res, next) => {
    try {
        const list = await TargetListService.create(req.user!.userId, req.body.name);
        res.status(201).json({ success: true, data: list });
    } catch (error) {
        next(error);
    }
});

// PUT /api/target-lists/:id
router.put(
    '/:id',
    validateParams(idParamSchema),
    validateBody(updateTargetListSchema),
    async (req, res, next) => {
        try {
            const list = await TargetListService.update(
                req.user!.userId,
                req.params.id,
                req.body.name
            );
            res.json({ success: true, data: list });
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /api/target-lists/:id
router.delete('/:id', validateParams(idParamSchema), async (req, res, next) => {
    try {
        await TargetListService.delete(req.user!.userId, req.params.id);
        res.json({ success: true, data: { message: 'List deleted' } });
    } catch (error) {
        next(error);
    }
});

// GET /api/target-lists/:id/items
router.get('/:id/items', validateParams(idParamSchema), async (req, res, next) => {
    try {
        const podcasts = await TargetListService.getListPodcasts(
            req.user!.userId,
            req.params.id
        );
        res.json({ success: true, data: podcasts });
    } catch (error) {
        next(error);
    }
});

// POST /api/target-lists/:id/items
router.post(
    '/:id/items',
    validateParams(idParamSchema),
    validateBody(addToTargetListSchema),
    async (req, res, next) => {
        try {
            const count = await TargetListService.addPodcasts(
                req.user!.userId,
                req.params.id,
                req.body.podcastIds
            );
            res.status(201).json({
                success: true,
                data: { added: count, message: `${count} podcasts added` }
            });
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /api/target-lists/:id/items/:podcastId
router.delete('/:id/items/:podcastId', async (req, res, next) => {
    try {
        await TargetListService.removePodcast(
            req.user!.userId,
            req.params.id,
            req.params.podcastId
        );
        res.json({ success: true, data: { message: 'Podcast removed from list' } });
    } catch (error) {
        next(error);
    }
});

export default router;
