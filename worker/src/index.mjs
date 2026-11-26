import { RoomEngine, generateRoomCode, getDefaultPublicRoom, buildPublicRoomList } from './roomEngine.mjs';

const ALLOWED_ORIGINS = new Set([
  'https://impostergameonline.net',
  'https://www.impostergameonline.net',
  'https://impostergameonline.pages.dev'
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allow =
    ALLOWED_ORIGINS.has(origin) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
      ? origin
      : 'https://impostergameonline.net';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

export class LobbyDO {
  constructor(state) {
    this.state = state;
    this.rooms = new Map();
  }

  _prune() {
    const now = Date.now();
    for (const [code, summary] of this.rooms.entries()) {
      if (now - (summary.updatedAt || 0) > 10 * 60 * 1000 || summary.humanCount === 0) {
        this.rooms.delete(code);
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    this._prune();

    if (request.method === 'GET' && url.pathname === '/list') {
      return json(buildPublicRoomList(Array.from(this.rooms.values())));
    }

    if (request.method === 'POST' && url.pathname === '/upsert') {
      const summary = await request.json();
      if (!summary.isPublic || summary.humanCount === 0) {
        this.rooms.delete(summary.code);
      } else {
        this.rooms.set(summary.code, summary);
      }
      return json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/remove') {
      const { code } = await request.json();
      this.rooms.delete(code);
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  }
}

export class RoomDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.engine = null;
    this.sockets = new Map(); // WebSocket -> playerId
  }

  _syncLobby(summary) {
    if (!this.env.LOBBY) return;
    const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName('global-lobby'));
    lobby.fetch('https://lobby/upsert', {
      method: 'POST',
      body: JSON.stringify(summary)
    }).catch(() => {});
  }

  _createEngine(code, options = {}) {
    this.engine = new RoomEngine(code, options, {
      broadcastState: () => this._broadcastAll(),
      onSummaryChange: (summary) => this._syncLobby(summary),
      schedule: (fn, ms) => setTimeout(fn, ms)
    });
    return this.engine;
  }

  _broadcastAll() {
    if (!this.engine) return;
    for (const [ws, playerId] of this.sockets.entries()) {
      try {
        ws.send(JSON.stringify(this.engine.getStateForPlayer(playerId)));
      } catch {
        // Socket closed
      }
    }
  }

  _send(ws, payload) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // Ignore closed socket
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/init') {
      if (this.engine && this.engine.hasConnectedHumans()) {
        return json({ error: 'Room code already active' }, 409);
      }
      const opts = await request.json();
      const engine = this._createEngine(opts.code, opts);
      this._syncLobby(engine.getPublicSummary());
      return json({ ok: true, code: engine.code, isPublic: engine.isPublic });
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const code = url.searchParams.get('code') || '';
      const preset = getDefaultPublicRoom(code);
      if (preset && (!this.engine || !this.engine.hasConnectedHumans())) {
        this._createEngine(code, { ...preset, isPublic: true });
      }
      if (!this.engine) {
        return json({ error: 'Room not found' }, 404);
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();

      let playerId = null;

      server.addEventListener('message', (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'join') {
          playerId = msg.playerId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          this.sockets.set(server, playerId);
          const res = this.engine.addPlayer(playerId, msg.name);
          if (!res.ok) {
            this._send(server, { type: 'error', message: res.error });
            this.sockets.delete(server);
            server.close(1008, res.error);
          }
          return;
        }

        if (!playerId) return;
        if (msg.type === 'ping') {
          this._send(server, { type: 'pong' });
          return;
        }

        const res = this.engine.handleMessage(playerId, msg);
        if (res && !res.ok && res.error) {
          this._send(server, { type: 'error', message: res.error });
        }
      });

      server.addEventListener('close', () => {
        if (playerId) {
          this.sockets.delete(server);
          const stillConnected = Array.from(this.sockets.values()).includes(playerId);
          if (!stillConnected) this.engine.disconnectPlayer(playerId);
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return json({ error: 'Not found' }, 404);
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, service: 'impostergameonline-multiplayer' }, 200, cors);
    }

    if (request.method === 'GET' && url.pathname === '/api/rooms') {
      const lobby = env.LOBBY.get(env.LOBBY.idFromName('global-lobby'));
      const res = await lobby.fetch('https://lobby/list');
      const data = await res.json();
      return json(data, 200, cors);
    }

    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const body = await request.json().catch(() => ({}));
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode();
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        const initRes = await room.fetch('https://room/init', {
          method: 'POST',
          body: JSON.stringify({ ...body, code })
        });
        if (initRes.status !== 409) {
          return json({ ok: true, code, isPublic: Boolean(body.isPublic) }, 201, cors);
        }
      }
      return json({ error: 'Could not allocate room code, please retry.' }, 503, cors);
    }

    const wsMatch = url.pathname.match(/^\/api\/rooms\/(\d{6})\/ws$/);
    if (wsMatch) {
      const code = wsMatch[1];
      const room = env.ROOMS.get(env.ROOMS.idFromName(code));
      const fwdUrl = new URL(request.url);
      fwdUrl.searchParams.set('code', code);
      return room.fetch(new Request(fwdUrl.toString(), request));
    }

    return json({ error: 'Not found' }, 404, cors);
  }
};
