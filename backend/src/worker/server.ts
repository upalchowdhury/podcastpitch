import express, { Express } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { SendingService } from '../services/sending.service.js';
import { checkDatabaseConnection } from '../db/index.js';

const app: Express = express();

// Body parsing
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
    const dbHealthy = await checkDatabaseConnection();

    if (dbHealthy) {
        res.json({ status: 'healthy', database: 'connected' });
    } else {
        res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
    }
});

// Cloud Tasks webhook endpoint
app.post('/tasks/send-email', async (req, res) => {
    const workerLog = logger.child({ handler: 'send-email' });

    try {
        const { jobId } = req.body;

        if (!jobId) {
            workerLog.warn('Missing jobId in request');
            res.status(400).json({ error: 'Missing jobId' });
            return;
        }

        workerLog.info({ jobId }, 'Processing send job');

        await SendingService.processSendJob(jobId);

        res.json({ success: true });
    } catch (error) {
        workerLog.error({ error }, 'Failed to process send job');
        res.status(500).json({ error: 'Processing failed' });
    }
});

// Start server
const port = config.worker.port;

app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Worker server started');
});

export default app;
