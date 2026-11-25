(() => {
  const root = document.getElementById('ranking-imposter-app');
  if (!root || !window.IMPOSTER_EXTRA?.rankingPairs) return;

  const pairs = window.IMPOSTER_EXTRA.rankingPairs;
  const COLORS = ['#38bdf8', '#f97316', '#a855f7', '#10b981', '#eab308', '#ec4899', '#14b8a6', '#ef4444'];

  const state = {
    phase: 'setup',
    playerCount: 4,
    players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    pair: null,
    imposterIdx: 0,
    currentIdx: 0,
    revealed: false,
    currentVal: 5,
    ratings: [],
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
    state.revealed = false;
    state.currentVal = 5;
    state.ratings = Array(state.playerCount).fill(5);
    state.votedIdx = null;
    state.phase = 'rate';
    render();
  }

  function render() {
    syncPlayers();
    let html = '';

    if (state.phase === 'setup') {
      const inputs = state.players
        .map((n, i) => `<input type="text" class="r-name" data-idx="${i}" value="${esc(n)}" maxlength="18" />`)
        .join('');
      html = `
        <div class="panel" style="max-width:600px;margin:0 auto;">
          <h2 class="panel-title">Ranking Imposter (1–10 Scale)</h2>
          <div class="stepper-row">
            <div class="stepper-label">
              <strong>Players</strong>
              <small>Everyone picks a number from 1 to 10 — the Imposter gets a completely different topic!</small>
            </div>
            <div class="stepper">
              <button type="button" id="r-minus">−</button>
              <span>${state.playerCount}</span>
              <button type="button" id="r-plus">+</button>
            </div>
          </div>
          <div class="player-inputs" style="margin:1rem 0 1.25rem;">${inputs}</div>
          <button type="button" class="btn btn-primary btn-lg" id="r-start">Start Ranking Round</button>
        </div>
      `;
    } else if (state.phase === 'rate') {
      const name = state.players[state.currentIdx];
      const prompt = state.currentIdx === state.imposterIdx ? state.pair.imposter : state.pair.crew;
      html = `
        <div class="stage" style="max-width:560px;">
          <div class="stage-progress">Player ${state.currentIdx + 1} of ${state.playerCount}</div>
          <h2>Pass to ${esc(name)}</h2>
          ${
            !state.revealed
              ? `<p class="stage-sub">Tap below in private to see your 1–10 rating prompt.</p>
                 <button type="button" class="btn btn-primary btn-lg" id="r-show">Reveal My Rating Prompt</button>`
              : `<div class="result-card" style="text-align:left;border-color:var(--accent);">
                   <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;color:var(--accent);margin-bottom:0.4rem;">Your Secret Prompt</div>
                   <div style="font-size:1.18rem;font-weight:800;line-height:1.35;">${esc(prompt)}</div>
                 </div>
                 <div style="margin:1.25rem 0;">
                   <div id="r-val-display" style="font-size:3rem;font-weight:900;color:var(--imposter);">${state.currentVal} / 10</div>
                   <input type="range" id="r-slider" min="1" max="10" value="${state.currentVal}" style="width:100%;accent-color:var(--imposter);cursor:pointer;" />
                 </div>
                 <button type="button" class="btn btn-primary btn-lg" id="r-lock">
                   ${state.currentIdx === state.playerCount - 1 ? 'Lock Score & Reveal All' : 'Lock Score & Pass Next'}
                 </button>`
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
              <span class="clue-word-pill" style="font-size:1.05rem;">${state.ratings[idx]} / 10</span>
            </div>
          `
        )
        .join('');
      const votes = state.players
        .map((name, idx) => `<button type="button" class="vote-btn" data-r-vote="${idx}">Vote ${esc(name)}</button>`)
        .join('');
      html = `
        <div class="stage" style="max-width:620px;">
          <div class="stage-progress">The Crew's True Prompt Was:</div>
          <h2 style="font-size:1.38rem;">"${esc(state.pair.crew)}"</h2>
          <p class="stage-sub">Whose number looks totally suspicious? Debate and vote them out!</p>
          <div class="clue-board">${rows}</div>
          <div class="vote-grid">${votes}</div>
        </div>
      `;
    } else if (state.phase === 'result') {
      const caught = state.votedIdx === state.imposterIdx;
      html = `
        <div class="stage" style="max-width:580px;">
          <div class="ejection-banner">
            <div class="ejection-text">
              ${esc(state.players[state.votedIdx])} was ${caught ? '<span style="color:var(--imposter);">The Imposter!</span>' : '<span style="color:var(--accent);">NOT The Imposter.</span>'}
            </div>
          </div>
          <h2>${caught ? 'Imposter Exposed!' : 'Imposter Survived!'}</h2>
          <div class="result-card" style="text-align:left;">
            <p style="margin:0 0 0.5rem;"><strong>Imposter:</strong> <span style="color:var(--imposter);">${esc(state.players[state.imposterIdx])}</span></p>
            <p style="margin:0 0 0.5rem;"><strong>Crew Prompt:</strong> ${esc(state.pair.crew)}</p>
            <p style="margin:0;"><strong>Imposter Prompt:</strong> <span style="color:var(--accent);">${esc(state.pair.imposter)}</span></p>
          </div>
          <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="r-again">Play Next Prompt</button>
            <button type="button" class="btn btn-secondary" id="r-reset">Change Players</button>
          </div>
        </div>
      `;
    }

    root.innerHTML = html;

    if (state.phase === 'setup') {
      document.getElementById('r-minus').onclick = () => { if (state.playerCount > 3) { state.playerCount--; render(); } };
      document.getElementById('r-plus').onclick = () => { if (state.playerCount < 10) { state.playerCount++; render(); } };
      document.querySelectorAll('.r-name').forEach((el) => {
        el.oninput = (e) => { state.players[Number(e.target.dataset.idx)] = e.target.value || `Player ${Number(e.target.dataset.idx) + 1}`; };
      });
      document.getElementById('r-start').onclick = startRound;
    } else if (state.phase === 'rate') {
      const show = document.getElementById('r-show');
      if (show) show.onclick = () => { state.revealed = true; render(); };
      const slider = document.getElementById('r-slider');
      if (slider) {
        slider.oninput = (e) => {
          state.currentVal = Number(e.target.value);
          document.getElementById('r-val-display').textContent = `${state.currentVal} / 10`;
        };
      }
      const lock = document.getElementById('r-lock');
      if (lock) {
        lock.onclick = () => {
          state.ratings[state.currentIdx] = state.currentVal;
          if (state.currentIdx < state.playerCount - 1) {
            state.currentIdx++;
            state.revealed = false;
            state.currentVal = 5;
          } else {
            state.phase = 'reveal';
          }
          render();
        };
      }
    } else if (state.phase === 'reveal') {
      document.querySelectorAll('[data-r-vote]').forEach((b) => {
        b.onclick = () => { state.votedIdx = Number(b.dataset.rVote); state.phase = 'result'; render(); };
      });
    } else if (state.phase === 'result') {
      document.getElementById('r-again').onclick = startRound;
      document.getElementById('r-reset').onclick = () => { state.phase = 'setup'; render(); };
    }
  }

  render();
})();
