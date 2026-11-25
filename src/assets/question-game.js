(() => {
  const root = document.getElementById('question-imposter-app');
  if (!root || !window.IMPOSTER_EXTRA?.questionPairs) return;

  const pairs = window.IMPOSTER_EXTRA.questionPairs;
  const COLORS = ['#38bdf8', '#f97316', '#a855f7', '#10b981', '#eab308', '#ec4899', '#14b8a6', '#ef4444'];

  const state = {
    phase: 'setup', // setup | answer | reveal | result
    playerCount: 4,
    players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    pair: null,
    imposterIdx: 0,
    currentIdx: 0,
    revealedPrompt: false,
    answers: [],
    votedIdx: null,
    used: new Set()
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function syncPlayers() {
    while (state.players.length < state.playerCount) state.players.push(`Player ${state.players.length + 1}`);
    state.players = state.players.slice(0, state.playerCount);
  }

  function startRound() {
    syncPlayers();
    let fresh = pairs.filter((p) => !state.used.has(p.crew));
    if (!fresh.length) { state.used.clear(); fresh = pairs; }
    state.pair = fresh[Math.floor(Math.random() * fresh.length)];
    state.used.add(state.pair.crew);
    state.imposterIdx = Math.floor(Math.random() * state.playerCount);
    state.currentIdx = 0;
    state.revealedPrompt = false;
    state.answers = Array(state.playerCount).fill('');
    state.votedIdx = null;
    state.phase = 'answer';
    render();
  }

  function render() {
    syncPlayers();
    let html = '';

    if (state.phase === 'setup') {
      const inputs = state.players
        .map((n, i) => `<input type="text" class="q-name" data-idx="${i}" value="${esc(n)}" maxlength="18" />`)
        .join('');
      html = `
        <div class="panel" style="max-width:600px;margin:0 auto;">
          <h2 class="panel-title">Question Imposter Setup</h2>
          <div class="stepper-row">
            <div class="stepper-label">
              <strong>Players</strong>
              <small>Everyone answers a secret question — the Imposter gets a slightly different one!</small>
            </div>
            <div class="stepper">
              <button type="button" id="q-minus">−</button>
              <span>${state.playerCount}</span>
              <button type="button" id="q-plus">+</button>
            </div>
          </div>
          <div class="player-inputs" style="margin:1rem 0 1.25rem;">${inputs}</div>
          <button type="button" class="btn btn-primary btn-lg" id="q-start">Start Question Round</button>
        </div>
      `;
    } else if (state.phase === 'answer') {
      const name = state.players[state.currentIdx];
      const isImp = state.currentIdx === state.imposterIdx;
      const prompt = isImp ? state.pair.imposter : state.pair.crew;
      html = `
        <div class="stage" style="max-width:560px;">
          <div class="stage-progress">Player ${state.currentIdx + 1} of ${state.playerCount}</div>
          <h2>Pass to ${esc(name)}</h2>
          ${
            !state.revealedPrompt
              ? `<p class="stage-sub">Make sure nobody else is looking, then tap to see your secret question.</p>
                 <button type="button" class="btn btn-primary btn-lg" id="q-show">Reveal My Secret Question</button>`
              : `<div class="result-card" style="text-align:left;border-color:var(--accent);">
                   <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;color:var(--accent);margin-bottom:0.4rem;">Your Secret Question</div>
                   <div style="font-size:1.22rem;font-weight:800;line-height:1.35;">${esc(prompt)}</div>
                 </div>
                 <form id="q-answer-form" style="display:flex;flex-direction:column;gap:0.75rem;">
                   <input type="text" id="q-answer-input" placeholder="Type your honest answer..." maxlength="60" required autocomplete="off" />
                   <button type="submit" class="btn btn-primary btn-lg">
                     ${state.currentIdx === state.playerCount - 1 ? 'Lock Answer & Reveal All' : 'Lock Answer & Pass Next'}
                   </button>
                 </form>`
          }
        </div>
      `;
    } else if (state.phase === 'reveal') {
      const rows = state.players
        .map(
          (name, idx) => `
            <div class="clue-row">
              <div class="clue-player">
                <span class="avatar-badge" style="background:${COLORS[idx % COLORS.length]}26;border-color:${COLORS[idx % COLORS.length]};">${idx + 1}</span>
                <span>${esc(name)}</span>
              </div>
              <span class="clue-word-pill">${esc(state.answers[idx])}</span>
            </div>
          `
        )
        .join('');
      const votes = state.players
        .map((name, idx) => `<button type="button" class="vote-btn" data-q-vote="${idx}">Vote ${esc(name)}</button>`)
        .join('');
      html = `
        <div class="stage" style="max-width:620px;">
          <div class="stage-progress">The Crew's True Question Was:</div>
          <h2 style="font-size:1.45rem;">"${esc(state.pair.crew)}"</h2>
          <p class="stage-sub">Read everyone's answer below and vote out whoever answered a totally different question!</p>
          <div class="clue-board">${rows}</div>
          <div class="vote-grid">${votes}</div>
        </div>
      `;
    } else if (state.phase === 'result') {
      const caught = state.votedIdx === state.imposterIdx;
      const votedName = state.players[state.votedIdx];
      const impName = state.players[state.imposterIdx];
      html = `
        <div class="stage" style="max-width:580px;">
          <div class="ejection-banner">
            <div class="ejection-text">
              ${esc(votedName)} was ${caught ? '<span style="color:var(--imposter);">The Imposter!</span>' : '<span style="color:var(--accent);">NOT The Imposter.</span>'}
            </div>
          </div>
          <h2>${caught ? 'Crew Caught the Imposter!' : 'The Imposter Fooled Everyone!'}</h2>
          <div class="result-card" style="text-align:left;">
            <p style="margin:0 0 0.5rem;"><strong>Imposter:</strong> <span style="color:var(--imposter);">${esc(impName)}</span></p>
            <p style="margin:0 0 0.5rem;"><strong>Crew Question:</strong> ${esc(state.pair.crew)}</p>
            <p style="margin:0;"><strong>Imposter Question:</strong> <span style="color:var(--accent);">${esc(state.pair.imposter)}</span></p>
          </div>
          <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="q-again">Play Next Question</button>
            <button type="button" class="btn btn-secondary" id="q-reset">Change Players</button>
          </div>
        </div>
      `;
    }

    root.innerHTML = html;

    if (state.phase === 'setup') {
      document.getElementById('q-minus').onclick = () => { if (state.playerCount > 3) { state.playerCount--; render(); } };
      document.getElementById('q-plus').onclick = () => { if (state.playerCount < 10) { state.playerCount++; render(); } };
      document.querySelectorAll('.q-name').forEach((el) => {
        el.oninput = (e) => { state.players[Number(e.target.dataset.idx)] = e.target.value || `Player ${Number(e.target.dataset.idx) + 1}`; };
      });
      document.getElementById('q-start').onclick = startRound;
    } else if (state.phase === 'answer') {
      const show = document.getElementById('q-show');
      if (show) show.onclick = () => { state.revealedPrompt = true; render(); };
      const form = document.getElementById('q-answer-form');
      if (form) {
        form.onsubmit = (e) => {
          e.preventDefault();
          const val = document.getElementById('q-answer-input').value.trim();
          if (!val) return;
          state.answers[state.currentIdx] = val;
          if (state.currentIdx < state.playerCount - 1) {
            state.currentIdx++;
            state.revealedPrompt = false;
          } else {
            state.phase = 'reveal';
          }
          render();
        };
      }
    } else if (state.phase === 'reveal') {
      document.querySelectorAll('[data-q-vote]').forEach((b) => {
        b.onclick = () => { state.votedIdx = Number(b.dataset.qVote); state.phase = 'result'; render(); };
      });
    } else if (state.phase === 'result') {
      document.getElementById('q-again').onclick = startRound;
      document.getElementById('q-reset').onclick = () => { state.phase = 'setup'; render(); };
    }
  }

  render();
})();
