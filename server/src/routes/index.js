import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import analysisRoutes from './analysisRoutes.js';

const router = Router();

// Mount sub-routes
router.use('/health', healthRoutes);
router.use('/analysis', analysisRoutes);

export default router;
