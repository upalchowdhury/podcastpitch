import { Router } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await DashboardService.getStats(req.user!.userId);
        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
});

// GET /api/dashboard/activity
router.get('/activity', async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const activity = await DashboardService.getRecentActivity(
            req.user!.userId,
            limit
        );
        res.json({ success: true, data: activity });
    } catch (error) {
        next(error);
    }
});

export default router;
