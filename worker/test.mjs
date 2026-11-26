import assert from 'node:assert/strict';
import { LobbyDO, RoomDO } from './src/index.mjs';
import { RoomEngine, buildPublicRoomList, DEFAULT_PUBLIC_ROOMS } from './src/roomEngine.mjs';

// Test 0: Featured public rooms always present & online count aggregates properly
const emptyLobby = buildPublicRoomList([]);
assert.equal(emptyLobby.rooms.length, DEFAULT_PUBLIC_ROOMS.length);
assert.equal(emptyLobby.totalOnline, 0);
const activeLobby = buildPublicRoomList([
  { code: '100001', name: 'Food & Drinks', isPublic: true, playerCount: 3, humanCount: 2, maxPlayers: 8, imposterCount: 1, categories: ['Food & Drinks'], phase: 'lobby', readyToStart: true, avatars: [], updatedAt: Date.now() }
]);
assert.equal(activeLobby.totalOnline, 2);
assert.equal(activeLobby.rooms.find((r) => r.code === '100001').playerCount, 3);

// Full lifecycle + anti-F12 secret isolation check
const engine = new RoomEngine('123456', { isPublic: true, name: 'Test Room', imposterCount: 1, imposterHint: true });

assert.equal(engine.addPlayer('h1', 'Alice').ok, true);
assert.equal(engine.players[0].isHost, true);
assert.equal(engine.startGame('h1').ok, false, 'Cannot start with < 3 players');

// Host adds 2 AI bots to solve cold start
assert.equal(engine.addBot('h1').ok, true);
assert.equal(engine.addBot('h1').ok, true);
assert.equal(engine.players.length, 3);
assert.equal(engine.getPublicSummary().readyToStart, true);

// Start game & verify secret word is never leaked to imposter
assert.equal(engine.startGame('h1').ok, true);
assert.equal(engine.phase, 'reveal');
for (const p of engine.players) {
  const s = engine.getStateForPlayer(p.id).room;
  if (engine.imposterIds.has(p.id)) {
    assert.equal(s.myRole.role, 'imposter');
    assert.equal('word' in s.myRole, false, 'Imposter payload must never include secret word');
  } else {
    assert.equal(s.myRole.role, 'crew');
    assert.ok(s.myRole.word.length > 0);
  }
}

// Ready -> clues -> bots auto-post clues -> human submits clue -> vote
engine.playerReady('h1');
assert.equal(engine.phase, 'clues');
assert.equal(engine.turnOrder[engine.turnIndex], 'h1', 'Bots before human should auto-post immediately');
assert.equal(engine.submitClue('h1', 'Tasty').ok, true);
assert.equal(engine.phase, 'vote');
assert.equal(engine.clues.length, 3);

// Human votes for a bot -> resolves to result
const target = engine.players.find((p) => p.id !== 'h1').id;
assert.equal(engine.castVote('h1', target).ok, true);
assert.equal(engine.phase, 'result');
assert.ok(engine.result.secretWord.length > 0);
assert.equal(engine.result.imposterIds.length, 1);

// Test 2: Multi-human mid-game disconnect auto-advances + tie vote + category dedup
const e2 = new RoomEngine('654321', { isPublic: false });
e2.addPlayer('p1', 'Alice');
e2.addPlayer('p2', 'Bob');
e2.addPlayer('p3', 'Carol');
e2.handleMessage('p1', { type: 'update_settings', patch: { categories: ['everyday-food', 'everyday-food', 'animals'] } });
assert.deepEqual(e2.categories, ['everyday-food', 'animals'], 'Categories must be deduplicated');

assert.equal(e2.handleMessage('p1', { type: 'start_game' }).ok, true);
e2.playerReady('p1');
e2.playerReady('p2');
// p3 disconnects during reveal -> remaining connected humans are all ready -> enters clues
e2.disconnectPlayer('p3');
assert.equal(e2.phase, 'clues', 'Disconnect in reveal should advance when remaining humans are ready');

