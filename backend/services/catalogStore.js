import fs from 'fs/promises';
import path from 'path';
import { SETTINGS_DIR } from '../config.js';

const CATALOG_PATH = path.join(SETTINGS_DIR, 'catalog.json');

const DEFAULT_CATALOG = {
  llm_profiles: {},
  embedding_profiles: {},
  search_profiles: {},
  active_bindings: {
    primary_llm: null,
    reasoning_llm: null,
    embedding: null,
    search: null
  }
};

export async function getCatalogSettings() {
  try {
    const data = await fs.readFile(CATALOG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(SETTINGS_DIR, { recursive: true });
      await fs.writeFile(CATALOG_PATH, JSON.stringify(DEFAULT_CATALOG, null, 2), 'utf-8');
      return DEFAULT_CATALOG;
    }
    throw err;
  }
}

export async function updateCatalogSettings(newCatalog) {
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(CATALOG_PATH, JSON.stringify(newCatalog, null, 2), 'utf-8');
  return newCatalog;
}
