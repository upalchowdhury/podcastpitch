import { Router } from 'express';
import { ProfileService } from '../services/profile.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { updateProfileSchema } from '@podcast-pitch/shared';

const router: ReturnType<typeof Router> = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/profile
router.get('/', async (req, res, next) => {
    try {
        const profile = await ProfileService.getProfile(req.user!.userId);
        res.json({ success: true, data: profile });
    } catch (error) {
        next(error);
    }
});

// PUT /api/profile
router.put('/', validateBody(updateProfileSchema), async (req, res, next) => {
    try {
        const profile = await ProfileService.updateProfile(req.user!.userId, req.body);
        res.json({ success: true, data: profile });
    } catch (error) {
        next(error);
    }
});

export default router;
