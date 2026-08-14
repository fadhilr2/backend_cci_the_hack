import { Router } from 'express';
import { getMemoryDoc, resetMemoryDoc } from '../services/memoryStore.js';

const router = Router();

// GET /api/v1/memory/doc/:layer/:key
router.get('/doc/:layer/:key', async (req, res, next) => {
  try {
    const { layer, key } = req.params;
    const doc = await getMemoryDoc(layer, key);
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/memory/doc/:layer/:key/reset
router.post('/doc/:layer/:key/reset', async (req, res, next) => {
  try {
    const { layer, key } = req.params;
    const result = await resetMemoryDoc(layer, key);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