// Submit clues for remaining connected turns (disconnected p3 auto-skips)
while (e2.phase === 'clues') {
  const cur = e2.turnOrder[e2.turnIndex];
  assert.equal(e2.handleMessage(cur, { type: 'submit_clue', clue: 'Test' }).ok, true);
}
assert.equal(e2.phase, 'vote');

// Tie vote between p1 and p2
e2.castVote('p1', 'p2');
e2.castVote('p2', 'p1');
assert.equal(e2.phase, 'result');
assert.equal(e2.result.isTie, true);
assert.equal(e2.result.ejectedId, null);
assert.equal(e2.result.crewWon, false);

console.log('PASS: RoomEngine lifecycle, AI bots, anti-F12 isolation, disconnect recovery, tie vote, and dedup verified.');

// Restored rooms keep waiting for reserved seats while their reconnect window is open.
const graceSource = new RoomEngine('234567');
const [alice, bob, carol] = ['Alice', 'Bob', 'Carol'].map(
  (name) => graceSource.joinPlayer(null, name).player
);
graceSource.startGame(alice.id);
let snapshots = 0;
const resumedReveal = new RoomEngine(graceSource.code, {}, {
  onSummaryChange: () => { snapshots += 1; }
});
resumedReveal.restore(structuredClone(graceSource.snapshot()));
resumedReveal.joinPlayer(alice.reconnectToken, alice.name);
resumedReveal.playerReady(alice.id);
assert.equal(resumedReveal.phase, 'reveal');
const beforeDuplicateReady = snapshots;
resumedReveal.playerReady(alice.id);
assert.equal(snapshots, beforeDuplicateReady);
assert.equal(resumedReveal.finishReconnectGrace(), false);
resumedReveal.joinPlayer(bob.reconnectToken, bob.name);
resumedReveal.playerReady(bob.id);
resumedReveal.joinPlayer(carol.reconnectToken, carol.name);
resumedReveal.playerReady(carol.id);
assert.equal(resumedReveal.phase, 'clues', 'Everyone ready can advance before the deadline');
while (resumedReveal.phase === 'clues') {
  resumedReveal.submitClue(resumedReveal.turnOrder[resumedReveal.turnIndex], 'Clue');
}
assert.equal(resumedReveal.phase, 'vote');

const resumedVote = new RoomEngine(graceSource.code, {}, {
  onSummaryChange: () => { snapshots += 1; }
});
resumedVote.restore(structuredClone(resumedReveal.snapshot()));
resumedVote.joinPlayer(alice.reconnectToken, alice.name);
assert.equal(resumedVote.castVote(alice.id, bob.id).ok, true);
assert.equal(resumedVote.phase, 'vote');
const beforeDuplicateVote = snapshots;
assert.equal(resumedVote.castVote(alice.id, bob.id).ok, true);
assert.equal(snapshots, beforeDuplicateVote);
assert.equal(resumedVote.castVote(alice.id, carol.id).ok, true);
assert.equal(snapshots, beforeDuplicateVote + 1, 'A real vote change is still persisted');
resumedVote.reconnectUntil = Date.now() - 1;
assert.ok(Number.isFinite(resumedVote.reconnectCheckAt()));
assert.equal(resumedVote.finishReconnectGrace(), true);
assert.equal(resumedVote.phase, 'result');
assert.equal(resumedVote.result.ejectedId, carol.id);
assert.equal(resumedVote.reconnectCheckAt(), Infinity);

// Real RoomDO handlers with an in-memory storage double and WebSocket transport.
function makeState(entries = new Map()) {
  return {
    storage: {
      async get(key) { return structuredClone(entries.get(key)); },
      async list() { return structuredClone(entries); },
      async put(key, value) { entries.set(key, structuredClone(value)); },
      async delete(keys) { for (const key of [keys].flat()) entries.delete(key); },
      async deleteAll() { entries.clear(); },
      async getAlarm() { return entries.get('test-alarm') ?? null; },
      async setAlarm(at) { entries.set('test-alarm', at); },
      async deleteAlarm() { entries.delete('test-alarm'); }
    },
    blockConcurrencyWhile(fn) { this.ready = fn(); },
    waitUntil(promise) { this.pending = promise; }
  };
}

