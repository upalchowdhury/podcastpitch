import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { validateBody } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { loginSchema, registerSchema, googleAuthSchema } from '@podcast-pitch/shared';

const router = Router();

// POST /api/auth/register
router.post('/register', validateBody(registerSchema), async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        const result = await AuthService.register(email, password, name);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await AuthService.login(email, password);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/google
router.post('/google', validateBody(googleAuthSchema), async (req, res, next) => {
    try {
        const { idToken } = req.body;
        const result = await AuthService.googleAuth(idToken);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const user = await AuthService.getUserById(req.user!.userId);
        res.json({ success: true, data: { user } });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (_req, res) => {
    // JWT is stateless, so logout is handled client-side
    res.json({ success: true, data: { message: 'Logged out' } });
});

export default router;
