import { Router } from 'express';
import { getCatalogSettings, updateCatalogSettings } from '../services/catalogStore.js';

const router = Router();

// GET /api/v1/settings/catalog
router.get('/catalog', async (req, res, next) => {
  try {
    const catalog = await getCatalogSettings();
    res.json(catalog);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/settings/catalog
router.put('/catalog', async (req, res, next) => {
  try {
    const updated = await updateCatalogSettings(req.body);
    res.json({ status: 'success', catalog: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
