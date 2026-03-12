const http = require('http');
const next = require('next');
const { WebSocketServer, WebSocket } = require('ws');
const { subscribeEvents } = require('../lib/realtime-bus');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = parseInt(process.env.PORT || '3000', 10);

function safeJsonParse(data) {
  try {
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

function safeSend(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    const wss = new WebSocketServer({ server, path: '/ws' });
    const clients = new Set();

    wss.on('connection', (ws) => {
      const client = {
        ws,
        userId: null,
        rooms: new Set(),
      };
      clients.add(client);

      ws.on('message', (data) => {
        const payload = safeJsonParse(data.toString());
        if (!payload || typeof payload.type !== 'string') return;

        if (payload.type === 'identify' && payload.user_id) {
          client.userId = String(payload.user_id);
        }

        if (payload.type === 'subscribe_room' && payload.room_id) {
          client.rooms.add(String(payload.room_id));
          if (payload.user_id) {
            client.userId = String(payload.user_id);
          }
        }

        if (payload.type === 'unsubscribe_room' && payload.room_id) {
          client.rooms.delete(String(payload.room_id));
        }

        if (payload.type === 'ping') {
          safeSend(ws, { type: 'pong', ts: Date.now() });
        }
      });

      ws.on('close', () => {
        clients.delete(client);
      });
    });

    subscribeEvents((raw) => {
      const event = safeJsonParse(raw);
      if (!event || typeof event.type !== 'string') return;

      if (
        event.type === 'message_created' ||
        event.type === 'message_expired' ||
        event.type === 'room_join' ||
        event.type === 'room_leave'
      ) {
        for (const client of clients) {
          if (event.room_id && client.rooms.has(String(event.room_id))) {
            safeSend(client.ws, event);
          }
        }
        return;
      }

      if (event.type === 'private_message_created' || event.type === 'private_message_expired') {
        const targetUsers = new Set();
        if (event.to_user_id) targetUsers.add(String(event.to_user_id));
        if (event.from_user_id) targetUsers.add(String(event.from_user_id));
        if (Array.isArray(event.user_ids)) {
          for (const userId of event.user_ids) {
            targetUsers.add(String(userId));
          }
        }

        for (const client of clients) {
          if (client.userId && targetUsers.has(client.userId)) {
            safeSend(client.ws, event);
          }
        }
        return;
      }

      if (event.type === 'room_created' || event.type === 'user_status' || event.type === 'system') {
        for (const client of clients) {
          safeSend(client.ws, event);
        }
      }
    });

    server.listen(port, () => {
      console.log(`> Ready on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Server startup error:', error);
    process.exit(1);
  });
