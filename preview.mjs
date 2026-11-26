import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RoomEngine, generateRoomCode, getDefaultPublicRoom, buildPublicRoomList } from './worker/src/roomEngine.mjs';

const DIST = path.join(import.meta.dirname, 'dist');
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

// Minimal RFC 6455 WebSocket framing for local dev preview (shortcut: single-frame text messages <= 64KB, production uses Cloudflare Durable Objects WebSockets)
function encodeWsFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  }
  return Buffer.concat([header, payload]);
}

function attachWsSocket(socket, onMessage, onClose) {
  let buf = Buffer.alloc(0);
  const send = (obj) => {
    if (!socket.destroyed) socket.write(encodeWsFrame(JSON.stringify(obj)));
  };

  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let payloadLen = buf[1] & 0x7f;
      let offset = 2;
      if (payloadLen === 126) {
        if (buf.length < 4) return;
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        socket.end();
        return;
      }
      const maskLen = masked ? 4 : 0;
      if (buf.length < offset + maskLen + payloadLen) return;
      const mask = masked ? buf.subarray(offset, offset + 4) : null;
      offset += maskLen;
      const data = Buffer.from(buf.subarray(offset, offset + payloadLen));
      buf = buf.subarray(offset + payloadLen);

      if (mask) {
        for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
      }
      if (opcode === 0x8) {
        socket.end();
        return;
      }
      if (opcode === 0x9) {
        socket.write(Buffer.from([0x8a, 0x00])); // pong
        continue;
      }
      if (opcode === 0x1) {
        onMessage(data.toString('utf8'), send);
      }
    }
  });

  socket.on('close', onClose);
  socket.on('error', onClose);
  return { send, close: () => socket.end() };
}

// Local in-memory room registry mirroring Cloudflare LobbyDO + RoomDO
const rooms = new Map(); // code -> { engine, clients: Map<client, playerId> }

function broadcastRoom(entry) {
  for (const [client, playerId] of entry.clients.entries()) {
    client.send(entry.engine.getStateForPlayer(playerId));
  }
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  // Local API endpoints
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mode: 'local-preview' }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/rooms') {
    const active = [];
    for (const [code, entry] of rooms.entries()) {
      const s = entry.engine.getPublicSummary();
      if (s.isPublic && s.humanCount > 0) {
        active.push(s);
      } else if (Date.now() - s.updatedAt > 10 * 60 * 1000 && s.humanCount === 0) {
        rooms.delete(code);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(buildPublicRoomList(active)));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    const body = await readJsonBody(req);
    const code = generateRoomCode(new Set(rooms.keys()));
    const entry = { engine: null, clients: new Map() };
    entry.engine = new RoomEngine(code, body, {
      broadcastState: () => broadcastRoom(entry),
      schedule: (fn, ms) => setTimeout(fn, ms)
    });
    rooms.set(code, entry);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, code, isPublic: Boolean(body.isPublic) }));
    return;
  }

  // Static files
  let filePath = path.join(DIST, url.pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const match = url.pathname.match(/^\/api\/rooms\/(\d{6})\/ws$/);
  const key = req.headers['sec-websocket-key'];
  if (!match || !key) {
    socket.destroy();
    return;
  }

  let entry = rooms.get(match[1]);
  const preset = getDefaultPublicRoom(match[1]);
  if (preset && (!entry || !entry.engine.hasConnectedHumans())) {
    entry = { engine: null, clients: new Map() };
    entry.engine = new RoomEngine(match[1], { ...preset, isPublic: true }, {
      broadcastState: () => broadcastRoom(entry),
      schedule: (fn, ms) => setTimeout(fn, ms)
    });
    rooms.set(match[1], entry);
  }
  if (!entry) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  let playerId = null;
  const client = attachWsSocket(
    socket,
    (raw, send) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'join') {
        playerId = msg.playerId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        entry.clients.set(client, playerId);
        const res = entry.engine.addPlayer(playerId, msg.name);
        if (!res.ok) {
          send({ type: 'error', message: res.error });
          entry.clients.delete(client);
          client.close();
        }
        return;
      }

      if (!playerId) return;
      if (msg.type === 'ping') {
        send({ type: 'pong' });
        return;
      }

      const res = entry.engine.handleMessage(playerId, msg);
      if (res && !res.ok && res.error) {
        send({ type: 'error', message: res.error });
      }
    },
    () => {
      if (playerId) {
        entry.clients.delete(client);
        const stillConnected = Array.from(entry.clients.values()).includes(playerId);
        if (!stillConnected) entry.engine.disconnectPlayer(playerId);
      }
    }
  );
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Preview + local multiplayer server running at http://127.0.0.1:${PORT}`);
});
