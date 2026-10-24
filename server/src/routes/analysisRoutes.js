import { Router } from 'express';
import {
  analyzeJob,
  getAnalysisHistory,
  getAnalysisById,
} from '../controllers/analysisController.js';

const router = Router();

// POST /api/analysis/analyze
router.post('/analyze', analyzeJob);

// GET /api/analysis/history
router.get('/history', getAnalysisHistory);

// GET /api/analysis/:id
router.get('/:id', getAnalysisById);

export default router;
