import assert from 'node:assert/strict';
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
