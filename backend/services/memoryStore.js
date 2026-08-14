import fs from 'fs/promises';
import path from 'path';
import { MEMORY_DIR } from '../config.js';

export async function getMemoryDoc(layer, key) {
  const normalizedLayer = layer.toLowerCase();
  let targetPath;

  if (normalizedLayer === 'l1') {
    targetPath = path.join(MEMORY_DIR, 'trace', key);
  } else if (normalizedLayer === 'l2') {
    const filename = key.endsWith('.md') ? key : `${key}.md`;
    targetPath = path.join(MEMORY_DIR, 'L2', filename);
  } else if (normalizedLayer === 'l3') {
    const filename = key.endsWith('.json') || key.endsWith('.md') ? key : `${key}.md`;
    targetPath = path.join(MEMORY_DIR, 'L3', filename);
  } else {
    throw new Error(`Invalid memory layer: ${layer}`);
  }

  try {
    const content = await fs.readFile(targetPath, 'utf-8');
    return { layer: normalizedLayer, key, content, path: targetPath };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { layer: normalizedLayer, key, content: null, exists: false };
    }
    throw err;
  }
}

export async function resetMemoryDoc(layer, key) {
  const normalizedLayer = layer.toLowerCase();
  let targetPath;

  if (normalizedLayer === 'l1') {
    targetPath = path.join(MEMORY_DIR, 'trace', key);
  } else if (normalizedLayer === 'l2') {
    const filename = key.endsWith('.md') ? key : `${key}.md`;
    targetPath = path.join(MEMORY_DIR, 'L2', filename);
  } else if (normalizedLayer === 'l3') {
    const filename = key.endsWith('.json') || key.endsWith('.md') ? key : `${key}.md`;
    targetPath = path.join(MEMORY_DIR, 'L3', filename);
  } else {
    throw new Error(`Invalid memory layer: ${layer}`);
  }

  try {
    await fs.unlink(targetPath);
    return { status: 'success', message: `Memory doc ${layer}/${key} reset successfully.` };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { status: 'success', message: `Memory doc ${layer}/${key} was already empty/absent.` };
    }
    throw err;
  }
}

export async function emitL1Trace(surface, sessionId, payload) {
  const dateStr = new Date().toISOString().split('T')[0];
  const traceDir = path.join(MEMORY_DIR, 'trace', surface);
  await fs.mkdir(traceDir, { recursive: true });

  const traceFile = path.join(traceDir, `${dateStr}.jsonl`);
  const record = {
    timestamp: new Date().toISOString(),
    surface,
    session_id: sessionId,
    payload
  };

  await fs.appendFile(traceFile, JSON.stringify(record) + '\n', 'utf-8');
  return record;
}
