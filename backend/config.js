import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PORT = process.env.PORT || 8000;
export const DEEPTUTOR_SERVICE_URL = process.env.DEEPTUTOR_SERVICE_URL || 'http://127.0.0.1:8001';

// Base data directory for persistent stores
export const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '..', 'DeepTutor-main', 'data');
export const USER_DATA_DIR = path.join(DATA_DIR, 'user');
export const SETTINGS_DIR = path.join(USER_DATA_DIR, 'settings');
export const MEMORY_DIR = path.join(USER_DATA_DIR, 'memory');
export const KNOWLEDGE_DIR = path.join(USER_DATA_DIR, 'knowledge');
export const COURSES_DIR = path.join(DATA_DIR, 'courses');
