import { RoomEngine, generateRoomCode, getDefaultPublicRoom, buildPublicRoomList } from './roomEngine.mjs';

const ROOM_IDLE_MS = 24 * 60 * 60 * 1000;
const LOBBY_REFRESH_MS = 5 * 60 * 1000;

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
    state.blockConcurrencyWhile(async () => {
      this.rooms = await state.storage.list();
    });
  }

  async _prune() {
    const expired = [];
    const now = Date.now();
    for (const [code, summary] of this.rooms.entries()) {
      if (now - (summary.updatedAt || 0) > 10 * 60 * 1000 || summary.humanCount === 0) {
        this.rooms.delete(code);
        expired.push(code);
      }
    }
    if (expired.length) await this.state.storage.delete(expired);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/list') {
      await this._prune();
      return json(buildPublicRoomList(Array.from(this.rooms.values())));
    }

    if (request.method === 'POST' && url.pathname === '/upsert') {
      const summary = await request.json();
      if (!summary.isPublic || summary.humanCount === 0) {
        this.rooms.delete(summary.code);
        await this.state.storage.delete(summary.code);
      } else {
        this.rooms.set(summary.code, summary);
        await this.state.storage.put(summary.code, summary);
      }
      return json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/remove') {
      const { code } = await request.json();
      this.rooms.delete(code);
      await this.state.storage.delete(code);
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
    this.alarmAt = null;
    this.lastLobbyUpdate = null;
    state.blockConcurrencyWhile(async () => {
      const [snapshot, alarmAt] = await Promise.all([
        state.storage.get('room'),
        state.storage.getAlarm()
      ]);
      this.alarmAt = alarmAt;
      if (!snapshot) return;
      const engine = this._createEngine(snapshot.code);
      const interrupted = engine.restore(snapshot);
      await Promise.all([
        interrupted && this._saveRoom(),
        this._scheduleAlarm()
      ]);
    });
  }

  _roomExpired() {
    return this.engine && !this.engine.hasConnectedHumans() &&
      Date.now() - this.engine.updatedAt >= ROOM_IDLE_MS;
  }

  _saveRoom() {
    return this.state.storage.put('room', this.engine.snapshot());
  }

  _scheduleAlarm() {
    const engine = this.engine;
    const hasHumans = engine.hasConnectedHumans();
    const idleAt = (hasHumans ? Date.now() : engine.updatedAt) + ROOM_IDLE_MS;
    const due = Math.min(
      idleAt,
      engine.reconnectCheckAt(),
      engine.isPublic && hasHumans
        ? (this.lastLobbyUpdate?.sentAt ?? Date.now()) + LOBBY_REFRESH_MS : Infinity
    );
    if (this.alarmAt !== null && this.alarmAt <= due) return;
    this.alarmAt = due;
    return this.state.storage.setAlarm(due);
  }

  async alarm() {
    this.alarmAt = null;
    if (!this.engine || this._roomExpired()) {
      this.engine = null;
      this.lastLobbyUpdate = null;
      await Promise.all([this.state.storage.deleteAll(), this.state.storage.deleteAlarm()]);
      return;
    }
    if (this.engine.finishReconnectGrace()) return;
    this._syncLobby(this.engine.getPublicSummary());
    await this._scheduleAlarm();
  }

  _syncLobby(summary) {
    if (!summary.isPublic || !this.env.LOBBY) return;
    const { updatedAt, ...visible } = summary;
    const fingerprint = summary.humanCount ? JSON.stringify(visible) : '';
    const previous = this.lastLobbyUpdate;
    const sentAt = Math.max(updatedAt, Date.now());
    if (previous?.fingerprint === fingerprint &&
        (!fingerprint || sentAt - previous.sentAt < LOBBY_REFRESH_MS)) return;

    const update = { fingerprint, sentAt };
    this.lastLobbyUpdate = update;
    this.lobby ??= this.env.LOBBY.get(this.env.LOBBY.idFromName('global-lobby'));
    this.state.waitUntil(this.lobby.fetch('https://lobby/upsert', {
      method: 'POST',
      body: JSON.stringify({ ...visible, updatedAt: sentAt })
    }).then((response) => {
      if (!response.ok) throw new Error(`Lobby returned ${response.status}`);
    }).catch((error) => {
      if (this.lastLobbyUpdate === update) this.lastLobbyUpdate = null;
      console.error('Lobby update failed', error);
    }));
  }

  _publishState(summary) {
    const saved = this._saveRoom();
    this._syncLobby(summary);
    const scheduled = this._scheduleAlarm();
    this._broadcastAll();
    return Promise.all([saved, scheduled]);
  }

  _createEngine(code, options = {}) {
    this.engine = new RoomEngine(code, options, {
      onSummaryChange: (summary) => this.state.waitUntil(this._publishState(summary)),
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
      const opts = await request.json();
      if (this.engine && !this._roomExpired()) {
        return json({ error: 'Room code already active' }, 409);
      }
      const engine = this._createEngine(opts.code, opts);
      await Promise.all([this._saveRoom(), this._scheduleAlarm()]);
      return json({ ok: true, code: engine.code, isPublic: engine.isPublic });
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const code = url.searchParams.get('code') || '';
      const preset = getDefaultPublicRoom(code);
      if (!preset && (!this.engine || this._roomExpired())) {
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

        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'join') {
          if (playerId) return;
          const unavailable = !this.engine || this._roomExpired();
          if (preset && (unavailable || this.engine.canResetFeatured(msg.reconnectToken))) {
            this._createEngine(code, { ...preset, isPublic: true });
          } else if (unavailable) {
            this._send(server, { type: 'error', message: 'Room expired.' });
            server.close(1008, 'Room expired.');
            return;
          }
          const res = this.engine.joinPlayer(msg.reconnectToken, msg.name);
          if (!res.ok) {
            this._send(server, { type: 'error', message: res.error });
            server.close(1008, res.error);
            return;
          }
          playerId = res.player.id;
          this.sockets.set(server, playerId);
          this._send(server, { type: 'joined', reconnectToken: res.player.reconnectToken });
          this._send(server, this.engine.getStateForPlayer(playerId));
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
        if (initRes.status === 409) continue;
        if (!initRes.ok) return json({ error: 'Could not initialize room.' }, 503, cors);
        return json({ ok: true, code, isPublic: Boolean(body?.isPublic) }, 201, cors);
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
