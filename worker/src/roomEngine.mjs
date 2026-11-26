import { CATEGORIES } from '../../src/data/site.mjs';
import { BOT_PROFILES, SOLO_WORDS } from '../../src/data/botClues.mjs';

const RECONNECT_GRACE_MS = 60_000;

const AVATAR_COLORS = [
  '#007cff',
  '#ff0030',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#6366f1',
  '#14b8a6'
];

const GENERIC_BLUFFS = [
  'Classic', 'Popular', 'Familiar', 'Common', 'Everyday',
  'Iconic', 'Famous', 'Simple', 'Interesting', 'Memorable',
  'Trending', 'Notable', 'Special', 'Unique', 'Favorite'
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sanitizeText(str, maxLen = 24) {
  return String(str || '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export const DEFAULT_PUBLIC_ROOMS = [
  { code: '100001', name: 'Food & Drinks', emoji: '🍕', categories: ['everyday-food'], maxPlayers: 8, imposterCount: 1, imposterHint: true },
  { code: '100002', name: 'Movies & TV', emoji: '🎬', categories: ['movies-tv'], maxPlayers: 8, imposterCount: 1, imposterHint: true },
  { code: '100003', name: 'Sports & Games', emoji: '🎮', categories: ['sports-games'], maxPlayers: 8, imposterCount: 1, imposterHint: true },
  { code: '100004', name: 'Pop Culture', emoji: '🌟', categories: ['pop-culture'], maxPlayers: 8, imposterCount: 1, imposterHint: true }
];

export function getDefaultPublicRoom(code) {
  return DEFAULT_PUBLIC_ROOMS.find((r) => r.code === String(code)) || null;
}

export function buildPublicRoomList(activeSummaries = []) {
  const byCode = new Map();
  for (const s of activeSummaries) {
    if (s && s.isPublic && s.humanCount > 0) byCode.set(s.code, s);
  }

  const rooms = [];
  for (const preset of DEFAULT_PUBLIC_ROOMS) {
    const live = byCode.get(preset.code);
    if (live) {
      rooms.push({ ...live, emoji: preset.emoji, isFeatured: true });
      byCode.delete(preset.code);
    } else {
      const catName = CATEGORIES.find((c) => c.id === preset.categories[0])?.name || preset.name;
      rooms.push({
        code: preset.code,
        name: preset.name,
        emoji: preset.emoji,
        isPublic: true,
        isFeatured: true,
        hostName: 'Open Lobby',
        playerCount: 0,
        humanCount: 0,
        maxPlayers: preset.maxPlayers,
        imposterCount: preset.imposterCount,
        categories: [catName],
        phase: 'lobby',
        readyToStart: false,
        avatars: [],
        updatedAt: 0
      });
    }
  }

  // Append user-created active public rooms
  const custom = Array.from(byCode.values()).sort((a, b) => b.playerCount - a.playerCount || b.updatedAt - a.updatedAt);
  const all = [...custom, ...rooms];
  const totalOnline = all.reduce((sum, r) => sum + (r.humanCount || 0), 0);
  return { rooms: all.slice(0, 24), totalOnline };
}

export function generateRoomCode(existingCodes = new Set()) {
  for (let i = 0; i < 40; i++) {
    // Reserve 100000–199999 for permanent featured public category rooms
    const code = String(Math.floor(200000 + Math.random() * 800000));
    if (!existingCodes.has(code)) return code;
  }
  return `9${String(Date.now()).slice(-5)}`;
}

export class RoomEngine {
  constructor(code, options = {}, hooks = {}) {
    this.code = String(code);
    this.isPublic = Boolean(options.isPublic);
    this.name = sanitizeText(options.name, 28) || (this.isPublic ? `Room #${this.code}` : `Private #${this.code}`);
    this.maxPlayers = Math.max(3, Math.min(10, Number(options.maxPlayers) || 8));
    this.imposterCount = Math.max(1, Math.min(3, Number(options.imposterCount) || 1));
    this.imposterHint = options.imposterHint !== false;
    this.timerMinutes = Number.isFinite(Number(options.timerMinutes)) ? Number(options.timerMinutes) : 2;
    this.categories =
      Array.isArray(options.categories) && options.categories.length
        ? options.categories.filter((id) => CATEGORIES.some((c) => c.id === id))
        : ['everyday-food'];
    if (!this.categories.length) this.categories = ['everyday-food'];

    this.hooks = hooks; // { sendToPlayer(id, msg), broadcastState(), onSummaryChange(summary), schedule(fn, ms) }
    this.players = []; // { id, name, color, isHost, isBot, connected, score, ready }
    this.phase = 'lobby'; // lobby | reveal | clues | vote | result
    this.round = 1;
    this.usedWords = new Set();

    // Round-private state (never broadcast secretWord to imposters during play)
    this.secretWord = '';
    this.secretHint = '';
    this.secretCategory = '';
    this.soloWordEntry = null;
    this.imposterIds = new Set();
    this.turnOrder = [];
    this.turnIndex = 0;
    this.clues = []; // { playerId, clue }
    this.votes = new Map(); // voterId -> targetId
    this.result = null;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this._botActionToken = 0;
    this.reconnectUntil = 0;
  }

  _touch() {
    this.updatedAt = Date.now();
  }

  snapshot() {
    const { hooks, _botActionToken, ...data } = this;
    return data;
  }

  restore(snapshot) {
    Object.assign(this, snapshot);
    // Standard WebSocket connections do not survive an instance restart.
    const interrupted = this.hasConnectedHumans();
    for (const player of this.players) player.connected = player.isBot;
    if (interrupted) {
      this._touch();
      this.reconnectUntil = this.updatedAt + RECONNECT_GRACE_MS;
    }
    return interrupted;
  }

  canResetFeatured(token) {
    return !this.hasConnectedHumans() && Date.now() >= this.reconnectUntil &&
      !this.playerForReconnect(token);
  }

  releaseLobbySeats(rejoiningPlayer) {
    if (this.phase !== 'lobby' || Date.now() < this.reconnectUntil) return false;
    const available = this.players.filter((p) => p.connected || p.isBot || p === rejoiningPlayer);
    if (available.length === this.players.length) return false;
    this.players = available;
    this._ensureHost();
    return true;
  }

  reconnectCheckAt() {
    if (!this.reconnectUntil || !this.players.some((p) => !p.isBot && !p.connected)) {
      return Infinity;
    }
    return this.phase === 'lobby' ||
      ((this.phase === 'reveal' || this.phase === 'vote') && this.hasConnectedHumans())
      ? this.reconnectUntil : Infinity;
  }

  finishReconnectGrace() {
    if (!this.reconnectUntil || Date.now() < this.reconnectUntil) return false;
    this.reconnectUntil = 0;
    if (this.releaseLobbySeats()) {
      this._emitUpdate();
      return true;
    }
    return this._advanceWhenReady();
  }

  _advanceWhenReady() {
    if ((this.phase !== 'reveal' && this.phase !== 'vote') || !this.hasConnectedHumans()) {
      return false;
    }
    const inGrace = Date.now() < this.reconnectUntil;
    const humans = this.players.filter((p) => !p.isBot && (p.connected || inGrace));
    if (this.phase === 'reveal' && humans.every((p) => p.ready)) {
      this._enterCluesPhase();
      return true;
    }
    if (this.phase === 'vote' && humans.every((p) => this.votes.has(p.id))) {
      this._finishVote();
      return true;
    }
    return false;
  }

  playerForReconnect(token) {
    if (typeof token !== 'string' || token.length !== 36) return undefined;
    return this.players.find((player) => !player.isBot && player.reconnectToken === token);
  }

  joinPlayer(token, name) {
    const existing = this.playerForReconnect(token);
    const wasEmpty = !this.hasConnectedHumans();
    this.releaseLobbySeats(existing);
    const result = this.addPlayer(
      existing?.id ?? crypto.randomUUID(),
      name,
      existing?.reconnectToken ?? crypto.randomUUID()
    );
    if (result.ok && wasEmpty) this._maybeScheduleBotClue();
    return result;
  }

  _nextColor() {
    const used = new Set(this.players.map((p) => p.color));
    return AVATAR_COLORS.find((c) => !used.has(c)) || AVATAR_COLORS[this.players.length % AVATAR_COLORS.length];
  }

  _ensureHost() {
    if (this.players.some((p) => p.isHost && !p.isBot && p.connected)) return;
    this.players.forEach((p) => { p.isHost = false; });
    const next = this.players.find((p) => !p.isBot && p.connected) || this.players.find((p) => !p.isBot);
    if (next) next.isHost = true;
  }

  _emitUpdate() {
    this._touch();
    if (this.hooks.onSummaryChange) this.hooks.onSummaryChange(this.getPublicSummary());
    if (this.hooks.broadcastState) this.hooks.broadcastState();
  }

  hasConnectedHumans() {
    return this.players.some((p) => !p.isBot && p.connected);
  }

  getPublicSummary() {
    const host = this.players.find((p) => p.isHost) || this.players[0];
    const catNames = this.categories
      .map((id) => CATEGORIES.find((c) => c.id === id)?.name)
      .filter(Boolean);
    return {
      code: this.code,
      name: this.name,
      isPublic: this.isPublic,
      hostName: host ? host.name : 'Host',
      playerCount: this.players.length,
      humanCount: this.players.filter((p) => !p.isBot && p.connected).length,
      maxPlayers: this.maxPlayers,
      imposterCount: this.imposterCount,
      categories: catNames.length ? catNames : ['Food & Drinks'],
      phase: this.phase,
      readyToStart: this.players.length >= 3,
      avatars: this.players.map((p) => ({
        initial: (p.name[0] || '?').toUpperCase(),
        color: p.color,
        isBot: p.isBot
      })),
      updatedAt: this.updatedAt
    };
  }

  getStateForPlayer(playerId) {
    const me = this.players.find((p) => p.id === playerId);
    const isImposter = this.imposterIds.has(playerId);
    let myRole = null;
    if (this.phase !== 'lobby' && me) {
      if (isImposter) {
        myRole = {
          role: 'imposter',
          category: this.secretCategory,
          hint: this.imposterHint ? this.secretHint : null
        };
      } else {
        myRole = {
          role: 'crew',
          word: this.secretWord,
          category: this.secretCategory
        };
      }
    }

    const currentTurnId = this.phase === 'clues' ? this.turnOrder[this.turnIndex] || null : null;

    return {
      type: 'state',
      room: {
        code: this.code,
        name: this.name,
        isPublic: this.isPublic,
        phase: this.phase,
        round: this.round,
        maxPlayers: this.maxPlayers,
        imposterCount: this.imposterCount,
        imposterHint: this.imposterHint,
        timerMinutes: this.timerMinutes,
        categories: this.categories,
        players: this.players.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          initial: (p.name[0] || '?').toUpperCase(),
          isHost: p.isHost,
          isBot: p.isBot,
          connected: p.connected,
          score: p.score,
          ready: p.ready,
          hasVoted: this.votes.has(p.id)
        })),
        meId: playerId,
        myRole,
        currentTurnId,
        clues: this.clues,
        votedCount: this.votes.size,
        totalVoters: this.players.length,
        myVote: this.votes.get(playerId) || null,
        result: this.phase === 'result' ? this.result : null
      }
    };
  }

  addPlayer(playerId, rawName, reconnectToken) {
    const existing = this.players.find((p) => p.id === playerId);
    if (existing) {
      existing.connected = true;
      const clean = sanitizeText(rawName, 18);
      if (clean) existing.name = clean;
      this._ensureHost();
      this._emitUpdate();
      return { ok: true, player: existing };
    }

    if (this.players.length >= this.maxPlayers) {
      return { ok: false, error: 'Room is full.' };
    }
    if (this.phase !== 'lobby') {
      return { ok: false, error: 'Game already in progress. Wait for the next round.' };
    }

    const name = sanitizeText(rawName, 18) || `Player ${this.players.length + 1}`;
    const player = {
      id: playerId,
      reconnectToken,
      name,
      color: this._nextColor(),
      isHost: this.players.every((p) => p.isBot),
      isBot: false,
      connected: true,
      score: 0,
      ready: false
    };
    this.players.push(player);
    this._ensureHost();
    this._emitUpdate();
    return { ok: true, player };
  }

  disconnectPlayer(playerId) {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;
    if (this.phase === 'lobby') {
      this.players.splice(idx, 1);
    } else {
      this.players[idx].connected = false;
    }
    this._ensureHost();

    const hasHumans = this.hasConnectedHumans();
    if (!hasHumans && this.phase !== 'lobby') {
      this.reconnectUntil = Date.now() + RECONNECT_GRACE_MS;
    }
    if (this._advanceWhenReady()) return;
    this._emitUpdate();
    if (hasHumans && this.phase === 'clues' && this.turnOrder[this.turnIndex] === playerId) {
      this._maybeScheduleBotClue();
    }
  }

  addBot(requesterId) {
    const host = this.players.find((p) => p.id === requesterId);
    if (!host || !host.isHost) return { ok: false, error: 'Only host can add AI bots.' };
    if (this.phase !== 'lobby') return { ok: false, error: 'Bots can only be added in lobby.' };
    if (this.players.length >= this.maxPlayers) return { ok: false, error: 'Room is full.' };

    const usedNames = new Set(this.players.map((p) => p.name));
    const profile = BOT_PROFILES.find((b) => !usedNames.has(`${b.name} (AI)`));
    const botName = profile ? `${profile.name} (AI)` : `Bot ${this.players.filter((p) => p.isBot).length + 1} (AI)`;
    const bot = {
      id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: botName,
      color: profile ? profile.color : this._nextColor(),
      isHost: false,
      isBot: true,
      connected: true,
      score: 0,
      ready: true
    };
    this.players.push(bot);
    this._emitUpdate();
    return { ok: true, bot };
  }

  removeBot(requesterId, botId) {
    const host = this.players.find((p) => p.id === requesterId);
    if (!host || !host.isHost) return { ok: false, error: 'Only host can remove bots.' };
    if (this.phase !== 'lobby') return { ok: false, error: 'Cannot remove bots mid-game.' };
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return { ok: false, error: 'Bot not found.' };
    this.players.splice(idx, 1);
    const maxImp = Math.max(1, Math.min(3, Math.floor((this.players.length - 1) / 2)));
    if (this.imposterCount > maxImp) this.imposterCount = maxImp;
    this._emitUpdate();
    return { ok: true };
  }

  updateSettings(requesterId, patch = {}) {
    const host = this.players.find((p) => p.id === requesterId);
    if (!host || !host.isHost) return { ok: false, error: 'Only host can change settings.' };
    if (this.phase !== 'lobby') return { ok: false, error: 'Settings can only change in lobby.' };

    if (typeof patch.imposterHint === 'boolean') this.imposterHint = patch.imposterHint;
    if (patch.imposterCount !== undefined) {
      const maxImp = Math.max(1, Math.min(3, Math.floor((Math.max(3, this.players.length) - 1) / 2)));
      this.imposterCount = Math.max(1, Math.min(maxImp, Number(patch.imposterCount) || 1));
    }
    if (Array.isArray(patch.categories) && patch.categories.length) {
      const valid = [...new Set(patch.categories.filter((id) => CATEGORIES.some((c) => c.id === id)))];
      if (valid.length) this.categories = valid;
    }
    if (patch.timerMinutes !== undefined) {
      const m = Number(patch.timerMinutes);
      if ([0, 1, 2, 3, 5].includes(m)) this.timerMinutes = m;
    }
    this._emitUpdate();
    return { ok: true };
  }

  _pickWord() {
    const hasBots = this.players.some((p) => p.isBot);
    const selectedCatNames = new Set(
      this.categories.map((id) => CATEGORIES.find((c) => c.id === id)?.name).filter(Boolean)
    );

    if (hasBots) {
      const matchingSolo = SOLO_WORDS.filter((w) => selectedCatNames.has(w.category));
      const soloPool = matchingSolo.length ? matchingSolo : SOLO_WORDS;
      const freshSolo = soloPool.filter((w) => !this.usedWords.has(w.word));
      if (!freshSolo.length) this.usedWords.clear();
      const pool = freshSolo.length ? freshSolo : soloPool;
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      this.usedWords.add(chosen.word);
      return { word: chosen.word, hint: chosen.hint, category: chosen.category, soloEntry: chosen };
    }

    const pool = [];
    CATEGORIES.forEach((cat) => {
      if (this.categories.includes(cat.id)) {
        cat.words.forEach((w) => pool.push({ ...w, category: cat.name }));
      }
    });
    const active = pool.length ? pool : CATEGORIES[0].words.map((w) => ({ ...w, category: CATEGORIES[0].name }));
    let fresh = active.filter((w) => !this.usedWords.has(w.word));
    if (!fresh.length) {
      this.usedWords.clear();
      fresh = active;
    }
    const chosen = fresh[Math.floor(Math.random() * fresh.length)];
    this.usedWords.add(chosen.word);
    const soloMatch = SOLO_WORDS.find((s) => s.word === chosen.word) || null;
    return { word: chosen.word, hint: chosen.hint, category: chosen.category, soloEntry: soloMatch };
  }

  startGame(requesterId) {
    const host = this.players.find((p) => p.id === requesterId);
    if (!host || !host.isHost) return { ok: false, error: 'Only host can start the game.' };
    if (this.phase === 'lobby' && this.players.some((p) => !p.isBot && !p.connected)) {
      return { ok: false, error: 'Wait for disconnected players to rejoin.' };
    }
    if (this.players.length < 3) return { ok: false, error: 'Need at least 3 players (or add AI Bots) to start.' };

    const chosen = this._pickWord();
    this.secretWord = chosen.word;
    this.secretHint = chosen.hint;
    this.secretCategory = chosen.category;
    this.soloWordEntry = chosen.soloEntry;

    const maxImp = Math.max(1, Math.min(3, Math.floor((this.players.length - 1) / 2)));
    const impCount = Math.min(this.imposterCount, maxImp);
    const shuffled = shuffle(this.players.map((p) => p.id));
    this.imposterIds = new Set(shuffled.slice(0, impCount));

    this.players.forEach((p) => {
      p.ready = p.isBot;
    });
    this.turnOrder = shuffle(this.players.map((p) => p.id));
    this.turnIndex = 0;
    this.clues = [];
    this.votes = new Map();
    this.result = null;
    this.phase = 'reveal';
    this._botActionToken += 1;

    this._emitUpdate();
    return { ok: true };
  }

  playerReady(playerId) {
    if (this.phase !== 'reveal') return;
    const p = this.players.find((pl) => pl.id === playerId);
    if (!p || p.ready) return;
    p.ready = true;
    if (!this._advanceWhenReady()) this._emitUpdate();
  }

  advanceToClues(requesterId) {
    const host = this.players.find((p) => p.id === requesterId);
    if (!host || !host.isHost || this.phase !== 'reveal') return;
    this._enterCluesPhase();
  }

  _enterCluesPhase() {
    this.phase = 'clues';
    this.turnIndex = 0;
    this.clues = [];
    this._emitUpdate();
    this._maybeScheduleBotClue();
  }

  _pickBotClue(botId) {
    const usedClues = new Set(this.clues.map((c) => c.clue.toLowerCase()));
    const isImp = this.imposterIds.has(botId);

    let candidates = [];
    if (this.soloWordEntry) {
      candidates = isImp ? this.soloWordEntry.bluffs : this.soloWordEntry.clues;
    } else if (!isImp && this.secretHint) {
      candidates = this.secretHint.split(/\s+/).concat(['Exact', 'Obvious', 'Classic']);
    } else {
      candidates = GENERIC_BLUFFS;
    }

    const fresh = shuffle(candidates).filter((w) => !usedClues.has(String(w).toLowerCase()));
    return fresh[0] || GENERIC_BLUFFS[Math.floor(Math.random() * GENERIC_BLUFFS.length)];
  }

  _maybeScheduleBotClue() {
    if (this.phase !== 'clues') return;
    const currentId = this.turnOrder[this.turnIndex];
    const current = this.players.find((p) => p.id === currentId);
    if (!current) {
      this._enterVotePhase();
      return;
    }
    if (!current.isBot && current.connected) return;

    const token = ++this._botActionToken;
    const run = () => {
      if (this._botActionToken !== token || this.phase !== 'clues' || !this.hasConnectedHumans()) return;
      if (this.turnOrder[this.turnIndex] !== currentId || (!current.isBot && current.connected)) return;
      const clue = current.isBot ? this._pickBotClue(currentId) : '(skipped)';
      this.clues.push({ playerId: currentId, clue });
      this.turnIndex += 1;
      if (this.turnIndex >= this.turnOrder.length) {
        this._enterVotePhase();
      } else {
        this._emitUpdate();
        this._maybeScheduleBotClue();
      }
    };

    if (this.hooks.schedule) {
      this.hooks.schedule(run, current.isBot ? 900 : Math.max(200, this.reconnectUntil - Date.now()));
    } else {
      run();
    }
  }

  submitClue(playerId, rawClue) {
    if (this.phase !== 'clues') return { ok: false, error: 'Not in clue phase.' };
    if (this.turnOrder[this.turnIndex] !== playerId) return { ok: false, error: 'Not your turn.' };
    const clean = sanitizeText(rawClue, 24).split(/\s+/)[0];
    if (!clean) return { ok: false, error: 'Enter a 1-word clue.' };

    this.clues.push({ playerId, clue: clean });
    this.turnIndex += 1;
    if (this.turnIndex >= this.turnOrder.length) {
      this._enterVotePhase();
    } else {
      this._emitUpdate();
      this._maybeScheduleBotClue();
    }
    return { ok: true };
  }

  advanceToVote(requesterId) {
    const host = this.players.find((p) => p.id === requesterId);
    if (!host || !host.isHost || this.phase !== 'clues') return;
    this._enterVotePhase();
  }

  _enterVotePhase() {
    this.phase = 'vote';
    this.votes = new Map();
    this._botActionToken += 1;

    // Bots cast votes automatically
    for (const bot of this.players.filter((p) => p.isBot)) {
      const others = this.players.filter((p) => p.id !== bot.id);
      if (!others.length) continue;
      let target;
      if (!this.imposterIds.has(bot.id) && Math.random() < 0.55) {
        const imps = others.filter((p) => this.imposterIds.has(p.id));
        target = imps[Math.floor(Math.random() * imps.length)] || others[Math.floor(Math.random() * others.length)];
      } else {
        target = others[Math.floor(Math.random() * others.length)];
      }
      this.votes.set(bot.id, target.id);
    }

    this._emitUpdate();
  }

  castVote(voterId, targetId) {
    if (this.phase !== 'vote') return { ok: false, error: 'Not in voting phase.' };
    if (voterId === targetId) return { ok: false, error: 'Cannot vote for yourself.' };
    if (!this.players.some((p) => p.id === targetId)) return { ok: false, error: 'Invalid player.' };

    if (this.votes.get(voterId) === targetId) return { ok: true };
    this.votes.set(voterId, targetId);
    if (!this._advanceWhenReady()) this._emitUpdate();
    return { ok: true };
  }

  forceFinishVote(requesterId) {
    const host = this.players.find((p) => p.id === requesterId);
    if (!host || !host.isHost || this.phase !== 'vote') return;
    this._finishVote();
  }

  _finishVote() {
    const tally = new Map();
    for (const targetId of this.votes.values()) {
      tally.set(targetId, (tally.get(targetId) || 0) + 1);
    }

    let topVotes = 0;
    let topIds = [];
    for (const [id, count] of tally.entries()) {
      if (count > topVotes) {
        topVotes = count;
        topIds = [id];
      } else if (count === topVotes) {
        topIds.push(id);
      }
    }

    const isTie = topIds.length !== 1;
    const ejectedId = isTie ? null : topIds[0];
    const crewWon = ejectedId !== null && this.imposterIds.has(ejectedId);

    this.players.forEach((p) => {
      if (crewWon && !this.imposterIds.has(p.id)) p.score += 1;
      else if (!crewWon && this.imposterIds.has(p.id)) p.score += 2;
    });

    const voteCounts = {};
    for (const [id, count] of tally.entries()) voteCounts[id] = count;

    this.result = {
      isTie,
      ejectedId,
      crewWon,
      secretWord: this.secretWord,
      secretCategory: this.secretCategory,
      imposterIds: Array.from(this.imposterIds),
      voteCounts
    };
    this.phase = 'result';
    this._emitUpdate();
  }

  nextRound(requesterId) {
    const host = this.players.find((p) => p.id === requesterId);
    if (!host || !host.isHost) return;
    this.round += 1;
    // Remove disconnected humans before next round
    this.players = this.players.filter((p) => p.isBot || p.connected);
    this._ensureHost();
    if (this.players.length >= 3) {
      this.startGame(requesterId);
    } else {
      this.phase = 'lobby';
      this._emitUpdate();
    }
  }

  backToLobby(requesterId) {
    const host = this.players.find((p) => p.id === requesterId);
    if (!host || !host.isHost) return;
    this.players = this.players.filter((p) => p.isBot || p.connected);
    this._ensureHost();
    this.phase = 'lobby';
    this._botActionToken += 1;
    this._emitUpdate();
  }

  handleMessage(playerId, msg) {
    if (!msg || typeof msg.type !== 'string') return null;
    if (msg.type === 'add_bot') return this.addBot(playerId);
    if (msg.type === 'remove_bot') return this.removeBot(playerId, msg.botId);
    if (msg.type === 'update_settings') return this.updateSettings(playerId, msg.patch);
    if (msg.type === 'start_game') return this.startGame(playerId);
    if (msg.type === 'player_ready') return this.playerReady(playerId);
    if (msg.type === 'advance_clues') return this.advanceToClues(playerId);
    if (msg.type === 'submit_clue') return this.submitClue(playerId, msg.clue);
    if (msg.type === 'advance_vote') return this.advanceToVote(playerId);
    if (msg.type === 'cast_vote') return this.castVote(playerId, msg.targetId);
    if (msg.type === 'finish_vote') return this.forceFinishVote(playerId);
    if (msg.type === 'next_round') return this.nextRound(playerId);
    if (msg.type === 'back_lobby') return this.backToLobby(playerId);
    return null;
  }
}
