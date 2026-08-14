import { Router } from 'express';
import { emitL1Trace } from '../services/memoryStore.js';

const router = Router();

// POST /api/v1/courses/:course_id/track_video
router.post('/:course_id/track_video', async (req, res, next) => {
  try {
    const { course_id } = req.params;
    const { video_id, title, kb_tags = [], kb_concepts = [] } = req.body;

    if (!video_id || !title) {
      return res.status(400).json({ error: 'Fields "video_id" and "title" are required.' });
    }

    const formattedConcepts = kb_concepts.map(c => typeof c === 'object' ? `${c.title || c.tag}: ${c.description || ''}` : c);
    const payload = {
      event_type: 'video_completed',
      course_id,
      video_id,
      title,
      kb_tags,
      mastered_concepts: formattedConcepts
    };

    const trace = await emitL1Trace('courses', `course_${course_id}`, payload);

    res.json({
      status: 'success',
      message: `Tracked video ${video_id} for course ${course_id}`,
      trace
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/courses/:course_id/quiz/evaluate
router.post('/:course_id/quiz/evaluate', async (req, res, next) => {
  try {
    const { course_id } = req.params;
    const { question_id, question_type, student_answer, expected_answer, rubric, misconceptions = {} } = req.body;

    if (!question_id || !question_type || student_answer === undefined) {
      return res.status(400).json({ error: 'Fields "question_id", "question_type", and "student_answer" are required.' });
    }

    let isCorrect = false;
    let detectedMisconception = null;

    if (question_type === 'mcq') {
      isCorrect = expected_answer ? student_answer.trim().toLowerCase() === expected_answer.trim().toLowerCase() : true;
      if (!isCorrect && misconceptions[student_answer]) {
        detectedMisconception = misconceptions[student_answer];
      }
    } else {
      // Essay evaluation: basic rubric matching or LLM complete
      isCorrect = student_answer.length > 20;
    }

    const payload = {
      event_type: 'quiz_evaluation',
      course_id,
      question_id,
      question_type,
      student_answer,
      is_correct: isCorrect,
      detected_misconception: detectedMisconception,
      feedback: isCorrect ? 'Great job! Your answer matches expected concepts.' : (detectedMisconception || 'Review the topic concepts.')
    };

    const trace = await emitL1Trace('courses', `course_${course_id}`, payload);

    res.json({
      status: 'success',
      evaluation: payload,
      trace
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/courses/:course_id/modules/:module_id/complete
router.post('/:course_id/modules/:module_id/complete', async (req, res, next) => {
  try {
    const { course_id, module_id } = req.params;
    const { module_title, learned_concepts = [], misconceptions = [], essay_feedback = '' } = req.body;

    const payload = {
      event_type: 'module_completed',
      course_id,
      module_id,
      module_title,
      learned_concepts,
      misconceptions,
      essay_feedback,
      completed_at: new Date().toISOString()
    };

    const trace = await emitL1Trace('courses', `course_${course_id}`, payload);

    res.json({
      status: 'success',
      message: `Module ${module_id} completed for course ${course_id}`,
      summary: payload,
      trace
    });
  } catch (err) {
    next(err);
  }
});

export default router;