const NativeResponse = globalThis.Response;
class TestSocket extends EventTarget {
  messages = [];
  accept() {}
  close() { this.dispatchEvent(new Event('close')); }
  send(data) { this.messages.push(JSON.parse(data)); }
  receive(message) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }
}

try {
  globalThis.WebSocketPair = class {
    0 = {};
    1 = new TestSocket();
    constructor() { this[0].server = this[1]; }
  };
  globalThis.Response = class extends NativeResponse {
    constructor(body, options) {
      super(body, options?.status === 101 ? { status: 200 } : options);
      this.webSocket = options?.webSocket;
    }
  };
  const code = '234567';
  const storage = new Map();
  const originalState = makeState(storage);
  const room = new RoomDO(originalState, {});
  await originalState.ready;
  const init = await room.fetch(new Request('https://room/init', {
    method: 'POST',
    body: JSON.stringify({ code, name: 'Stored Room' })
  }));
  assert.equal(init.status, 200);

  async function connect(instance, join, roomCode = code) {
    const response = await instance.fetch(new Request(`https://room/ws?code=${roomCode}`, {
      headers: { Upgrade: 'websocket' }
    }));
    const socket = response.webSocket.server;
    socket.receive({ type: 'join', ...join });
    return socket;
  }

  const host = await connect(room, { name: 'Host' });
  const [hostJoined, hostState] = host.messages;
  const hostId = hostState.room.meId;
  assert.equal(room.engine.playerForReconnect(hostId), undefined);
  const guest = await connect(room, { name: 'Guest' });
  const [guestJoined, guestState] = guest.messages;
  assert.notEqual(guestState.room.meId, hostId);
  assert.notEqual(guestJoined.reconnectToken, hostJoined.reconnectToken);
  assert.equal(JSON.stringify(guest.messages).includes(hostJoined.reconnectToken), false);
  assert.equal(guestState.room.players.find((player) => player.id === hostId).isHost, true);
  host.receive({ type: 'add_bot' });
  host.receive({ type: 'start_game' });
  const before = host.messages.at(-1).room;
  assert.equal(before.phase, 'reveal');
  await originalState.pending;

  const restartedState = makeState(storage);
  const restarted = new RoomDO(restartedState, {});
  await restartedState.ready;
  const rejoined = await connect(restarted, { reconnectToken: hostJoined.reconnectToken, name: 'Host' });
  const after = rejoined.messages.at(-1).room;
  assert.equal(after.code, code);
  assert.equal(after.name, 'Stored Room');
  assert.equal(after.meId, hostId);
  assert.equal(after.phase, 'reveal');
  assert.deepEqual(after.myRole, before.myRole);
  assert.equal(after.players.find((player) => player.id === hostId).isHost, true);
  assert.equal(after.players.find((player) => player.id === guestState.room.meId).connected, false);

  const lobbyStorage = new Map();
  const lobbyState = makeState(lobbyStorage);
  const lobby = new LobbyDO(lobbyState);
  await lobbyState.ready;
  await lobby.fetch(new Request('https://lobby/upsert', {
    method: 'POST',
    body: JSON.stringify({ ...room.engine.getPublicSummary(), isPublic: true })
  }));
  const newLobbyState = makeState(lobbyStorage);
  const newLobby = new LobbyDO(newLobbyState);
  await newLobbyState.ready;
  const listing = await (await newLobby.fetch(new Request('https://lobby/list'))).json();
  assert.equal(listing.rooms.find((summary) => summary.code === code).humanCount, 2);
  const lobbyUpdates = [];
  const publicState = makeState();
  const publicRoom = new RoomDO(publicState, { LOBBY: {
    idFromName: (name) => name,
    get: () => ({ fetch: async (url, options) => {
      lobbyUpdates.push(JSON.parse(options.body));
      return new NativeResponse();
    } })
  } });
  await publicState.ready;
  const featuredCode = '100001';
  const first = await connect(publicRoom, { name: 'Featured host' }, featuredCode);
  const { reconnectToken } = first.messages[0];
  first.receive({ type: 'update_settings', patch: { imposterHint: false } });
  first.receive({ type: 'update_settings', patch: { imposterHint: true } });
  assert.equal(lobbyUpdates.length, 1, 'Private settings do not rewrite the public summary');
  await publicRoom.alarm();
  assert.equal(lobbyUpdates.length, 1, 'An early alarm does not rewrite the summary');
  publicRoom.lastLobbyUpdate.sentAt -= 5 * 60 * 1000;
  await publicRoom.alarm();
  assert.equal(lobbyUpdates.length, 2, 'An idle public room refreshes its lobby entry');
  first.receive({ type: 'add_bot' });
  first.receive({ type: 'add_bot' });
  first.receive({ type: 'start_game' });
  const featuredRole = first.messages.at(-1).room.myRole;
  first.close();
  const newcomer = await connect(publicRoom, { name: 'Newcomer' }, featuredCode);
  assert.equal(newcomer.messages[0].type, 'error');
  const returned = await connect(publicRoom, { reconnectToken, name: 'Featured host' }, featuredCode);
  assert.equal(returned.messages.at(-1).room.phase, 'reveal');
  assert.deepEqual(returned.messages.at(-1).room.myRole, featuredRole);
  returned.close();
  publicRoom.engine.reconnectUntil = Date.now() - 1;
  const fresh = await connect(publicRoom, { name: 'New host' }, featuredCode);
  assert.equal(fresh.messages.at(-1).room.phase, 'lobby');
  fresh.close();

  const fullStorage = new Map();
  const fullEngine = new RoomEngine(code, { maxPlayers: 3 });
  const returningHost = fullEngine.joinPlayer(null, 'Host').player;
  fullEngine.joinPlayer(null, 'Guest 1');
  fullEngine.joinPlayer(null, 'Guest 2');
  fullStorage.set('room', fullEngine.snapshot());
  const fullState = makeState(fullStorage);
  const fullRoom = new RoomDO(fullState, {});
  await fullState.ready;
  const fullHost = await connect(fullRoom, { reconnectToken: returningHost.reconnectToken });
  assert.equal(fullHost.messages.at(-1).room.meId, returningHost.id);
  const tooEarly = await connect(fullRoom, { name: 'Replacement' });
  assert.equal(tooEarly.messages[0].message, 'Room is full.');
  fullRoom.engine.reconnectUntil = Date.now() - 1;
  await fullRoom.alarm();
  assert.equal(fullHost.messages.at(-1).room.players.length, 1);
  const afterGrace = await connect(fullRoom, { name: 'Replacement' });
  assert.equal(afterGrace.messages.at(-1).room.players.length, 2);

  const expiredStorage = new Map();
  const expiredState = makeState(expiredStorage);
  const expiredRoom = new RoomDO(expiredState, {});
  await expiredState.ready;
  await expiredRoom.fetch(new Request('https://room/init', {
    method: 'POST',
    body: JSON.stringify({ code })
  }));
  assert.ok(expiredStorage.get('test-alarm'));
  await expiredRoom.alarm();
  assert.ok(expiredStorage.has('room'), 'Early alarms preserve rooms');
  expiredRoom.engine.updatedAt -= 25 * 60 * 60 * 1000;
  await expiredRoom.alarm();
  assert.equal(expiredStorage.size, 0, 'Expiry deletes the stored snapshot and alarm');
  assert.equal((await expiredRoom.fetch(new Request(`https://room/ws?code=${code}`, {
    headers: { Upgrade: 'websocket' }
  }))).status, 404);
} finally {
  globalThis.Response = NativeResponse;
  delete globalThis.WebSocketPair;
}

console.log('PASS: reconnect credentials, room recovery, featured grace, stale seats, idle deletion, lobby throttling, reconnect round gates, and duplicate messages.');
