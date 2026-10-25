import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import analysisRoutes from './analysisRoutes.js';
import searchRoutes from './searchRoutes.js';

const router = Router();

// Base route for /api
router.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Fake Job Detection API service',
    endpoints: {
      health: '/api/health',
      analyze: '/api/analysis/analyze',
      history: '/api/analysis/history',
    },
  });
});

// Mount sub-routes
router.use('/health', healthRoutes);
router.use('/analysis', analysisRoutes);
router.use('/search', searchRoutes);

export default router;
