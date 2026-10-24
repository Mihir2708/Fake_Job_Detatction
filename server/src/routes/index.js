import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import analysisRoutes from './analysisRoutes.js';
import searchRoutes from './searchRoutes.js';

const router = Router();

// Mount sub-routes
router.use('/health', healthRoutes);
router.use('/analysis', analysisRoutes);
router.use('/search', searchRoutes);

export default router;
