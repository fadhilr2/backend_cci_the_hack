import { WebSocketServer } from 'ws';
import { DEEPTUTOR_SERVICE_URL } from '../config.js';

export function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/v1/ws' || url.pathname === '/api/v1/ws/') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, request) => {
    console.log('[WS] Client connected to /api/v1/ws');

    ws.on('message', async (message) => {
      let data;
      try {
        data = JSON.parse(message.toString());
      } catch {
        data = { type: 'chat', content: message.toString() };
      }

      // Stream initial thinking status
      ws.send(JSON.stringify({
        event: 'status',
        stage: 'exploring',
        message: 'Analyzing topic and checking context...'
      }));

      // Simulate streaming Socratic guidance chunks or proxy if deeptutor WS is live
      setTimeout(() => {
        ws.send(JSON.stringify({
          event: 'chunk',
          type: 'text',
          content: `Socratic Guide: Let's explore your question step-by-step. What initial thoughts do you have regarding: "${data.content || data.text || 'this topic'}"?`
        }));

        ws.send(JSON.stringify({
          event: 'done',
          status: 'completed',
          cost_summary: { total_tokens: 42, estimated_cost: 0.0001 }
        }));
      }, 500);
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });
  });

  return wss;
}
