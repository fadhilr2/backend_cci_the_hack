import { Router } from 'express';
import { DEEPTUTOR_SERVICE_URL } from '../config.js';

const router = Router();

// POST /api/v1/roadmap/generate
router.post('/generate', async (req, res, next) => {
  try {
    const { topic } = req.body;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Field "topic" is required.' });
    }

    // Try proxying to deeptutor Python service if available
    try {
      const response = await fetch(`${DEEPTUTOR_SERVICE_URL}/api/v1/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (proxyErr) {
      // Deeptutor service unavailable, generate local fallback STEM roadmap
    }

    // Default STEM learning timeline fallback (6-10 steps)
    const fallbackRoadmap = {
      topic,
      generated_at: new Date().toISOString(),
      timeline_steps: [
        { step: 1, title: `Introduction to ${topic}`, description: `Foundational concepts and core principles of ${topic}.` },
        { step: 2, title: 'Prerequisite Mathematical & Analytical Tools', description: 'Essential math and conceptual modeling techniques.' },
        { step: 3, title: 'Core Mechanics & Operations', description: 'Detailed breakdown of standard mechanisms and equations.' },
        { step: 4, title: 'Diagnostic Misconception Check', description: 'Interactive quiz and problem solving exercises.' },
        { step: 5, title: 'Advanced Applications & Problem Solving', description: 'Applying theory to practical STEM problems.' },
        { step: 6, title: 'Capstone Project & Synthesis', description: 'Consolidation of learned material into a comprehensive project.' }
      ]
    };

    res.json(fallbackRoadmap);
  } catch (err) {
    next(err);
  }
});

export default router;
