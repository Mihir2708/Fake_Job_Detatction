import { Router } from 'express';
import { executeSearch } from '../controllers/searchController.js';

const router = Router();

// POST /api/search
router.post('/', executeSearch);

export default router;
