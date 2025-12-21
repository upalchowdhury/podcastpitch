import { Router } from 'express';
import { TrackingService } from '../services/tracking.service.js';

const router: ReturnType<typeof Router> = Router();

// GET /t/open - Tracking pixel endpoint
router.get('/open', async (req, res) => {
    const sendJobId = req.query.send_job_id as string;

    if (sendJobId) {
        // Record asynchronously, don't wait
        TrackingService.recordOpen(sendJobId).catch(() => { });
    }

    // Return 1x1 transparent GIF
    const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
    );

    res.set({
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    });

    res.send(pixel);
});

// GET /t/click - Click tracking redirect
router.get('/click', async (req, res) => {
    const sendJobId = req.query.send_job_id as string;
    const url = req.query.url as string;

    if (sendJobId && url) {
        // Record asynchronously
        TrackingService.recordClick(sendJobId, url).catch(() => { });
    }

    if (url) {
        res.redirect(url);
    } else {
        res.status(400).send('Missing URL');
    }
});

export default router;
