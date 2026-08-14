import fs from 'fs/promises';
import path from 'path';
import { KNOWLEDGE_DIR } from '../config.js';

export async function listKnowledgeBases() {
  try {
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    const entries = await fs.readdir(KNOWLEDGE_DIR, { withFileTypes: true });
    const kbs = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const kbDir = path.join(KNOWLEDGE_DIR, entry.name);
        const docsDir = path.join(kbDir, 'documents');
        let docCount = 0;
        try {
          const docs = await fs.readdir(docsDir);
          docCount = docs.length;
        } catch {
          // No documents dir yet
        }

        kbs.push({
          name: entry.name,
          document_count: docCount,
          path: kbDir
        });
      }
    }

    return { knowledge_bases: kbs };
  } catch (err) {
    return { knowledge_bases: [] };
  }
}

export async function createKnowledgeBase(kbName, description = '') {
  const kbDir = path.join(KNOWLEDGE_DIR, kbName);
  const docsDir = path.join(kbDir, 'documents');
  await fs.mkdir(docsDir, { recursive: true });

  const metaPath = path.join(kbDir, 'manifest.json');
  const manifest = {
    name: kbName,
    description,
    created_at: new Date().toISOString()
  };
  await fs.writeFile(metaPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return { status: 'success', message: `Knowledge Base ${kbName} created`, manifest };
}

export async function deleteKnowledgeBase(kbName) {
  const kbDir = path.join(KNOWLEDGE_DIR, kbName);
  try {
    await fs.rm(kbDir, { recursive: true, force: true });
    return { status: 'success', message: `Knowledge Base ${kbName} deleted` };
  } catch (err) {
    throw new Error(`Failed to delete Knowledge Base ${kbName}: ${err.message}`);
  }
}

export async function saveDocumentToKnowledgeBase(kbName, file) {
  const docsDir = path.join(KNOWLEDGE_DIR, kbName, 'documents');
  await fs.mkdir(docsDir, { recursive: true });

  const targetPath = path.join(docsDir, file.originalname);
  await fs.writeFile(targetPath, file.buffer);

  return {
    status: 'success',
    kb_name: kbName,
    filename: file.originalname,
    size: file.size,
    path: targetPath
  };
}
