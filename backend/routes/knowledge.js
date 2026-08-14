import { Router } from 'express';
import multer from 'multer';
import {
  listKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  saveDocumentToKnowledgeBase
} from '../services/knowledgeStore.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/v1/knowledge/list
router.get('/list', async (req, res, next) => {
  try {
    const list = await listKnowledgeBases();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/knowledge/create
router.post('/create', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Knowledge base "name" is required.' });
    }

    const result = await createKnowledgeBase(name, description);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/knowledge/:kb_name/documents/upload
router.post('/:kb_name/documents/upload', upload.single('file'), async (req, res, next) => {
  try {
    const { kb_name } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No document file uploaded.' });
    }

    const result = await saveDocumentToKnowledgeBase(kb_name, req.file);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/knowledge/:kb_name
router.delete('/:kb_name', async (req, res, next) => {
  try {
    const { kb_name } = req.params;
    const result = await deleteKnowledgeBase(kb_name);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
