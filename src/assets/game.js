(() => {
  const root = document.getElementById('imposter-game-app');
  if (!root || !window.IMPOSTER_DATA) return;

  const categories = window.IMPOSTER_DATA.categories;
  const botProfiles = window.IMPOSTER_DATA.bots || [];
  const soloWords = window.IMPOSTER_DATA.soloWords || [];
  const defaultCategory = root.dataset.defaultCategory || 'everyday-food';

  const AVATAR_POOL = [
    { color: '#38bdf8', icon: '🧑‍🚀' },
    { color: '#f97316', icon: '🦊' },
    { color: '#a855f7', icon: '🤖' },
    { color: '#10b981', icon: '👽' },
    { color: '#eab308', icon: '🐱' },
    { color: '#ec4899', icon: '🦄' },
    { color: '#14b8a6', icon: '🐸' },
    { color: '#ef4444', icon: '🦖' },
    { color: '#6366f1', icon: '👾' },
    { color: '#84cc16', icon: '🐼' },
    { color: '#f43f5e', icon: '🐙' },
    { color: '#06b6d4', icon: '🐧' }
  ];

  // Web Audio sound effects (zero external assets)
  let soundEnabled = true;
  let audioCtx = null;

  function playTone(freq, duration = 0.08, type = 'sine', gainVal = 0.08) {
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
    click: () => playTone(520, 0.06, 'triangle', 0.06),
    flip: () => {
      playTone(340, 0.07, 'sine', 0.07);
      setTimeout(() => playTone(560, 0.09, 'sine', 0.07), 50);
    },
    imposter: () => {
      playTone(220, 0.14, 'sawtooth', 0.06);
      setTimeout(() => playTone(185, 0.18, 'sawtooth', 0.06), 110);
    },
    win: () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.14, 'triangle', 0.08), i * 85));
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

  const state = {
    mode: 'solo', // 'solo' | 'passplay'
    phase: 'setup', // setup | reveal | discuss | vote | result | solo-play | solo-vote | solo-guess | solo-result
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
    soloRolePref: 'random', // 'random' | 'crew' | 'imposter'
    soloBotCount: 3,
    soloRoster: [],
    soloImposterIdx: 0,
    soloEntry: null,
    soloClues: [],
    soloUserSubmitted: false,
    soloVotedIdx: null,
    soloGuessOptions: [],
    soloGuessCorrect: null,
    soloWins: 0,
    soloGames: 0,
    soloUsedWords: new Set()
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
        if (state.timerSeconds <= 5 && state.timerSeconds > 0) {
          playTone(680, 0.05, 'sine', 0.05);
        }
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
    return `<span class="avatar-badge" style="background:${p.color}26;border-color:${p.color};">${p.icon}</span>`;
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
      { name: 'You', isHuman: true, color: '#ff4d6d', icon: '🕵️' },
      ...chosenBots.map((b) => ({ ...b, isHuman: false }))
    ];
    state.soloRoster = roster;

    if (state.soloRolePref === 'imposter') {
      state.soloImposterIdx = 0;
    } else if (state.soloRolePref === 'crew') {
      state.soloImposterIdx = 1 + Math.floor(Math.random() * state.soloBotCount);
    } else {
      state.soloImposterIdx = Math.floor(Math.random() * roster.length);
    }

    // Generate turn order & bot clues
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
      if (pos < humanPos) {
        state.soloClues.push(item);
      } else {
        state.soloPendingAfterHuman.push(item);
      }
    });

    state.soloUserSubmitted = false;
    state.soloVotedIdx = null;
    state.soloGuessCorrect = null;

    // Build 4-option guess choices in case human Imposter is caught
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
    // Append remaining bots' clues
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
      // Bots also vote: if human's clue was generic or random suspicion, 55% chance bots catch you
      const botsCatchYou = Math.random() < 0.55;
      if (botsCatchYou) {
        state.soloVotedIdx = 0;
        state.phase = 'solo-guess';
        sfx.imposter();
        render();
        return;
      } else {
        // Bots mistakenly eject a bot
        const wrongBot = 1 + Math.floor(Math.random() * state.soloBotCount);
        state.soloVotedIdx = wrongBot;
        state.soloWins += 1;
        sfx.win();
        state.phase = 'solo-result';
        render();
        return;
      }
    }

    if (caught) {
      state.soloWins += 1;
      sfx.win();
    } else {
      sfx.imposter();
    }
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
    state.phase = 'reveal';
    sfx.click();
    render();
  }

  // ===== RENDERERS =====
  function renderTopbar() {
    const labels = {
      setup: state.mode === 'solo' ? `Solo vs AI Bots • Wins: ${state.soloWins}/${state.soloGames}` : `Pass & Play • Round ${state.round}`,
      reveal: `Pass & Play • Card Reveal (${state.currentRevealIdx + 1}/${state.playerCount})`,
      discuss: `Pass & Play • Clue & Discussion`,
      vote: `Pass & Play • Vote Out the Imposter`,
      result: `Pass & Play • Space Ejection Reveal`,
      'solo-play': `Solo vs AI Bots • Clue Round`,
      'solo-guess': `Solo vs AI Bots • Imposter Last Chance!`,
      'solo-result': `Solo vs AI Bots • Round Result`
    };
    return `
      <div class="game-topbar">
        <div class="game-status">
          <span class="dot"></span>
          <span>${labels[state.phase] || 'Imposter Game Online'}</span>
        </div>
        <div class="topbar-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="toggle-sound">
            ${soundEnabled ? '🔊 Sound On' : '🔇 Muted'}
          </button>
          ${state.phase !== 'setup' ? '<button type="button" class="btn btn-secondary btn-sm" id="btn-reset">↺ Change Mode</button>' : ''}
        </div>
      </div>
    `;
  }

  function renderModeTabs() {
    return `
      <div class="mode-tabs" role="tablist">
        <button type="button" class="mode-tab ${state.mode === 'solo' ? 'active' : ''}" id="tab-solo">
          <strong>🤖 Solo vs AI Bots (1 Player)</strong>
          <small>Play instantly by yourself — catch the AI Imposter or bluff the bots</small>
        </button>
        <button type="button" class="mode-tab ${state.mode === 'passplay' ? 'active' : ''}" id="tab-passplay">
          <strong>📱 Pass &amp; Play (3–12 Friends)</strong>
          <small>Share one phone or laptop with friends — 8 packs &amp; custom words</small>
        </button>
      </div>
    `;
  }

  function renderSoloSetup() {
    return `
      ${renderModeTabs()}
      <div class="panel" style="max-width:620px;margin:0 auto;">
        <h2 class="panel-title">Solo vs AI Quick Match</h2>
        <div class="stepper-row">
          <div class="stepper-label">
            <strong>AI Bot Opponents</strong>
            <small>Total players: ${state.soloBotCount + 1}</small>
          </div>
          <div class="stepper">
            <button type="button" id="solo-bots-minus">−</button>
            <span>${state.soloBotCount}</span>
            <button type="button" id="solo-bots-plus">+</button>
          </div>
        </div>
        <div class="stepper-row">
          <div class="stepper-label">
            <strong>Your Role</strong>
            <small>Practice catching bots or bluffing as Imposter</small>
          </div>
          <div style="width:160px;">
            <select id="solo-role-select">
              <option value="random" ${state.soloRolePref === 'random' ? 'selected' : ''}>🎲 Random Role</option>
              <option value="crew" ${state.soloRolePref === 'crew' ? 'selected' : ''}>🛡️ Innocent Player</option>
              <option value="imposter" ${state.soloRolePref === 'imposter' ? 'selected' : ''}>😈 Imposter</option>
            </select>
          </div>
        </div>
        <div style="margin-top:1.25rem;">
          <button type="button" class="btn btn-primary btn-lg" id="btn-start-solo">
            🤖 Start Solo Match Now
          </button>
        </div>
      </div>
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
      .map((p, idx) => {
        if (p.isHuman) return '';
        return `
          <button type="button" class="vote-btn" data-solo-vote="${idx}">
            <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;">
              ${avatarHtml(idx, p)}
              <span>Eject ${escapeHtml(p.name)}</span>
            </div>
          </button>
        `;
      })
      .join('');

    return `
      <div class="stage" style="max-width:600px;">
        <div class="solo-role-banner ${humanIsImp ? 'imposter' : 'crew'}">
          <div>
            <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:${humanIsImp ? '#fda4af' : '#6ee7b7'};">
              ${humanIsImp ? '😈 You Are The Imposter' : '🛡️ You Are Innocent'}
            </div>
            <div style="font-size:1.35rem;font-weight:900;">
              ${humanIsImp ? `Blend in! Category: ${escapeHtml(entry.category)}` : `Secret Word: ${escapeHtml(entry.word)}`}
            </div>
          </div>
          <div class="role-hint">
            ${humanIsImp ? `Hint: <strong>${escapeHtml(entry.hint)}</strong>` : `Category: <strong>${escapeHtml(entry.category)}</strong>`}
          </div>
        </div>

        <h2 style="font-size:1.3rem;margin-bottom:0.25rem;">One-Word Clue Feed</h2>
        <p class="stage-sub" style="margin-bottom:0.85rem;">
          ${
            !state.soloUserSubmitted
              ? humanIsImp
                ? 'Read the clues so far and type 1 convincing bluff word!'
                : 'Read the clues and type 1 word that proves you know the secret word.'
              : humanIsImp
                ? 'All clues are in! Tap below to see who the AI bots vote out.'
                : 'Spot the suspicious vague clue and vote out the AI Imposter!'
          }
        </p>

        <div class="clue-board">
          ${clueRows || '<div class="clue-row" style="justify-content:center;color:var(--text-muted);">You go first this round! Drop the opening 1-word clue.</div>'}
        </div>

        ${
          !state.soloUserSubmitted
            ? `<form class="clue-input-bar" id="solo-clue-form">
                 <input type="text" id="solo-clue-input" placeholder="Type 1 clue word (e.g. Cheese)" maxlength="24" required autocomplete="off" />
                 <button type="submit" class="btn btn-primary">Send Clue</button>
               </form>`
            : humanIsImp
              ? `<button type="button" class="btn btn-primary btn-lg" id="btn-solo-bot-vote">🗳️ Let the Bots Vote!</button>`
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
        <h2>⚡ Imposter Last Chance!</h2>
        <p class="stage-sub">The AI bots voted you out! Guess the secret word correctly to steal the win:</p>
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
          <div class="ejected-floater" style="background:${ejected.color}33;border:2px solid ${ejected.color};">${ejected.icon}</div>
          <div class="ejection-text">
            ${escapeHtml(ejected.name)} was ${state.soloVotedIdx === state.soloImposterIdx ? '<span style="color:var(--imposter);">The Imposter!</span>' : '<span style="color:var(--accent);">NOT The Imposter.</span>'}
          </div>
        </div>

        <h2>${userWon ? '🎉 You Won This Round!' : '💀 Better Luck Next Round!'}</h2>
        <div class="result-card">
          <p style="margin:0 0 0.5rem;">The Imposter was: <strong style="color:var(--imposter);">${escapeHtml(imp.name)}</strong></p>
          <p style="margin:0;">The Secret Word was: <strong style="color:var(--crew);font-size:1.25rem;">${escapeHtml(state.soloEntry.word)}</strong></p>
          ${state.soloGuessCorrect === true ? '<p style="margin:0.5rem 0 0;color:var(--crew);font-weight:700;">🔥 Clutch Imposter Steal! You guessed the word!</p>' : ''}
        </div>

        <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" id="btn-solo-again">🔄 Play Another Solo Round</button>
          <button type="button" class="btn btn-secondary" id="btn-solo-setup">⚙️ Switch Mode / Settings</button>
        </div>
      </div>
    `;
  }

  function renderPassPlaySetup() {
    const maxImp = Math.max(1, Math.min(3, Math.floor((state.playerCount - 1) / 2)));
    const catHtml = categories
      .map((cat) => {
        const selected = !state.useCustomWord && state.selectedCategories.has(cat.id);
        return `
          <button type="button" class="cat-chip ${selected ? 'selected' : ''}" data-cat="${cat.id}">
            <span>${cat.emoji}</span>
            <span>${escapeHtml(cat.name)}</span>
          </button>
        `;
      })
      .join('');

    const playerHtml = state.players
      .map(
        (name, idx) => `
          <input type="text" class="player-name-input" data-idx="${idx}" value="${escapeHtml(name)}" maxlength="20" aria-label="Player ${idx + 1} name" />
        `
      )
      .join('');

    return `
      ${renderModeTabs()}
      <div class="setup-grid">
        <div class="panel">
          <h2 class="panel-title">1. Match Settings</h2>
          <div class="stepper-row">
            <div class="stepper-label">
              <strong>Players</strong>
              <small>3 to 12 friends on one device</small>
            </div>
            <div class="stepper">
              <button type="button" id="players-minus" aria-label="Decrease players">−</button>
              <span>${state.playerCount}</span>
              <button type="button" id="players-plus" aria-label="Increase players">+</button>
            </div>
          </div>

          <div class="stepper-row">
            <div class="stepper-label">
              <strong>Imposters</strong>
              <small>Max ${maxImp} for ${state.playerCount} players</small>
            </div>
            <div class="stepper">
              <button type="button" id="imp-minus" aria-label="Decrease imposters">−</button>
              <span>${state.imposterCount}</span>
              <button type="button" id="imp-plus" aria-label="Increase imposters">+</button>
            </div>
          </div>

          <div class="stepper-row">
            <div class="stepper-label">
              <strong>Imposter Hint</strong>
              <small>Show category clue to help bluffing</small>
            </div>
            <label class="toggle">
              <input type="checkbox" id="toggle-hint" ${state.imposterHint ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="stepper-row">
            <div class="stepper-label">
              <strong>Discussion Timer</strong>
              <small>Countdown per round</small>
            </div>
            <div style="width: 125px;">
              <select id="select-timer" aria-label="Discussion Timer">
                <option value="1" ${state.timerMinutes === 1 ? 'selected' : ''}>1 Min</option>
                <option value="2" ${state.timerMinutes === 2 ? 'selected' : ''}>2 Mins</option>
                <option value="3" ${state.timerMinutes === 3 ? 'selected' : ''}>3 Mins</option>
                <option value="5" ${state.timerMinutes === 5 ? 'selected' : ''}>5 Mins</option>
                <option value="0" ${state.timerMinutes === 0 ? 'selected' : ''}>No Limit</option>
              </select>
            </div>
          </div>

          <h2 class="panel-title" style="margin-top: 1.15rem;">2. Player Names</h2>
          <div class="player-inputs">${playerHtml}</div>
        </div>

        <div class="panel">
          <h2 class="panel-title">
            <span>3. Word Categories</span>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-custom-mode">
              ${state.useCustomWord ? 'Use Preset Packs' : '✏️ Custom Word'}
            </button>
          </h2>
          <div class="category-grid">${catHtml}</div>
          <div class="custom-word-box ${state.useCustomWord ? 'visible' : ''}">
            <label style="display:block;font-size:0.85rem;color:var(--text-muted);margin-bottom:0.35rem;">Enter your own secret word:</label>
            <input type="text" id="input-custom-word" placeholder="e.g. Haunted House" value="${escapeHtml(state.customWord)}" />
            <input type="text" id="input-custom-hint" placeholder="Optional hint for Imposter (e.g. Spooky place)" value="${escapeHtml(state.customHint)}" style="margin-top:0.5rem;" />
          </div>
          <div style="margin-top: 1.25rem;">
            <button type="button" class="btn btn-primary btn-lg" id="btn-start">
              🚀 Deal Secret Cards &amp; Start Game
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderReveal() {
    const playerName = state.players[state.currentRevealIdx];
    const isImposter = state.imposterIndices.has(state.currentRevealIdx);
    const isLast = state.currentRevealIdx === state.playerCount - 1;

    return `
      <div class="stage">
        <div class="stage-progress">Pass the device to</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:0.65rem;margin-bottom:0.4rem;">
          ${avatarHtml(state.currentRevealIdx)}
          <h2 style="margin:0;">${escapeHtml(playerName)}</h2>
        </div>
        <p class="stage-sub">Make sure nobody else is peeking at the screen!</p>

        <div class="flip-scene">
          <div class="flip-card ${state.cardFlipped ? 'flipped' : ''}" id="secret-card" role="button" tabindex="0">
            <div class="card-face card-front">
              <div class="tap-icon">🕵️</div>
              <strong>Tap to Reveal Role</strong>
              <span>Keep it secret from other players</span>
            </div>
            <div class="card-face card-back ${isImposter ? 'imposter' : 'crew'}">
              <div class="role-pill">${isImposter ? 'You Are The Imposter' : 'You Are Innocent'}</div>
              ${
                isImposter
                  ? `<div class="secret-word">BLEND IN!</div>
                     <div class="role-hint">${
                       state.imposterHint
                         ? `Category: <strong>${escapeHtml(state.secretCategory)}</strong> • Hint: <strong>${escapeHtml(state.secretHint)}</strong>`
                         : 'Hardcore Mode: No hint given. Listen carefully!'
                     }</div>`
                  : `<div class="secret-word">${escapeHtml(state.secretWord)}</div>
                     <div class="role-hint">Category: <strong>${escapeHtml(state.secretCategory)}</strong></div>`
              }
            </div>
          </div>
        </div>

        ${
          state.cardFlipped
            ? `<button type="button" class="btn btn-primary btn-lg" id="btn-next-player">
                 ${isLast ? '✅ Hide Card & Start Discussion' : '🙈 Hide & Pass to Next Player'}
               </button>`
            : `<button type="button" class="btn btn-secondary btn-lg" id="btn-flip-trigger">
                 👁️ Reveal My Secret Card
               </button>`
        }
      </div>
    `;
  }

  function renderDiscuss() {
    const firstSpeaker = state.players[state.firstSpeakerIdx];
    return `
      <div class="stage">
        <div class="stage-progress">Category: ${escapeHtml(state.secretCategory)}</div>
        <h2>Give Your One-Word Clues!</h2>
        <div class="first-speaker">🎤 Goes First: <strong>${escapeHtml(firstSpeaker)}</strong></div>
        <p class="stage-sub">Go around the circle. Each player says one clue word about the secret word without making it too obvious for the Imposter.</p>

        ${
          state.timerMinutes > 0
            ? `<div class="timer-box ${state.timerSeconds <= 15 ? 'urgent' : ''}" id="timer-display">${formatTime(state.timerSeconds)}</div>
               <div style="display:flex;justify-content:center;gap:0.6rem;margin-bottom:1.4rem;">
                 <button type="button" class="btn btn-secondary btn-sm" id="btn-timer-toggle">${state.timerRunning ? '⏸ Pause' : '▶ Start Timer'}</button>
                 <button type="button" class="btn btn-secondary btn-sm" id="btn-timer-add">+30s</button>
               </div>`
            : `<p class="stage-sub"><strong>Timer:</strong> Unlimited — take your time debating!</p>`
        }

        <button type="button" class="btn btn-primary btn-lg" id="btn-go-vote">
          🗳️ Ready to Vote Out the Imposter
        </button>
      </div>
    `;
  }

  function renderVote() {
    const btns = state.players
      .map(
        (name, idx) => `
          <button type="button" class="vote-btn" data-vote="${idx}">
            <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;">
              ${avatarHtml(idx)}
              <span>${escapeHtml(name)}</span>
            </div>
          </button>
        `
      )
      .join('');

    return `
      <div class="stage">
        <div class="stage-progress">Final Decision</div>
        <h2>Who Is The Imposter?</h2>
        <p class="stage-sub">Tap the player the group voted to eject.</p>
        <div class="vote-grid">${btns}</div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-back-discuss">← Back to Discussion</button>
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
          <div class="ejected-floater" style="background:${ejectedAvatar.color}33;border:2px solid ${ejectedAvatar.color};">${ejectedAvatar.icon}</div>
          <div class="ejection-text">
            ${escapeHtml(votedName)} was ${caught ? '<span style="color:var(--imposter);">The Imposter!</span>' : '<span style="color:var(--accent);">NOT The Imposter.</span>'}
          </div>
        </div>

        <h2>${caught ? '🎉 Crew Wins!' : '😈 Imposter Escaped!'}</h2>
        <div class="result-card">
          <p style="margin:0 0 0.6rem;">The Imposter${impNames.length > 1 ? 's were' : ' was'}: <strong style="color:var(--imposter);font-size:1.15rem;">${escapeHtml(impNames.join(', '))}</strong></p>
          <p style="margin:0;">The Secret Word was: <strong style="color:var(--crew);font-size:1.25rem;">${escapeHtml(state.secretWord)}</strong></p>
        </div>

        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center;margin-bottom:1.25rem;">
          <button type="button" class="btn btn-primary" id="btn-play-again">🔄 Play Next Round</button>
          <button type="button" class="btn btn-secondary" id="btn-edit-setup">⚙️ Change Settings</button>
        </div>

        <h3 style="margin:0 0 0.4rem;font-size:0.95rem;color:var(--text-muted);">Session Scoreboard</h3>
        <div class="scoreboard">${scoreItems}</div>
      </div>
    `;
  }

  function render() {
    ensurePlayerNames();
    let body = '';
    if (state.phase === 'setup') {
      body = state.mode === 'solo' ? renderSoloSetup() : renderPassPlaySetup();
    } else if (state.phase === 'solo-play') body = renderSoloPlay();
    else if (state.phase === 'solo-guess') body = renderSoloGuess();
    else if (state.phase === 'solo-result') body = renderSoloResult();
    else if (state.phase === 'reveal') body = renderReveal();
    else if (state.phase === 'discuss') body = renderDiscuss();
    else if (state.phase === 'vote') body = renderVote();
    else if (state.phase === 'result') body = renderResult();

    root.innerHTML = renderTopbar() + body;
    bindEvents();
  }

  function bindEvents() {
    const soundBtn = document.getElementById('toggle-sound');
    if (soundBtn) {
      soundBtn.onclick = () => {
        soundEnabled = !soundEnabled;
        sfx.click();
        render();
      };
    }

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.onclick = () => {
        stopTimer();
        state.phase = 'setup';
        sfx.click();
        render();
      };
    }

    const tabSolo = document.getElementById('tab-solo');
    if (tabSolo) {
      tabSolo.onclick = () => {
        state.mode = 'solo';
        sfx.click();
        render();
      };
    }
    const tabPass = document.getElementById('tab-passplay');
    if (tabPass) {
      tabPass.onclick = () => {
        state.mode = 'passplay';
        sfx.click();
        render();
      };
    }

    if (state.phase === 'setup' && state.mode === 'solo') {
      document.getElementById('solo-bots-minus').onclick = () => {
        if (state.soloBotCount > 2) { state.soloBotCount -= 1; sfx.click(); render(); }
      };
      document.getElementById('solo-bots-plus').onclick = () => {
        if (state.soloBotCount < 5) { state.soloBotCount += 1; sfx.click(); render(); }
      };
      document.getElementById('solo-role-select').onchange = (e) => {
        state.soloRolePref = e.target.value;
        sfx.click();
      };
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
      if (botVoteBtn) {
        botVoteBtn.onclick = () => resolveSoloVote(0);
      }
      document.querySelectorAll('[data-solo-vote]').forEach((btn) => {
        btn.onclick = () => resolveSoloVote(Number(btn.dataset.soloVote));
      });
    }

    if (state.phase === 'solo-guess') {
      document.querySelectorAll('[data-solo-guess]').forEach((btn) => {
        btn.onclick = () => {
          const picked = btn.dataset.soloGuess;
          state.soloGuessCorrect = picked === state.soloEntry.word;
          if (state.soloGuessCorrect) {
            state.soloWins += 1;
            sfx.win();
          } else {
            sfx.imposter();
          }
          state.phase = 'solo-result';
          render();
        };
      });
    }

    if (state.phase === 'solo-result') {
      document.getElementById('btn-solo-again').onclick = startSoloRound;
      document.getElementById('btn-solo-setup').onclick = () => {
        state.phase = 'setup';
        render();
      };
    }

    if (state.phase === 'setup' && state.mode === 'passplay') {
      document.getElementById('players-minus').onclick = () => {
        if (state.playerCount > 3) { state.playerCount -= 1; sfx.click(); render(); }
      };
      document.getElementById('players-plus').onclick = () => {
        if (state.playerCount < 12) { state.playerCount += 1; sfx.click(); render(); }
      };
      document.getElementById('imp-minus').onclick = () => {
        if (state.imposterCount > 1) { state.imposterCount -= 1; sfx.click(); render(); }
      };
      document.getElementById('imp-plus').onclick = () => {
        const maxImp = Math.max(1, Math.min(3, Math.floor((state.playerCount - 1) / 2)));
        if (state.imposterCount < maxImp) { state.imposterCount += 1; sfx.click(); render(); }
      };
      document.getElementById('toggle-hint').onchange = (e) => {
        state.imposterHint = e.target.checked;
        sfx.click();
      };
      document.getElementById('select-timer').onchange = (e) => {
        state.timerMinutes = Number(e.target.value);
        sfx.click();
      };
      document.querySelectorAll('.player-name-input').forEach((input) => {
        input.oninput = (e) => {
          const idx = Number(e.target.dataset.idx);
          state.players[idx] = e.target.value || `Player ${idx + 1}`;
        };
      });
      document.querySelectorAll('.cat-chip').forEach((chip) => {
        chip.onclick = () => {
          const id = chip.dataset.cat;
          state.useCustomWord = false;
          if (state.selectedCategories.has(id) && state.selectedCategories.size > 1) {
            state.selectedCategories.delete(id);
          } else {
            state.selectedCategories.add(id);
          }
          sfx.click();
          render();
        };
      });
      document.getElementById('btn-custom-mode').onclick = () => {
        state.useCustomWord = !state.useCustomWord;
        sfx.click();
        render();
      };
      const customWordEl = document.getElementById('input-custom-word');
      if (customWordEl) customWordEl.oninput = (e) => { state.customWord = e.target.value; };
      const customHintEl = document.getElementById('input-custom-hint');
      if (customHintEl) customHintEl.oninput = (e) => { state.customHint = e.target.value; };
      document.getElementById('btn-start').onclick = startPassPlayRound;
    }

    if (state.phase === 'reveal') {
      const flipAction = () => {
        if (!state.cardFlipped) {
          state.cardFlipped = true;
          const isImp = state.imposterIndices.has(state.currentRevealIdx);
          if (isImp) sfx.imposter();
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
      const toggleTimerBtn = document.getElementById('btn-timer-toggle');
      if (toggleTimerBtn) {
        toggleTimerBtn.onclick = () => {
          if (state.timerRunning) stopTimer();
          else startTimer();
          render();
        };
      }
      const addBtn = document.getElementById('btn-timer-add');
      if (addBtn) {
        addBtn.onclick = () => {
          state.timerSeconds += 30;
          sfx.click();
          render();
        };
      }
      document.getElementById('btn-go-vote').onclick = () => {
        stopTimer();
        state.phase = 'vote';
        sfx.click();
        render();
      };
    }

    if (state.phase === 'vote') {
      document.querySelectorAll('.vote-btn').forEach((btn) => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.vote);
          state.votedOutIdx = idx;
          const caught = state.imposterIndices.has(idx);
          state.players.forEach((name, pIdx) => {
            if (caught && !state.imposterIndices.has(pIdx)) {
              state.scores[name] = (state.scores[name] || 0) + 1;
            } else if (!caught && state.imposterIndices.has(pIdx)) {
              state.scores[name] = (state.scores[name] || 0) + 2;
            }
          });
          if (caught) sfx.win();
          else sfx.imposter();
          state.phase = 'result';
          render();
        };
      });
      document.getElementById('btn-back-discuss').onclick = () => {
        state.phase = 'discuss';
        render();
      };
    }

    if (state.phase === 'result') {
      document.getElementById('btn-play-again').onclick = () => {
        state.round += 1;
        startPassPlayRound();
      };
      document.getElementById('btn-edit-setup').onclick = () => {
        state.round += 1;
        state.phase = 'setup';
        render();
      };
    }
  }

  render();
})();
