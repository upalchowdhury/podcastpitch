import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { config, validateConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { errorHandler, notFoundHandler } from '../middleware/error.js';
import { checkDatabaseConnection } from '../db/index.js';

// Import routes
import authRoutes from '../routes/auth.routes.js';
import profileRoutes from '../routes/profile.routes.js';
import podcastRoutes from '../routes/podcast.routes.js';
import targetListRoutes from '../routes/targetList.routes.js';
import pitchRoutes from '../routes/pitch.routes.js';
import emailAccountRoutes from '../routes/emailAccount.routes.js';
import sendRoutes from '../routes/send.routes.js';
import responseRoutes from '../routes/response.routes.js';
import dashboardRoutes from '../routes/dashboard.routes.js';
import trackingRoutes from '../routes/tracking.routes.js';

// Validate config
validateConfig();

const app: Express = express();

// Trust proxy for Cloud Run
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
    origin: config.urls.frontend,
    credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    // Disable trust proxy validation since Cloud Run is a trusted proxy
    validate: { trustProxy: false },
});
app.use('/api/', limiter);

// Request logging
app.use(pinoHttp({ logger }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', async (req, res) => {
    const dbHealthy = await checkDatabaseConnection();

    if (dbHealthy) {
        res.json({ status: 'healthy', database: 'connected' });
    } else {
        res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
    }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/podcasts', podcastRoutes);
app.use('/api/target-lists', targetListRoutes);
app.use('/api/pitches', pitchRoutes);
app.use('/api/email-accounts', emailAccountRoutes);
app.use('/api/send', sendRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Tracking routes (no /api prefix)
app.use('/t', trackingRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const port = config.server.port;
const host = config.server.host;

app.listen(port, host, () => {
    logger.info({ port, host, env: config.env }, 'API server started');
});

export default app;
