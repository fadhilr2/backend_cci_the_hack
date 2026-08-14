import http from 'http';
import express from 'express';
import cors from 'cors';
import { PORT } from './config.js';

import settingsRouter from './routes/settings.js';
import roadmapRouter from './routes/roadmap.js';
import coursesRouter from './routes/courses.js';
import knowledgeRouter from './routes/knowledge.js';
import memoryRouter from './routes/memory.js';
import { setupWebSocketServer } from './routes/ws.js';

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'deeptutor-node-backend', timestamp: new Date().toISOString() });
});

// API Routers
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/roadmap', roadmapRouter);
app.use('/api/v1/courses', coursesRouter);
app.use('/api/v1/knowledge', knowledgeRouter);
app.use('/api/v1/memory', memoryRouter);

// Centralized Error Handling
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// HTTP & WebSocket Server Setup
const server = http.createServer(app);
setupWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 DeepTutor Node.js Backend listening on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://127.0.0.1:${PORT}/api/v1/ws`);
  console.log(`====================================================`);
});
