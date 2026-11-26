(() => {
  const root = document.getElementById('imposter-game-app');
  if (!root || !window.IMPOSTER_DATA) return;

  const categories = window.IMPOSTER_DATA.categories;
  const botProfiles = window.IMPOSTER_DATA.bots || [];
  const soloWords = window.IMPOSTER_DATA.soloWords || [];
  const defaultCategory = root.dataset.defaultCategory || 'everyday-food';

  const AVATAR_POOL = [
    { color: '#007cff', icon: '🧑‍🚀' },
    { color: '#ff0030', icon: '🦊' },
    { color: '#10b981', icon: '🤖' },
    { color: '#f59e0b', icon: '👽' },
    { color: '#8b5cf6', icon: '🐱' },
    { color: '#ec4899', icon: '🦄' },
    { color: '#06b6d4', icon: '🐸' },
    { color: '#f97316', icon: '🦖' },
    { color: '#6366f1', icon: '👾' },
    { color: '#14b8a6', icon: '🐼' },
    { color: '#e11d48', icon: '🐙' },
    { color: '#0284c7', icon: '🐧' }
  ];

  // Resolve multiplayer backend API base (local preview vs deployed Cloudflare Worker)
  const isLocalHost = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  const API_BASE = (window.IMPOSTER_ONLINE_API || (isLocalHost ? location.origin : 'https://api.impostergameonline.net')).replace(/\/$/, '');
  const WS_BASE = API_BASE.replace(/^http/, 'ws');

  // Web Audio sound effects (zero external assets)
  let soundEnabled = true;
  let audioCtx = null;

  function playTone(freq, duration = 0.08, type = 'sine', gainVal = 0.07) {
    if (!soundEnabled) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // Ignore audio errors on restricted devices
    }
  }

  const sfx = {
    click: () => playTone(520, 0.05, 'triangle', 0.05),
    flip: () => {
      playTone(340, 0.07, 'sine', 0.06);
      setTimeout(() => playTone(560, 0.09, 'sine', 0.06), 50);
    },
    imposter: () => {
      playTone(220, 0.14, 'sawtooth', 0.05);
      setTimeout(() => playTone(185, 0.18, 'sawtooth', 0.05), 110);
    },
    win: () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.13, 'triangle', 0.07), i * 80));
    }
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getSavedPlayerId() {
    let id = localStorage.getItem('igo_player_id');
    if (!id) {
      id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('igo_player_id', id);
    }
    return id;
  }

  const urlParams = new URLSearchParams(location.search);
  const initialRoomParam = (urlParams.get('room') || '').replace(/\D/g, '').slice(0, 6);

  const state = {
    mode: initialRoomParam.length === 6 ? 'online' : 'passplay', // 'passplay' | 'online' | 'solo'
    phase: 'setup', // setup | reveal | discuss | vote | result | solo-play | solo-guess | solo-result | online-room
    subview: null, // null | 'players' | 'categories' | 'online-categories'
    // Pass & Play state
    playerCount: 4,
    imposterCount: 1,
    imposterHint: true,
    timerMinutes: 2,
    selectedCategories: new Set([defaultCategory]),
    useCustomWord: false,
    customWord: '',
    customHint: '',
    players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    scores: {},
    round: 1,
    currentRevealIdx: 0,
    cardFlipped: false,
    secretWord: '',
    secretHint: '',
    secretCategory: '',
    imposterIndices: new Set(),
    firstSpeakerIdx: 0,
    timerSeconds: 120,
    timerRunning: false,
    timerHandle: null,
    votedOutIdx: null,
    usedWords: new Set(),
    // Solo vs AI state
    soloRolePref: 'random',
    soloBotCount: 3,
    soloRoster: [],
    soloImposterIdx: 0,
    soloEntry: null,
    soloClues: [],
    soloPendingAfterHuman: [],
    soloUserSubmitted: false,
    soloVotedIdx: null,
    soloGuessOptions: [],
    soloGuessCorrect: null,
    soloWins: 0,
    soloGames: 0,
    soloUsedWords: new Set(),
    // Online Multiplayer state
    playerId: getSavedPlayerId(),
    nickname: localStorage.getItem('igo_nickname') || '',
    publicRooms: [],
    totalOnline: 0,
    roomsLoading: false,
    onlineError: '',
    joinExpanded: initialRoomParam.length === 6,
    joinCodeInput: initialRoomParam,
    createModalOpen: false,
    createIsPublic: false,
    createRoomName: '',
    ws: null,
    room: null,
    onlineCardFlipped: false,
    copiedNotice: false
  };

  function ensurePlayerNames() {
    while (state.players.length < state.playerCount) {
      state.players.push(`Player ${state.players.length + 1}`);
    }
    state.players = state.players.slice(0, state.playerCount);
    state.players.forEach((name) => {
      if (state.scores[name] === undefined) state.scores[name] = 0;
    });
    const maxImp = Math.max(1, Math.min(3, Math.floor((state.playerCount - 1) / 2)));
    if (state.imposterCount > maxImp) state.imposterCount = maxImp;
  }

  function stopTimer() {
    if (state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
    state.timerRunning = false;
  }

  function startTimer() {
    if (state.timerMinutes === 0 || state.timerRunning) return;
    state.timerRunning = true;
    state.timerHandle = setInterval(() => {
      if (state.timerSeconds > 0) {
        state.timerSeconds -= 1;
        const el = document.getElementById('timer-display');
        if (el) {
          el.textContent = formatTime(state.timerSeconds);
          el.classList.toggle('urgent', state.timerSeconds <= 15);
        }
        if (state.timerSeconds <= 5 && state.timerSeconds > 0) playTone(680, 0.05, 'sine', 0.04);
      } else {
        stopTimer();
        sfx.imposter();
        render();
      }
    }, 1000);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function avatarHtml(idx, customProfile) {
    const p = customProfile || AVATAR_POOL[idx % AVATAR_POOL.length];
    return `<span class="avatar-badge" style="background:${p.color}22;border-color:${p.color};">${p.icon}</span>`;
  }

  function initialAvatarHtml(initial, color) {
    return `<span class="initial-avatar" style="background:${color || '#007cff'};">${escapeHtml(initial || '?')}</span>`;
  }

  function selectedCategoriesLabel(catSet) {
    if (state.useCustomWord && catSet === state.selectedCategories) return 'Custom Word';
    const names = categories.filter((c) => catSet.has(c.id)).map((c) => c.name);
    if (!names.length) return 'Food & Drinks';
    if (names.length === 1) return names[0];
    return `${names[0]} +${names.length - 1}`;
  }

  // ===== ONLINE MULTIPLAYER CLIENT =====
  async function fetchPublicRooms() {
    state.roomsLoading = true;
    state.onlineError = '';
    render();
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Server unavailable');
      const data = await res.json();
      state.publicRooms = Array.isArray(data.rooms) ? data.rooms : [];
      state.totalOnline = Number(data.totalOnline) || 0;
    } catch {
      state.publicRooms = [];
      state.totalOnline = 0;
      state.onlineError = 'Multiplayer server is offline or not deployed yet. Run local preview or deploy worker/.';
    } finally {
      state.roomsLoading = false;
      render();
    }
  }

  function disconnectOnline(keepMode = true) {
    if (state.ws) {
      try { state.ws.close(); } catch {}
      state.ws = null;
    }
    state.room = null;
    state.onlineCardFlipped = false;
    state.subview = null;
    if (state.phase === 'online-room') state.phase = 'setup';
    if (keepMode) state.mode = 'online';
    if (urlParams.has('room')) {
      const cleanUrl = `${location.pathname}${location.hash}`;
      history.replaceState(null, '', cleanUrl);
    }
  }

  function wsSend(payload) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify(payload));
    }
  }

  function connectToRoom(code, nickname) {
    const cleanCode = String(code || '').replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      state.onlineError = 'Enter a valid 6-digit room code.';
      render();
      return;
    }
    const cleanName = (nickname || state.nickname || '').trim() || `Player ${Math.floor(10 + Math.random() * 89)}`;
    state.nickname = cleanName;
    localStorage.setItem('igo_nickname', cleanName);
    state.onlineError = '';

    if (state.ws) {
      try { state.ws.close(); } catch {}
    }

    const ws = new WebSocket(`${WS_BASE}/api/rooms/${cleanCode}/ws`);
    state.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', playerId: state.playerId, name: cleanName }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'error') {
        state.onlineError = msg.message || 'Room error';
        render();
        return;
      }
      if (msg.type === 'state' && msg.room) {
        const prevPhase = state.room?.phase;
        state.room = msg.room;
        state.phase = 'online-room';
        state.joinExpanded = false;
        state.createModalOpen = false;
        state.onlineError = '';
        if (prevPhase !== msg.room.phase) {
          state.onlineCardFlipped = false;
          if (msg.room.phase === 'reveal') sfx.flip();
          else if (msg.room.phase === 'result') {
            if (msg.room.result?.crewWon) sfx.win();
            else sfx.imposter();
          }
        }
        render();
      }
    };

    ws.onerror = () => {
      state.onlineError = `Could not connect to Room #${cleanCode}. Check the code or server status.`;
      render();
    };

    ws.onclose = () => {
      if (state.ws === ws) {
        state.ws = null;
        if (state.phase === 'online-room') {
          state.phase = 'setup';
          state.room = null;
          if (!state.onlineError) state.onlineError = 'Disconnected from room.';
          render();
        }
      }
    };
  }

  async function createOnlineRoom() {
    const cleanName = (state.nickname || '').trim() || `Host ${Math.floor(10 + Math.random() * 89)}`;
    state.nickname = cleanName;
    localStorage.setItem('igo_nickname', cleanName);
    state.onlineError = '';

    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: state.createIsPublic,
          name: state.createRoomName.trim() || `${cleanName}'s Room`,
          imposterCount: state.imposterCount,
          imposterHint: state.imposterHint,
          timerMinutes: state.timerMinutes,
          categories: Array.from(state.selectedCategories)
        })
      });
      if (!res.ok) throw new Error('Could not create room');
      const data = await res.json();
      sfx.click();
      connectToRoom(data.code, cleanName);
    } catch {
      state.onlineError = 'Unable to reach multiplayer server. Start local preview or deploy Cloudflare Worker.';
      state.createModalOpen = false;
      render();
    }
  }

  // ===== SOLO VS AI LOGIC =====
  function startSoloRound() {
    const fresh = soloWords.filter((w) => !state.soloUsedWords.has(w.word));
    const pool = fresh.length ? fresh : soloWords;
    if (!fresh.length) state.soloUsedWords.clear();
    const entry = pool[Math.floor(Math.random() * pool.length)];
    state.soloUsedWords.add(entry.word);
    state.soloEntry = entry;

    const chosenBots = shuffle(botProfiles).slice(0, state.soloBotCount);
    const roster = [
      { name: 'You', isHuman: true, color: '#ff0030', icon: '🕵️' },
      ...chosenBots.map((b) => ({ ...b, isHuman: false }))
    ];
    state.soloRoster = roster;

    if (state.soloRolePref === 'imposter') state.soloImposterIdx = 0;
    else if (state.soloRolePref === 'crew') state.soloImposterIdx = 1 + Math.floor(Math.random() * state.soloBotCount);
    else state.soloImposterIdx = Math.floor(Math.random() * roster.length);

    const order = shuffle(roster.map((_, i) => i));
    const innocentClues = shuffle(entry.clues);
    const bluffClues = shuffle(entry.bluffs);
    let clueCursor = 0;
    let bluffCursor = 0;

    state.soloClues = [];
    const humanPos = order.indexOf(0);
    state.soloPendingAfterHuman = [];

    order.forEach((playerIdx, pos) => {
      if (playerIdx === 0) return;
      const isImp = playerIdx === state.soloImposterIdx;
      const word = isImp
        ? bluffClues[bluffCursor++ % bluffClues.length]
        : innocentClues[clueCursor++ % innocentClues.length];
      const item = { playerIdx, clue: word };
      if (pos < humanPos) state.soloClues.push(item);
      else state.soloPendingAfterHuman.push(item);
    });

    state.soloUserSubmitted = false;
    state.soloVotedIdx = null;
    state.soloGuessCorrect = null;

    const distractors = shuffle(soloWords.filter((w) => w.word !== entry.word && w.category === entry.category))
      .slice(0, 3)
      .map((w) => w.word);
    while (distractors.length < 3) {
      const extra = soloWords[Math.floor(Math.random() * soloWords.length)].word;
      if (extra !== entry.word && !distractors.includes(extra)) distractors.push(extra);
    }
    state.soloGuessOptions = shuffle([entry.word, ...distractors]);

    state.phase = 'solo-play';
    if (state.soloImposterIdx === 0) sfx.imposter();
    else sfx.flip();
    render();
  }

  function submitSoloClue(clueText) {
    const clean = clueText.trim().split(/\s+/)[0] || 'Classic';
    state.soloClues.push({ playerIdx: 0, clue: clean });
    state.soloUserSubmitted = true;
    sfx.click();
    state.soloPendingAfterHuman.forEach((item) => state.soloClues.push(item));
    state.soloPendingAfterHuman = [];
    render();
  }

  function resolveSoloVote(votedIdx) {
    state.soloVotedIdx = votedIdx;
    state.soloGames += 1;
    const humanIsImp = state.soloImposterIdx === 0;
    const caught = votedIdx === state.soloImposterIdx;

    if (humanIsImp) {
      if (Math.random() < 0.55) {
        state.soloVotedIdx = 0;
        state.phase = 'solo-guess';
        sfx.imposter();
        render();
        return;
      }
      state.soloVotedIdx = 1 + Math.floor(Math.random() * state.soloBotCount);
      state.soloWins += 1;
      sfx.win();
      state.phase = 'solo-result';
      render();
      return;
    }

    if (caught) { state.soloWins += 1; sfx.win(); }
    else sfx.imposter();
    state.phase = 'solo-result';
    render();
  }

  // ===== PASS & PLAY LOGIC =====
  function pickSecretWord() {
    if (state.useCustomWord && state.customWord.trim()) {
      return {
        word: state.customWord.trim(),
        hint: state.customHint.trim() || 'Custom topic',
        category: 'Custom Pack'
      };
    }
    const pool = [];
    categories.forEach((cat) => {
      if (state.selectedCategories.has(cat.id)) {
        cat.words.forEach((entry) => pool.push({ ...entry, category: cat.name }));
      }
    });
    const activePool = pool.length ? pool : categories[0].words.map((w) => ({ ...w, category: categories[0].name }));
    let fresh = activePool.filter((item) => !state.usedWords.has(item.word));
    if (!fresh.length) {
      state.usedWords.clear();
      fresh = activePool;
    }
    const chosen = fresh[Math.floor(Math.random() * fresh.length)];
    state.usedWords.add(chosen.word);
    return chosen;
  }

  function startPassPlayRound() {
    ensurePlayerNames();
    const chosen = pickSecretWord();
    state.secretWord = chosen.word;
    state.secretHint = chosen.hint;
    state.secretCategory = chosen.category;

    const indices = shuffle(Array.from({ length: state.playerCount }, (_, i) => i));
    state.imposterIndices = new Set(indices.slice(0, state.imposterCount));
    state.firstSpeakerIdx = Math.floor(Math.random() * state.playerCount);
    state.currentRevealIdx = 0;
    state.cardFlipped = false;
    state.votedOutIdx = null;
    state.timerSeconds = state.timerMinutes * 60;
    stopTimer();
    state.subview = null;
    state.phase = 'reveal';
    sfx.click();
    render();
  }

  // ===== RENDERERS =====
  function renderBrandBanner() {
    const subText =
      state.phase === 'online-room' && state.room
        ? `Room #${state.room.code} • ${state.room.players.length}/${state.room.maxPlayers} Players`
        : state.phase === 'setup'
          ? 'Find the Imposter — Free Browser App'
          : state.mode === 'solo'
            ? `Solo vs AI • Wins ${state.soloWins}/${state.soloGames}`
            : `Pass & Play • Round ${state.round}`;

    return `
      <div class="app-brand-banner">
        <div class="app-brand-left">
          <div class="app-brand-mark" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/>
              <circle cx="12" cy="12" r="3" fill="#000"/>
            </svg>
          </div>
          <div style="min-width:0;">
            <div class="app-brand-title">Imposter Game</div>
            <div class="app-brand-sub">${escapeHtml(subText)}</div>
          </div>
        </div>
        <div class="app-banner-actions">
          <button type="button" class="banner-icon-btn" id="toggle-sound" title="${soundEnabled ? 'Mute sound' : 'Unmute sound'}">
            ${soundEnabled ? '🔊' : '🔇'}
          </button>
          ${
            state.phase !== 'setup'
              ? '<button type="button" class="banner-icon-btn" id="btn-reset" title="Back to home">✕</button>'
              : ''
          }
        </div>
      </div>
    `;
  }

  function renderModeSelector() {
    return `
      <div class="app-mode-grid" role="tablist">
        <button type="button" class="app-mode-card ${state.mode === 'passplay' ? 'selected' : ''}" id="tab-passplay">
          <span class="mode-check">✓</span>
          <span class="app-mode-icon">📱</span>
          <strong>Pass the phone</strong>
          <small>Everyone uses one screen</small>
        </button>
        <button type="button" class="app-mode-card ${state.mode === 'online' ? 'selected' : ''}" id="tab-online">
          <span class="mode-check">✓</span>
          <span class="app-mode-icon">🌐</span>
          <strong>Play online</strong>
          <small>Private &amp; public rooms</small>
        </button>
      </div>
      <button type="button" class="app-solo-bar ${state.mode === 'solo' ? 'selected' : ''}" id="tab-solo">
        <div class="app-solo-bar-left">
          <span style="font-size:1.3rem;">🤖</span>
          <div>
            <strong>Solo vs AI Bots</strong>
            <small>Play immediately by yourself (1 player)</small>
          </div>
        </div>
        <span class="solo-check-pill">${state.mode === 'solo' ? '✓ Active' : '1P'}</span>
      </button>
    `;
  }

  // Pass the Phone Setup + In-Place Subviews
  function renderPlayersSubview() {
    const rows = state.players
      .map(
        (name, idx) => `
          <div class="player-edit-row">
            ${avatarHtml(idx)}
            <input type="text" class="player-name-input" data-idx="${idx}" value="${escapeHtml(name)}" maxlength="20" aria-label="Player ${idx + 1} name" />
            ${
              state.playerCount > 3
                ? `<button type="button" class="modal-close" data-remove-player="${idx}" aria-label="Remove player">✕</button>`
                : ''
            }
          </div>
        `
      )
      .join('');

    return `
      <div class="subview-header">
        <button type="button" class="circle-back-btn" id="btn-subview-back" aria-label="Back">‹</button>
        <h2>Players (${state.playerCount})</h2>
      </div>
      <div class="player-edit-list">${rows}</div>
      ${
        state.playerCount < 12
          ? `<button type="button" class="pill-btn pill-btn-black" id="btn-add-player">+ Add Player</button>`
          : ''
      }
      <div style="text-align:center;margin-top:0.75rem;">
        <button type="button" id="btn-reset-players" style="background:none;border:none;color:var(--text-muted);text-decoration:underline;font-weight:700;cursor:pointer;font-family:inherit;">Reset players</button>
      </div>
    `;
  }

  function renderCategoriesSubview(isOnline = false) {
    const activeSet = isOnline ? new Set(state.room?.categories || ['everyday-food']) : state.selectedCategories;
    const rows = categories
      .map((cat) => {
        const checked = (!isOnline ? !state.useCustomWord : true) && activeSet.has(cat.id);
        return `
          <button type="button" class="ios-row clickable" data-cat-toggle="${cat.id}">
            <div class="ios-row-label" style="display:flex;align-items:center;gap:0.6rem;">
              <span style="font-size:1.25rem;">${cat.emoji}</span>
              <div>
                <strong>${escapeHtml(cat.name)}</strong>
                <small>${cat.words.length} words</small>
              </div>
            </div>
            <span class="check-circle ${checked ? 'checked' : ''}">✓</span>
          </button>
        `;
      })
      .join('');

    return `
      <div class="subview-header">
        <button type="button" class="circle-back-btn" id="btn-subview-back" aria-label="Back">‹</button>
        <h2>Categories</h2>
      </div>
      <div class="ios-group">${rows}</div>
      ${
        !isOnline
          ? `
            <div class="ios-group">
              <button type="button" class="ios-row clickable" id="btn-custom-mode">
                <div class="ios-row-label" style="display:flex;align-items:center;gap:0.6rem;">
                  <span style="font-size:1.25rem;">✏️</span>
                  <div>
                    <strong>Custom Word</strong>
                    <small>Type your own secret word &amp; hint</small>
                  </div>
                </div>
                <span class="check-circle ${state.useCustomWord ? 'checked' : ''}">✓</span>
              </button>
            </div>
            ${
              state.useCustomWord
                ? `<div style="margin-bottom:0.9rem;">
                     <input type="text" id="input-custom-word" placeholder="Secret word (e.g. Haunted House)" value="${escapeHtml(state.customWord)}" style="margin-bottom:0.5rem;" />
                     <input type="text" id="input-custom-hint" placeholder="Optional Imposter hint (e.g. Spooky place)" value="${escapeHtml(state.customHint)}" />
                   </div>`
                : ''
            }
          `
          : ''
      }
      <button type="button" class="pill-btn pill-btn-black" id="btn-subview-done">Done</button>
    `;
  }

  function renderPassPlaySetup() {
    if (state.subview === 'players') return renderPlayersSubview();
    if (state.subview === 'categories') return renderCategoriesSubview(false);

    const maxImp = Math.max(1, Math.min(3, Math.floor((state.playerCount - 1) / 2)));
    return `
      ${renderModeSelector()}
      <div class="ios-group">
        <button type="button" class="ios-row clickable" id="row-open-players">
          <div class="ios-row-label">
            <strong>👥 Players</strong>
            <small>${escapeHtml(state.players.slice(0, 3).join(', '))}${state.playerCount > 3 ? ` +${state.playerCount - 3}` : ''}</small>
          </div>
          <div class="ios-row-right">
            <span>${state.playerCount}</span>
            <span class="ios-chevron">›</span>
          </div>
        </button>

        <div class="ios-row">
          <div class="ios-row-label">
            <strong>🕵️ Imposters</strong>
            <small>Max ${maxImp} for ${state.playerCount} players</small>
          </div>
          <div class="stepper">
            <button type="button" id="imp-minus" aria-label="Decrease imposters">−</button>
            <span>${state.imposterCount}</span>
            <button type="button" id="imp-plus" aria-label="Increase imposters">+</button>
          </div>
        </div>

        <div class="ios-row">
          <div class="ios-row-label">
            <strong>💡 Hints for Imposter</strong>
            <small>Show a subtle clue word</small>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggle-hint" ${state.imposterHint ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <button type="button" class="ios-row clickable" id="row-open-categories">
          <div class="ios-row-label">
            <strong>📚 Categories</strong>
            <small>Tap to pick packs or custom word</small>
          </div>
          <div class="ios-row-right">
            <span>${escapeHtml(selectedCategoriesLabel(state.selectedCategories))}</span>
            <span class="ios-chevron">›</span>
          </div>
        </button>

        <div class="ios-row">
          <div class="ios-row-label">
            <strong>⏱️ Discussion Timer</strong>
            <small>Countdown per round</small>
          </div>
          <div style="width:118px;">
            <select id="select-timer" aria-label="Discussion Timer">
              <option value="1" ${state.timerMinutes === 1 ? 'selected' : ''}>1 min</option>
              <option value="2" ${state.timerMinutes === 2 ? 'selected' : ''}>2 mins</option>
              <option value="3" ${state.timerMinutes === 3 ? 'selected' : ''}>3 mins</option>
              <option value="5" ${state.timerMinutes === 5 ? 'selected' : ''}>5 mins</option>
              <option value="0" ${state.timerMinutes === 0 ? 'selected' : ''}>No limit</option>
            </select>
          </div>
        </div>
      </div>

      <button type="button" class="pill-btn pill-btn-black" id="btn-start">Start Game</button>
    `;
  }

  // Online Hub Setup View
  function renderOnlineHub() {
    const publicCards = state.publicRooms
      .map((r) => {
        const shown = (r.avatars || []).slice(0, 4);
        const overflow = Math.max(0, (r.avatars || []).length - shown.length);
        const need = Math.max(0, 3 - r.playerCount);
        const inGame = r.phase && r.phase !== 'lobby';
        const tags = [
          ...(r.categories || []).slice(0, 2),
          `${r.imposterCount} imposter${r.imposterCount > 1 ? 's' : ''}`
        ];
        const statusText = inGame
          ? 'In game'
          : r.playerCount === 0
            ? 'Open — Be first'
            : r.readyToStart
              ? 'Ready to start'
              : `Needs ${need} more`;
        return `
          <div class="room-card" style="${inGame ? 'background:var(--bg-surface);' : ''}">
            <div class="room-card-top">
              <div class="room-card-title">
                ${r.emoji ? `<span class="room-emoji-tile">${r.emoji}</span>` : `<span class="room-code-tag">#${escapeHtml(r.code)}</span>`}
                <div style="min-width:0;">
                  <div class="room-card-name">${escapeHtml(r.name)}</div>
                  <div style="font-size:0.74rem;color:var(--text-muted);font-weight:700;">#${escapeHtml(r.code)} • ${r.playerCount}/${r.maxPlayers} online</div>
                </div>
              </div>
              ${
                inGame
                  ? `<span class="mini-tag" style="background:var(--bg-elevated);">In game</span>`
                  : `<button type="button" class="pill-btn pill-btn-blue pill-btn-sm" data-join-room="${escapeHtml(r.code)}">Join</button>`
              }
            </div>
            <div class="room-meta-tags">
              ${tags.map((t) => `<span class="mini-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
            <div class="room-card-bottom">
              ${
                shown.length
                  ? `<div class="avatar-stack">
                       ${shown.map((a) => initialAvatarHtml(a.initial, a.color)).join('')}
                       ${overflow > 0 ? `<span class="initial-avatar avatar-overflow">+${overflow}</span>` : ''}
                     </div>`
                  : `<div style="display:flex;align-items:center;gap:0.45rem;font-size:0.8rem;color:var(--text-muted);font-weight:600;">
                       <span class="avatar-dashed">+</span>
                       <span>Be the first to join</span>
                     </div>`
              }
              <span class="status-pill ${r.readyToStart && !inGame ? 'ready' : 'waiting'}">
                ● ${statusText}
              </span>
            </div>
          </div>
        `;
      })
      .join('');

    const createModal = state.createModalOpen
      ? `
        <div class="app-modal-backdrop" id="create-modal-backdrop">
          <div class="app-modal" role="dialog" aria-modal="true" aria-label="Create Room">
            <div class="modal-header">
              <h3>Create Room</h3>
              <button type="button" class="modal-close" id="btn-close-modal" aria-label="Close">✕</button>
            </div>

            <div class="name-preview-row">
              <div class="name-preview-avatar" id="modal-avatar-preview">${escapeHtml((state.nickname.trim()[0] || '?').toUpperCase())}</div>
              <input type="text" id="input-create-nick" placeholder="Your nickname" maxlength="18" value="${escapeHtml(state.nickname)}" />
            </div>

            <button type="button" class="option-card ${!state.createIsPublic ? 'selected' : ''}" id="opt-private">
              <span style="font-size:1.35rem;">🔒</span>
              <div style="flex:1;">
                <strong>Private Room</strong>
                <small>Invite friends with a 6-digit code or link</small>
              </div>
              <span class="check-circle ${!state.createIsPublic ? 'checked' : ''}">✓</span>
            </button>

            <button type="button" class="option-card ${state.createIsPublic ? 'selected' : ''}" id="opt-public">
              <span style="font-size:1.35rem;">🌍</span>
              <div style="flex:1;">
                <strong>Public Room</strong>
                <small>Listed in Public Rooms — anyone can join</small>
              </div>
              <span class="check-circle ${state.createIsPublic ? 'checked' : ''}">✓</span>
            </button>

            ${
              state.createIsPublic
                ? `<input type="text" id="input-room-name" placeholder="Room name (optional)" maxlength="28" value="${escapeHtml(state.createRoomName)}" style="margin-bottom:0.75rem;" />`
                : ''
            }

            <button type="button" class="pill-btn pill-btn-black" id="btn-confirm-create">Continue</button>
          </div>
        </div>
      `
      : '';

    return `
      ${renderModeSelector()}
      ${state.onlineError ? `<div class="inline-error">${escapeHtml(state.onlineError)}</div>` : ''}

      <div class="online-actions">
        <button type="button" class="pill-btn pill-btn-black" id="btn-open-create">+ Create Room</button>
        ${
          state.joinExpanded
            ? `
              <div class="join-code-card">
                <input type="text" id="input-join-nick" placeholder="Your nickname" maxlength="18" value="${escapeHtml(state.nickname)}" style="margin-bottom:0.5rem;" />
                <div class="code-input-row">
                  <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" class="room-code-input" id="input-join-code" placeholder="000000" value="${escapeHtml(state.joinCodeInput)}" />
                  <button type="button" class="pill-btn pill-btn-blue pill-btn-sm" id="btn-submit-join" style="min-height:48px;padding:0 1.2rem;">Join</button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:var(--text-muted);">
                  <span>Enter the 6-digit room code</span>
                  <button type="button" id="btn-cancel-join" style="background:none;border:none;color:var(--text);font-weight:800;cursor:pointer;font-family:inherit;">Cancel</button>
                </div>
              </div>
            `
            : `<button type="button" class="pill-btn pill-btn-outline" id="btn-expand-join">Join with a code</button>`
        }
      </div>

      <div class="section-label-row">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span class="section-label">Public Rooms</span>
          <span class="online-count-badge">● ${state.totalOnline} online</span>
        </div>
        <button type="button" id="btn-refresh-rooms" style="background:none;border:none;color:var(--accent);font-weight:800;font-size:0.82rem;cursor:pointer;font-family:inherit;">
          ${state.roomsLoading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      <div class="public-rooms-list">
        ${
          publicCards ||
          `<div class="empty-rooms-box">
             No open public rooms right now.<br/>Tap <strong>+ Create Room</strong> to start one — you can add AI Bots anytime!
           </div>`
        }
      </div>
      ${createModal}
    `;
  }

  // Online Room (Lobby + Gameplay Phases)
  function renderOnlineRoom() {
    const r = state.room;
    if (!r) return renderOnlineHub();
    const me = r.players.find((p) => p.id === r.meId);
    const isHost = Boolean(me && me.isHost);

    if (state.subview === 'online-categories' && r.phase === 'lobby' && isHost) {
      return renderCategoriesSubview(true);
    }

    if (r.phase === 'lobby') {
      const digits = String(r.code).padStart(6, '0').split('');
      const need = Math.max(0, 3 - r.players.length);
      const catLabel = selectedCategoriesLabel(new Set(r.categories));

      const rosterHtml = r.players
        .map(
          (p) => `
            <div class="roster-row">
              <div class="roster-left">
                ${initialAvatarHtml(p.initial, p.color)}
                <span>${escapeHtml(p.name)}</span>
                ${p.isHost ? '<span class="roster-badge host">Host</span>' : ''}
                ${p.id === r.meId ? '<span class="roster-badge">You</span>' : ''}
                ${p.isBot ? '<span class="roster-badge">AI Bot</span>' : ''}
              </div>
              ${
                isHost && p.isBot
                  ? `<button type="button" class="modal-close" data-remove-bot="${escapeHtml(p.id)}" aria-label="Remove bot">✕</button>`
                  : `<span style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">${p.score} pts</span>`
              }
            </div>
          `
        )
        .join('');

      return `
        ${state.onlineError ? `<div class="inline-error">${escapeHtml(state.onlineError)}</div>` : ''}
        <div class="lobby-invite-card">
          <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);">
            ${r.isPublic ? '🌍 Public Room' : '🔒 Private Room'} • Share Code
          </div>
          <div class="digit-tiles">
            ${digits.map((d) => `<span class="digit-tile">${escapeHtml(d)}</span>`).join('')}
          </div>
          <button type="button" class="pill-btn pill-btn-black pill-btn-sm" id="btn-copy-invite" style="width:100%;min-height:42px;">
            ${state.copiedNotice ? '✓ Invite Link Copied!' : `🔗 Copy Invite Link (?room=${escapeHtml(r.code)})`}
          </button>
          <div class="room-meta-tags" style="justify-content:center;margin:0.75rem 0 0;">
            <span class="mini-tag">📚 ${escapeHtml(catLabel)}</span>
            <span class="mini-tag">🕵️ ${r.imposterCount} imposter</span>
            <span class="mini-tag">💡 Hints ${r.imposterHint ? 'on' : 'off'}</span>
          </div>
        </div>

        <div class="section-label-row">
          <span class="section-label">Players (${r.players.length}/${r.maxPlayers})</span>
          <span class="status-pill ${need === 0 ? 'ready' : 'waiting'}">
            ● ${need === 0 ? 'Ready to start' : `Needs ${need} more`}
          </span>
        </div>

        <div class="player-roster">${rosterHtml}</div>

        ${
          isHost
            ? `
              <div style="display:flex;gap:0.5rem;margin-bottom:0.85rem;">
                <button type="button" class="pill-btn pill-btn-outline pill-btn-sm" id="btn-add-bot" style="flex:1;" ${r.players.length >= r.maxPlayers ? 'disabled' : ''}>
                  🤖 + Add AI Bot
                </button>
                <button type="button" class="pill-btn pill-btn-soft pill-btn-sm" id="btn-online-cats" style="flex:1;">
                  📚 Packs
                </button>
              </div>
              <div class="ios-group">
                <div class="ios-row">
                  <div class="ios-row-label"><strong>🕵️ Imposters</strong></div>
                  <div class="stepper">
                    <button type="button" id="online-imp-minus">−</button>
                    <span>${r.imposterCount}</span>
                    <button type="button" id="online-imp-plus">+</button>
                  </div>
                </div>
                <div class="ios-row">
                  <div class="ios-row-label"><strong>💡 Hints for Imposter</strong></div>
                  <label class="toggle">
                    <input type="checkbox" id="online-toggle-hint" ${r.imposterHint ? 'checked' : ''} />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <button type="button" class="pill-btn pill-btn-black" id="btn-online-start" ${r.players.length < 3 ? 'disabled' : ''}>
                ${r.players.length < 3 ? `Need ${need} More Player${need > 1 ? 's' : ''} (or Add Bot)` : 'Start Game'}
              </button>
            `
            : `<div class="empty-rooms-box" style="margin-bottom:0.75rem;">Waiting for Host to start the game…</div>`
        }

        <button type="button" class="pill-btn pill-btn-soft" id="btn-leave-room" style="margin-top:0.55rem;">Leave Room</button>
      `;
    }

    if (r.phase === 'reveal') {
      const role = r.myRole;
      const isImp = role && role.role === 'imposter';
      const readyCount = r.players.filter((p) => p.ready).length;

      return `
        <div class="stage">
          <div class="stage-progress">Round ${r.round} • Secret Role</div>
          <h2>Check Your Private Card</h2>
          <p class="stage-sub">Sent privately from the server — only you can see this screen.</p>

          <div class="flip-scene">
            <div class="flip-card ${state.onlineCardFlipped ? 'flipped' : ''}" id="online-secret-card" role="button" tabindex="0">
              <div class="card-face card-front">
                <div class="tap-icon">🕵️</div>
                <strong>Tap to Reveal Role</strong>
                <span>Nobody else can see your screen</span>
              </div>
              <div class="card-face card-back ${isImp ? 'imposter' : 'crew'}">
                <div class="role-pill">${isImp ? 'You Are The Imposter' : 'You Are Innocent'}</div>
                ${
                  isImp
                    ? `<div class="secret-word">BLEND IN!</div>
                       <div class="role-hint">${
                         role.hint
                           ? `Category: <strong>${escapeHtml(role.category)}</strong> • Hint: <strong>${escapeHtml(role.hint)}</strong>`
                           : `Category: <strong>${escapeHtml(role.category)}</strong> • No hint!`
                       }</div>`
                    : `<div class="secret-word">${escapeHtml(role?.word || '')}</div>
                       <div class="role-hint">Category: <strong>${escapeHtml(role?.category || '')}</strong></div>`
                }
              </div>
            </div>
          </div>

          <button type="button" class="pill-btn pill-btn-black" id="btn-online-ready" ${me?.ready ? 'disabled' : ''}>
            ${me?.ready ? `✓ Ready (${readyCount}/${r.players.length})` : "I've Seen My Card — Ready"}
          </button>
          ${
            isHost
              ? `<button type="button" class="pill-btn pill-btn-soft" id="btn-online-skip-reveal" style="margin-top:0.5rem;">Continue to Clues →</button>`
              : ''
          }
        </div>
      `;
    }

    if (r.phase === 'clues') {
      const role = r.myRole;
      const isImp = role && role.role === 'imposter';
      const currentPlayer = r.players.find((p) => p.id === r.currentTurnId);
      const isMyTurn = r.currentTurnId === r.meId;

      const clueRows = r.clues
        .map((c) => {
          const p = r.players.find((pl) => pl.id === c.playerId) || { name: 'Player', initial: '?', color: '#007cff' };
          return `
            <div class="clue-row">
              <div class="clue-player">
                ${initialAvatarHtml(p.initial, p.color)}
                <span>${escapeHtml(p.name)}${p.id === r.meId ? ' (You)' : ''}</span>
              </div>
              <span class="clue-word-pill">"${escapeHtml(c.clue)}"</span>
            </div>
          `;
        })
        .join('');

      return `
        <div class="stage">
          <div class="solo-role-banner ${isImp ? 'imposter' : 'crew'}">
            <div>
              <div style="font-size:0.74rem;font-weight:800;text-transform:uppercase;">${isImp ? '😈 Imposter' : '🛡️ Innocent'}</div>
              <div style="font-size:1.15rem;font-weight:900;">${isImp ? `Category: ${escapeHtml(role.category)}` : escapeHtml(role.word)}</div>
            </div>
            <span class="mini-tag" style="background:rgba(255,255,255,0.75);color:#00142f;">
              ${isImp && role.hint ? `Hint: ${escapeHtml(role.hint)}` : escapeHtml(role?.category || '')}
            </span>
          </div>

          <h2>One-Word Clue Round</h2>
          <p class="stage-sub">
            ${isMyTurn ? 'It is your turn! Type 1 clue word.' : `Waiting for ${escapeHtml(currentPlayer?.name || 'player')}…`}
          </p>

          <div class="clue-board">
            ${clueRows || '<div class="empty-rooms-box">No clues yet — first player is up!</div>'}
          </div>

          ${
            isMyTurn
              ? `<form class="clue-input-bar" id="online-clue-form">
                   <input type="text" id="online-clue-input" placeholder="Type 1 clue word" maxlength="24" required autocomplete="off" />
                   <button type="submit" class="pill-btn pill-btn-blue pill-btn-sm" style="padding:0 1.15rem;">Send</button>
                 </form>`
              : ''
          }

          ${
            isHost
              ? `<button type="button" class="pill-btn pill-btn-soft" id="btn-online-go-vote" style="margin-top:0.75rem;">🗳️ Go to Vote Now</button>`
              : ''
          }
        </div>
      `;
    }

    if (r.phase === 'vote') {
      const voteBtns = r.players
        .filter((p) => p.id !== r.meId)
        .map(
          (p) => `
            <button type="button" class="vote-btn ${r.myVote === p.id ? 'selected' : ''}" data-online-vote="${escapeHtml(p.id)}">
              <div style="display:flex;align-items:center;justify-content:center;gap:0.45rem;">
                ${initialAvatarHtml(p.initial, p.color)}
                <span>${escapeHtml(p.name)}</span>
              </div>
            </button>
          `
        )
        .join('');

      return `
        <div class="stage">
          <div class="stage-progress">Anonymous Vote • ${r.votedCount}/${r.totalVoters} Voted</div>
          <h2>Who Is The Imposter?</h2>
          <p class="stage-sub">${r.myVote ? 'Vote locked in! Waiting for other players…' : 'Tap the player you suspect is bluffing.'}</p>

          <div class="vote-grid">${voteBtns}</div>

          ${
            isHost
              ? `<button type="button" class="pill-btn pill-btn-soft" id="btn-online-finish-vote">Reveal Results Now</button>`
              : ''
          }
        </div>
      `;
    }

    if (r.phase === 'result' && r.result) {
      const res = r.result;
      const ejected = r.players.find((p) => p.id === res.ejectedId);
      const impNames = r.players.filter((p) => res.imposterIds.includes(p.id)).map((p) => p.name);
      const scoreItems = r.players
        .map(
          (p) => `
            <div class="score-item">
              <span style="display:inline-flex;align-items:center;gap:0.4rem;">
                ${initialAvatarHtml(p.initial, p.color)} ${escapeHtml(p.name)}
              </span>
              <strong>${p.score} pts</strong>
            </div>
          `
        )
        .join('');

      return `
        <div class="stage">
          <div class="ejection-banner">
            <div class="ejected-floater" style="background:${ejected ? ejected.color : '#6a7280'};">
              ${ejected ? escapeHtml(ejected.initial) : '⚖️'}
            </div>
            <div class="ejection-text">
              ${
                res.isTie
                  ? 'Tie Vote — Nobody Was Ejected!'
                  : `${escapeHtml(ejected?.name || 'Player')} was ${res.crewWon ? '<span style="color:#ff4d6d;">The Imposter!</span>' : '<span style="color:#38bdf8;">NOT The Imposter.</span>'}`
              }
            </div>
          </div>

          <h2>${res.crewWon ? '🎉 Crew Wins!' : '😈 Imposter Escaped!'}</h2>
          <div class="result-card">
            <p style="margin:0 0 0.45rem;">Imposter${impNames.length > 1 ? 's' : ''}: <strong style="color:var(--brand);">${escapeHtml(impNames.join(', '))}</strong></p>
            <p style="margin:0;">Secret Word: <strong style="color:var(--crew);font-size:1.2rem;">${escapeHtml(res.secretWord)}</strong></p>
          </div>

          ${
            isHost
              ? `
                <button type="button" class="pill-btn pill-btn-black" id="btn-online-next">🔄 Play Next Round</button>
                <button type="button" class="pill-btn pill-btn-soft" id="btn-online-lobby" style="margin-top:0.5rem;">Back to Room Lobby</button>
              `
              : `<div class="empty-rooms-box">Waiting for Host to start the next round…</div>`
          }

          <div class="scoreboard">${scoreItems}</div>
        </div>
      `;
    }

    return '';
  }

  // Solo vs AI Setup & Play
  function renderSoloSetup() {
    return `
      ${renderModeSelector()}
      <div class="ios-group">
        <div class="ios-row">
          <div class="ios-row-label">
            <strong>🤖 AI Bot Opponents</strong>
            <small>Total players: ${state.soloBotCount + 1}</small>
          </div>
          <div class="stepper">
            <button type="button" id="solo-bots-minus">−</button>
            <span>${state.soloBotCount}</span>
            <button type="button" id="solo-bots-plus">+</button>
          </div>
        </div>
        <div class="ios-row">
          <div class="ios-row-label">
            <strong>🎭 Your Role</strong>
            <small>Catch bots or practice bluffing</small>
          </div>
          <div style="width:146px;">
            <select id="solo-role-select">
              <option value="random" ${state.soloRolePref === 'random' ? 'selected' : ''}>🎲 Random</option>
              <option value="crew" ${state.soloRolePref === 'crew' ? 'selected' : ''}>🛡️ Innocent</option>
              <option value="imposter" ${state.soloRolePref === 'imposter' ? 'selected' : ''}>😈 Imposter</option>
            </select>
          </div>
        </div>
      </div>
      <button type="button" class="pill-btn pill-btn-black" id="btn-start-solo">Start Solo Match</button>
    `;
  }

  function renderSoloPlay() {
    const humanIsImp = state.soloImposterIdx === 0;
    const entry = state.soloEntry;
    const clueRows = state.soloClues
      .map((item) => {
        const p = state.soloRoster[item.playerIdx];
        return `
          <div class="clue-row">
            <div class="clue-player">
              ${avatarHtml(item.playerIdx, p)}
              <span>${escapeHtml(p.name)}${p.isHuman ? ' (You)' : ''}</span>
            </div>
            <span class="clue-word-pill">"${escapeHtml(item.clue)}"</span>
          </div>
        `;
      })
      .join('');

    const voteButtons = state.soloRoster
      .map((p, idx) =>
        p.isHuman
          ? ''
          : `<button type="button" class="vote-btn" data-solo-vote="${idx}">
               <div style="display:flex;align-items:center;justify-content:center;gap:0.45rem;">
                 ${avatarHtml(idx, p)}<span>${escapeHtml(p.name)}</span>
               </div>
             </button>`
      )
      .join('');

    return `
      <div class="stage">
        <div class="solo-role-banner ${humanIsImp ? 'imposter' : 'crew'}">
          <div>
            <div style="font-size:0.74rem;font-weight:800;text-transform:uppercase;">${humanIsImp ? '😈 You Are The Imposter' : '🛡️ You Are Innocent'}</div>
            <div style="font-size:1.2rem;font-weight:900;">${humanIsImp ? `Category: ${escapeHtml(entry.category)}` : escapeHtml(entry.word)}</div>
          </div>
          <span class="mini-tag" style="background:rgba(255,255,255,0.78);color:#00142f;">
            ${humanIsImp ? `Hint: ${escapeHtml(entry.hint)}` : escapeHtml(entry.category)}
          </span>
        </div>

        <h2>One-Word Clue Feed</h2>
        <p class="stage-sub">
          ${
            !state.soloUserSubmitted
              ? humanIsImp ? 'Type 1 convincing bluff word!' : 'Type 1 clue word without giving it away.'
              : humanIsImp ? 'All clues are in! See who the bots vote out.' : 'Spot the suspicious clue and eject the AI Imposter!'
          }
        </p>

        <div class="clue-board">
          ${clueRows || '<div class="empty-rooms-box">You go first this round! Drop the opening 1-word clue.</div>'}
        </div>

        ${
          !state.soloUserSubmitted
            ? `<form class="clue-input-bar" id="solo-clue-form">
                 <input type="text" id="solo-clue-input" placeholder="Type 1 clue word" maxlength="24" required autocomplete="off" />
                 <button type="submit" class="pill-btn pill-btn-blue pill-btn-sm" style="padding:0 1.15rem;">Send</button>
               </form>`
            : humanIsImp
              ? `<button type="button" class="pill-btn pill-btn-black" id="btn-solo-bot-vote">🗳️ Let the Bots Vote!</button>`
              : `<div class="vote-grid">${voteButtons}</div>`
        }
      </div>
    `;
  }

  function renderSoloGuess() {
    const opts = state.soloGuessOptions
      .map((word) => `<button type="button" class="vote-btn" data-solo-guess="${escapeHtml(word)}">${escapeHtml(word)}</button>`)
      .join('');
    return `
      <div class="stage">
        <div class="stage-progress">Caught by the Bots!</div>
        <h2>⚡ Imposter Last Chance</h2>
        <p class="stage-sub">Guess the secret word correctly to steal the win:</p>
        <div class="guess-grid">${opts}</div>
      </div>
    `;
  }

  function renderSoloResult() {
    const humanIsImp = state.soloImposterIdx === 0;
    const ejected = state.soloRoster[state.soloVotedIdx];
    const imp = state.soloRoster[state.soloImposterIdx];
    const userWon = humanIsImp
      ? state.soloVotedIdx !== 0 || state.soloGuessCorrect === true
      : state.soloVotedIdx === state.soloImposterIdx;

    return `
      <div class="stage">
        <div class="ejection-banner">
          <div class="ejected-floater" style="background:${ejected.color};">${ejected.icon}</div>
          <div class="ejection-text">
            ${escapeHtml(ejected.name)} was ${state.soloVotedIdx === state.soloImposterIdx ? '<span style="color:#ff4d6d;">The Imposter!</span>' : '<span style="color:#38bdf8;">NOT The Imposter.</span>'}
          </div>
        </div>
        <h2>${userWon ? '🎉 You Won!' : '💀 Better Luck Next Round'}</h2>
        <div class="result-card">
          <p style="margin:0 0 0.45rem;">The Imposter was: <strong style="color:var(--brand);">${escapeHtml(imp.name)}</strong></p>
          <p style="margin:0;">Secret Word: <strong style="color:var(--crew);font-size:1.2rem;">${escapeHtml(state.soloEntry.word)}</strong></p>
          ${state.soloGuessCorrect === true ? '<p style="margin:0.45rem 0 0;color:var(--crew);font-weight:800;">🔥 Clutch Imposter Steal!</p>' : ''}
        </div>
        <button type="button" class="pill-btn pill-btn-black" id="btn-solo-again">Play Another Round</button>
        <button type="button" class="pill-btn pill-btn-soft" id="btn-solo-setup" style="margin-top:0.5rem;">Back to Settings</button>
      </div>
    `;
  }

  // Pass & Play Gameplay Phases
  function renderReveal() {
    const playerName = state.players[state.currentRevealIdx];
    const isImposter = state.imposterIndices.has(state.currentRevealIdx);
    const isLast = state.currentRevealIdx === state.playerCount - 1;

    return `
      <div class="stage">
        <div class="stage-progress">Pass phone to (${state.currentRevealIdx + 1}/${state.playerCount})</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:0.55rem;margin-bottom:0.3rem;">
          ${avatarHtml(state.currentRevealIdx)}
          <h2 style="margin:0;">${escapeHtml(playerName)}</h2>
        </div>
        <p class="stage-sub">Make sure nobody else is peeking!</p>

        <div class="flip-scene">
          <div class="flip-card ${state.cardFlipped ? 'flipped' : ''}" id="secret-card" role="button" tabindex="0">
            <div class="card-face card-front">
              <div class="tap-icon">🕵️</div>
              <strong>Tap to Reveal Role</strong>
              <span>Keep it secret</span>
            </div>
            <div class="card-face card-back ${isImposter ? 'imposter' : 'crew'}">
              <div class="role-pill">${isImposter ? 'You Are The Imposter' : 'You Are Innocent'}</div>
              ${
                isImposter
                  ? `<div class="secret-word">BLEND IN!</div>
                     <div class="role-hint">${
                       state.imposterHint
                         ? `Category: <strong>${escapeHtml(state.secretCategory)}</strong> • Hint: <strong>${escapeHtml(state.secretHint)}</strong>`
                         : 'No hint given — listen carefully!'
                     }</div>`
                  : `<div class="secret-word">${escapeHtml(state.secretWord)}</div>
                     <div class="role-hint">Category: <strong>${escapeHtml(state.secretCategory)}</strong></div>`
              }
            </div>
          </div>
        </div>

        ${
          state.cardFlipped
            ? `<button type="button" class="pill-btn pill-btn-black" id="btn-next-player">
                 ${isLast ? 'Hide & Start Discussion' : 'Hide & Pass to Next Player'}
               </button>`
            : `<button type="button" class="pill-btn pill-btn-outline" id="btn-flip-trigger">Reveal My Secret Card</button>`
        }
      </div>
    `;
  }

  function renderDiscuss() {
    const firstSpeaker = state.players[state.firstSpeakerIdx];
    return `
      <div class="stage">
        <div class="stage-progress">${escapeHtml(state.secretCategory)}</div>
        <h2>Give One-Word Clues!</h2>
        <div class="first-speaker">🎤 Goes First: ${escapeHtml(firstSpeaker)}</div>
        <p class="stage-sub">Go around the circle and say 1 clue word about the secret word.</p>
        ${
          state.timerMinutes > 0
            ? `<div class="timer-box ${state.timerSeconds <= 15 ? 'urgent' : ''}" id="timer-display">${formatTime(state.timerSeconds)}</div>
               <div style="display:flex;justify-content:center;gap:0.5rem;margin-bottom:1.1rem;">
                 <button type="button" class="pill-btn pill-btn-soft pill-btn-sm" id="btn-timer-toggle">${state.timerRunning ? '⏸ Pause' : '▶ Start'}</button>
                 <button type="button" class="pill-btn pill-btn-soft pill-btn-sm" id="btn-timer-add">+30s</button>
               </div>`
            : `<p class="stage-sub"><strong>Timer:</strong> Unlimited</p>`
        }
        <button type="button" class="pill-btn pill-btn-black" id="btn-go-vote">Vote Out the Imposter</button>
      </div>
    `;
  }

  function renderVote() {
    const btns = state.players
      .map(
        (name, idx) => `
          <button type="button" class="vote-btn" data-vote="${idx}">
            <div style="display:flex;align-items:center;justify-content:center;gap:0.45rem;">
              ${avatarHtml(idx)}<span>${escapeHtml(name)}</span>
            </div>
          </button>
        `
      )
      .join('');
    return `
      <div class="stage">
        <div class="stage-progress">Final Vote</div>
        <h2>Who Is The Imposter?</h2>
        <p class="stage-sub">Tap the player the group voted to eject.</p>
        <div class="vote-grid">${btns}</div>
        <button type="button" class="pill-btn pill-btn-soft" id="btn-back-discuss">← Back to Discussion</button>
      </div>
    `;
  }

  function renderResult() {
    const impNames = Array.from(state.imposterIndices).map((i) => state.players[i]);
    const votedName = state.votedOutIdx !== null ? state.players[state.votedOutIdx] : '';
    const caught = state.votedOutIdx !== null && state.imposterIndices.has(state.votedOutIdx);
    const ejectedAvatar = AVATAR_POOL[(state.votedOutIdx || 0) % AVATAR_POOL.length];
    const scoreItems = state.players
      .map(
        (name, idx) => `
          <div class="score-item">
            <span style="display:inline-flex;align-items:center;gap:0.4rem;">${AVATAR_POOL[idx % AVATAR_POOL.length].icon} ${escapeHtml(name)}</span>
            <strong>${state.scores[name] || 0} pts</strong>
          </div>
        `
      )
      .join('');

    return `
      <div class="stage">
        <div class="ejection-banner">
          <div class="ejected-floater" style="background:${ejectedAvatar.color};">${ejectedAvatar.icon}</div>
          <div class="ejection-text">
            ${escapeHtml(votedName)} was ${caught ? '<span style="color:#ff4d6d;">The Imposter!</span>' : '<span style="color:#38bdf8;">NOT The Imposter.</span>'}
          </div>
        </div>
        <h2>${caught ? '🎉 Crew Wins!' : '😈 Imposter Escaped!'}</h2>
        <div class="result-card">
          <p style="margin:0 0 0.45rem;">The Imposter${impNames.length > 1 ? 's were' : ' was'}: <strong style="color:var(--brand);">${escapeHtml(impNames.join(', '))}</strong></p>
          <p style="margin:0;">Secret Word: <strong style="color:var(--crew);font-size:1.2rem;">${escapeHtml(state.secretWord)}</strong></p>
        </div>
        <button type="button" class="pill-btn pill-btn-black" id="btn-play-again">Play Next Round</button>
        <button type="button" class="pill-btn pill-btn-soft" id="btn-edit-setup" style="margin-top:0.5rem;">Change Settings</button>
        <div class="scoreboard">${scoreItems}</div>
      </div>
    `;
  }

  function render() {
    ensurePlayerNames();
    root.classList.add('app-shell-v2');
    let body = '';
    if (state.phase === 'setup') {
      if (state.mode === 'passplay') body = renderPassPlaySetup();
      else if (state.mode === 'online') body = renderOnlineHub();
      else body = renderSoloSetup();
    } else if (state.phase === 'online-room') body = renderOnlineRoom();
    else if (state.phase === 'solo-play') body = renderSoloPlay();
    else if (state.phase === 'solo-guess') body = renderSoloGuess();
    else if (state.phase === 'solo-result') body = renderSoloResult();
    else if (state.phase === 'reveal') body = renderReveal();
    else if (state.phase === 'discuss') body = renderDiscuss();
    else if (state.phase === 'vote') body = renderVote();
    else if (state.phase === 'result') body = renderResult();

    root.innerHTML = renderBrandBanner() + body;
    bindEvents();
  }

  function bindEvents() {
    const soundBtn = document.getElementById('toggle-sound');
    if (soundBtn) soundBtn.onclick = () => { soundEnabled = !soundEnabled; sfx.click(); render(); };

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.onclick = () => {
        stopTimer();
        if (state.phase === 'online-room') disconnectOnline(true);
        state.phase = 'setup';
        state.subview = null;
        sfx.click();
        render();
      };
    }

    const tabPass = document.getElementById('tab-passplay');
    if (tabPass) tabPass.onclick = () => { state.mode = 'passplay'; state.subview = null; sfx.click(); render(); };
    const tabOnline = document.getElementById('tab-online');
    if (tabOnline) {
      tabOnline.onclick = () => {
        state.mode = 'online';
        state.subview = null;
        sfx.click();
        fetchPublicRooms();
      };
    }
    const tabSolo = document.getElementById('tab-solo');
    if (tabSolo) tabSolo.onclick = () => { state.mode = 'solo'; state.subview = null; sfx.click(); render(); };

    // Subviews (Players & Categories)
    const backBtn = document.getElementById('btn-subview-back');
    if (backBtn) backBtn.onclick = () => { state.subview = null; sfx.click(); render(); };
    const doneBtn = document.getElementById('btn-subview-done');
    if (doneBtn) doneBtn.onclick = () => { state.subview = null; sfx.click(); render(); };

    if (state.subview === 'players') {
      document.querySelectorAll('.player-name-input').forEach((input) => {
        input.oninput = (e) => {
          const idx = Number(e.target.dataset.idx);
          state.players[idx] = e.target.value || `Player ${idx + 1}`;
        };
      });
      document.querySelectorAll('[data-remove-player]').forEach((btn) => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.removePlayer);
          if (state.playerCount > 3) {
            state.players.splice(idx, 1);
            state.playerCount -= 1;
            sfx.click();
            render();
          }
        };
      });
      const addP = document.getElementById('btn-add-player');
      if (addP) addP.onclick = () => { if (state.playerCount < 12) { state.playerCount += 1; sfx.click(); render(); } };
      const resetP = document.getElementById('btn-reset-players');
      if (resetP) resetP.onclick = () => { state.playerCount = 4; state.players = ['Player 1', 'Player 2', 'Player 3', 'Player 4']; sfx.click(); render(); };
    }

    if (state.subview === 'categories' || state.subview === 'online-categories') {
      const isOnline = state.subview === 'online-categories';
      document.querySelectorAll('[data-cat-toggle]').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.dataset.catToggle;
          if (isOnline && state.room) {
            const set = new Set(state.room.categories);
            if (set.has(id) && set.size > 1) set.delete(id);
            else set.add(id);
            wsSend({ type: 'update_settings', patch: { categories: Array.from(set) } });
            sfx.click();
          } else {
            state.useCustomWord = false;
            if (state.selectedCategories.has(id) && state.selectedCategories.size > 1) state.selectedCategories.delete(id);
            else state.selectedCategories.add(id);
            sfx.click();
            render();
          }
        };
      });
      const customBtn = document.getElementById('btn-custom-mode');
      if (customBtn) customBtn.onclick = () => { state.useCustomWord = !state.useCustomWord; sfx.click(); render(); };
      const cw = document.getElementById('input-custom-word');
      if (cw) cw.oninput = (e) => { state.customWord = e.target.value; };
      const ch = document.getElementById('input-custom-hint');
      if (ch) ch.oninput = (e) => { state.customHint = e.target.value; };
    }

    // Pass & Play Setup
    if (state.phase === 'setup' && state.mode === 'passplay' && !state.subview) {
      document.getElementById('row-open-players').onclick = () => { state.subview = 'players'; sfx.click(); render(); };
      document.getElementById('row-open-categories').onclick = () => { state.subview = 'categories'; sfx.click(); render(); };
      document.getElementById('imp-minus').onclick = () => { if (state.imposterCount > 1) { state.imposterCount -= 1; sfx.click(); render(); } };
      document.getElementById('imp-plus').onclick = () => {
        const maxImp = Math.max(1, Math.min(3, Math.floor((state.playerCount - 1) / 2)));
        if (state.imposterCount < maxImp) { state.imposterCount += 1; sfx.click(); render(); }
      };
      document.getElementById('toggle-hint').onchange = (e) => { state.imposterHint = e.target.checked; sfx.click(); };
      document.getElementById('select-timer').onchange = (e) => { state.timerMinutes = Number(e.target.value); sfx.click(); };
      document.getElementById('btn-start').onclick = startPassPlayRound;
    }

    // Online Hub
    if (state.phase === 'setup' && state.mode === 'online') {
      const openCreate = document.getElementById('btn-open-create');
      if (openCreate) openCreate.onclick = () => { state.createModalOpen = true; sfx.click(); render(); };
      const expandJoin = document.getElementById('btn-expand-join');
      if (expandJoin) expandJoin.onclick = () => { state.joinExpanded = true; sfx.click(); render(); };
      const cancelJoin = document.getElementById('btn-cancel-join');
      if (cancelJoin) cancelJoin.onclick = () => { state.joinExpanded = false; state.onlineError = ''; sfx.click(); render(); };
      const joinNick = document.getElementById('input-join-nick');
      if (joinNick) joinNick.oninput = (e) => { state.nickname = e.target.value; };
      const joinCode = document.getElementById('input-join-code');
      if (joinCode) {
        joinCode.oninput = (e) => {
          state.joinCodeInput = e.target.value.replace(/\D/g, '').slice(0, 6);
          e.target.value = state.joinCodeInput;
        };
      }
      const submitJoin = document.getElementById('btn-submit-join');
      if (submitJoin) submitJoin.onclick = () => { sfx.click(); connectToRoom(state.joinCodeInput, state.nickname); };
      const refreshBtn = document.getElementById('btn-refresh-rooms');
      if (refreshBtn) refreshBtn.onclick = fetchPublicRooms;

      document.querySelectorAll('[data-join-room]').forEach((btn) => {
        btn.onclick = () => {
          sfx.click();
          connectToRoom(btn.dataset.joinRoom, state.nickname);
        };
      });

      // Create Modal events
      const closeModal = document.getElementById('btn-close-modal');
      if (closeModal) closeModal.onclick = () => { state.createModalOpen = false; render(); };
      const backdrop = document.getElementById('create-modal-backdrop');
      if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) { state.createModalOpen = false; render(); } };
      const optPriv = document.getElementById('opt-private');
      if (optPriv) optPriv.onclick = () => { state.createIsPublic = false; sfx.click(); render(); };
      const optPub = document.getElementById('opt-public');
      if (optPub) optPub.onclick = () => { state.createIsPublic = true; sfx.click(); render(); };
      const nickInput = document.getElementById('input-create-nick');
      if (nickInput) {
        nickInput.oninput = (e) => {
          state.nickname = e.target.value;
          const prev = document.getElementById('modal-avatar-preview');
          if (prev) prev.textContent = (state.nickname.trim()[0] || '?').toUpperCase();
        };
      }
      const roomNameInput = document.getElementById('input-room-name');
      if (roomNameInput) roomNameInput.oninput = (e) => { state.createRoomName = e.target.value; };
      const confirmCreate = document.getElementById('btn-confirm-create');
      if (confirmCreate) confirmCreate.onclick = createOnlineRoom;
    }

    // Online Room events
    if (state.phase === 'online-room' && state.room && !state.subview) {
      const copyBtn = document.getElementById('btn-copy-invite');
      if (copyBtn) {
        copyBtn.onclick = () => {
          const link = `${location.origin}/?room=${state.room.code}`;
          navigator.clipboard?.writeText(link).catch(() => {});
          state.copiedNotice = true;
          sfx.click();
          render();
          setTimeout(() => {
            if (!state.copiedNotice) return;
            state.copiedNotice = false;
            if (state.phase === 'online-room' && state.room?.phase === 'lobby') render();
          }, 1800);
        };
      }
      const addBot = document.getElementById('btn-add-bot');
      if (addBot) addBot.onclick = () => { sfx.click(); wsSend({ type: 'add_bot' }); };
      document.querySelectorAll('[data-remove-bot]').forEach((btn) => {
        btn.onclick = () => { sfx.click(); wsSend({ type: 'remove_bot', botId: btn.dataset.removeBot }); };
      });
      const onlineCats = document.getElementById('btn-online-cats');
      if (onlineCats) onlineCats.onclick = () => { state.subview = 'online-categories'; sfx.click(); render(); };
      const impMinus = document.getElementById('online-imp-minus');
      if (impMinus) impMinus.onclick = () => { if (state.room.imposterCount > 1) wsSend({ type: 'update_settings', patch: { imposterCount: state.room.imposterCount - 1 } }); };
      const impPlus = document.getElementById('online-imp-plus');
      if (impPlus) impPlus.onclick = () => { wsSend({ type: 'update_settings', patch: { imposterCount: state.room.imposterCount + 1 } }); };
      const toggleHint = document.getElementById('online-toggle-hint');
      if (toggleHint) toggleHint.onchange = (e) => { wsSend({ type: 'update_settings', patch: { imposterHint: e.target.checked } }); };
      const startOnline = document.getElementById('btn-online-start');
      if (startOnline) startOnline.onclick = () => { sfx.click(); wsSend({ type: 'start_game' }); };
      const leaveBtn = document.getElementById('btn-leave-room');
      if (leaveBtn) leaveBtn.onclick = () => { disconnectOnline(true); fetchPublicRooms(); };

      const onlineCard = document.getElementById('online-secret-card');
      if (onlineCard) {
        onlineCard.onclick = () => {
          state.onlineCardFlipped = !state.onlineCardFlipped;
          sfx.flip();
          render();
        };
      }
      const readyBtn = document.getElementById('btn-online-ready');
      if (readyBtn) readyBtn.onclick = () => { sfx.click(); wsSend({ type: 'player_ready' }); };
      const skipReveal = document.getElementById('btn-online-skip-reveal');
      if (skipReveal) skipReveal.onclick = () => { sfx.click(); wsSend({ type: 'advance_clues' }); };

      const onlineClueForm = document.getElementById('online-clue-form');
      if (onlineClueForm) {
        onlineClueForm.onsubmit = (e) => {
          e.preventDefault();
          const val = document.getElementById('online-clue-input').value.trim();
          if (val) { sfx.click(); wsSend({ type: 'submit_clue', clue: val }); }
        };
      }
      const goVoteOnline = document.getElementById('btn-online-go-vote');
      if (goVoteOnline) goVoteOnline.onclick = () => { sfx.click(); wsSend({ type: 'advance_vote' }); };

      document.querySelectorAll('[data-online-vote]').forEach((btn) => {
        btn.onclick = () => { sfx.click(); wsSend({ type: 'cast_vote', targetId: btn.dataset.onlineVote }); };
      });
      const finishVote = document.getElementById('btn-online-finish-vote');
      if (finishVote) finishVote.onclick = () => { sfx.click(); wsSend({ type: 'finish_vote' }); };
      const nextRound = document.getElementById('btn-online-next');
      if (nextRound) nextRound.onclick = () => { sfx.click(); wsSend({ type: 'next_round' }); };
      const backLobby = document.getElementById('btn-online-lobby');
      if (backLobby) backLobby.onclick = () => { sfx.click(); wsSend({ type: 'back_lobby' }); };
    }

    // Solo Setup & Play
    if (state.phase === 'setup' && state.mode === 'solo') {
      document.getElementById('solo-bots-minus').onclick = () => { if (state.soloBotCount > 2) { state.soloBotCount -= 1; sfx.click(); render(); } };
      document.getElementById('solo-bots-plus').onclick = () => { if (state.soloBotCount < 5) { state.soloBotCount += 1; sfx.click(); render(); } };
      document.getElementById('solo-role-select').onchange = (e) => { state.soloRolePref = e.target.value; sfx.click(); };
      document.getElementById('btn-start-solo').onclick = startSoloRound;
    }

    if (state.phase === 'solo-play') {
      const form = document.getElementById('solo-clue-form');
      if (form) {
        form.onsubmit = (e) => {
          e.preventDefault();
          const val = document.getElementById('solo-clue-input').value;
          if (val.trim()) submitSoloClue(val);
        };
      }
      const botVoteBtn = document.getElementById('btn-solo-bot-vote');
      if (botVoteBtn) botVoteBtn.onclick = () => resolveSoloVote(0);
      document.querySelectorAll('[data-solo-vote]').forEach((btn) => {
        btn.onclick = () => resolveSoloVote(Number(btn.dataset.soloVote));
      });
    }

    if (state.phase === 'solo-guess') {
      document.querySelectorAll('[data-solo-guess]').forEach((btn) => {
        btn.onclick = () => {
          state.soloGuessCorrect = btn.dataset.soloGuess === state.soloEntry.word;
          if (state.soloGuessCorrect) { state.soloWins += 1; sfx.win(); }
          else sfx.imposter();
          state.phase = 'solo-result';
          render();
        };
      });
    }

    if (state.phase === 'solo-result') {
      document.getElementById('btn-solo-again').onclick = startSoloRound;
      document.getElementById('btn-solo-setup').onclick = () => { state.phase = 'setup'; render(); };
    }

    // Pass & Play Reveal / Discuss / Vote / Result
    if (state.phase === 'reveal') {
      const flipAction = () => {
        if (!state.cardFlipped) {
          state.cardFlipped = true;
          if (state.imposterIndices.has(state.currentRevealIdx)) sfx.imposter();
          else sfx.flip();
          render();
        }
      };
      const card = document.getElementById('secret-card');
      if (card) card.onclick = flipAction;
      const flipBtn = document.getElementById('btn-flip-trigger');
      if (flipBtn) flipBtn.onclick = flipAction;
      const nextBtn = document.getElementById('btn-next-player');
      if (nextBtn) {
        nextBtn.onclick = () => {
          sfx.click();
          if (state.currentRevealIdx < state.playerCount - 1) {
            state.currentRevealIdx += 1;
            state.cardFlipped = false;
            render();
          } else {
            state.phase = 'discuss';
            render();
            if (state.timerMinutes > 0) startTimer();
          }
        };
      }
    }

    if (state.phase === 'discuss') {
      const tBtn = document.getElementById('btn-timer-toggle');
      if (tBtn) tBtn.onclick = () => { if (state.timerRunning) stopTimer(); else startTimer(); render(); };
      const addBtn = document.getElementById('btn-timer-add');
      if (addBtn) addBtn.onclick = () => { state.timerSeconds += 30; sfx.click(); render(); };
      document.getElementById('btn-go-vote').onclick = () => { stopTimer(); state.phase = 'vote'; sfx.click(); render(); };
    }

    if (state.phase === 'vote') {
      document.querySelectorAll('[data-vote]').forEach((btn) => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.vote);
          state.votedOutIdx = idx;
          const caught = state.imposterIndices.has(idx);
          state.players.forEach((name, pIdx) => {
            if (caught && !state.imposterIndices.has(pIdx)) state.scores[name] = (state.scores[name] || 0) + 1;
            else if (!caught && state.imposterIndices.has(pIdx)) state.scores[name] = (state.scores[name] || 0) + 2;
          });
          if (caught) sfx.win();
          else sfx.imposter();
          state.phase = 'result';
          render();
        };
      });
      document.getElementById('btn-back-discuss').onclick = () => { state.phase = 'discuss'; render(); };
    }

    if (state.phase === 'result') {
      document.getElementById('btn-play-again').onclick = () => { state.round += 1; startPassPlayRound(); };
      document.getElementById('btn-edit-setup').onclick = () => { state.round += 1; state.phase = 'setup'; render(); };
    }
  }

  render();
  if (state.mode === 'online') fetchPublicRooms();
})();
