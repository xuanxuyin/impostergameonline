(() => {
  const root = document.getElementById('daily-imposter-app');
  if (!root || !window.IMPOSTER_EXTRA?.dailyPuzzles) return;

  const puzzles = window.IMPOSTER_EXTRA.dailyPuzzles;
  const COLORS = ['#38bdf8', '#f97316', '#a855f7', '#10b981'];

  // Deterministic daily puzzle index based on UTC day
  const epoch = new Date('2026-01-01T00:00:00Z').getTime();
  const todayStr = new Date().toISOString().slice(0, 10);
  const dayNumber = Math.max(1, Math.floor((Date.now() - epoch) / 86400000) + 1);
  let activeOffset = 0;

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem('igo_daily_stats') || '{"streak":0,"wins":0,"played":0,"lastDay":""}');
    } catch {
      return { streak: 0, wins: 0, played: 0, lastDay: '' };
    }
  }

  function saveStats(s) {
    try { localStorage.setItem('igo_daily_stats', JSON.stringify(s)); } catch {}
  }

  let pickedIdx = null;

  function currentPuzzle() {
    return puzzles[(dayNumber + activeOffset) % puzzles.length];
  }

  function render() {
    const p = currentPuzzle();
    const stats = loadStats();
    const imp = p.suspects.find((s) => s.isImposter);
    const isPractice = activeOffset > 0;

    const rows = p.suspects
      .map((s, idx) => {
        const picked = pickedIdx === idx;
        const border =
          pickedIdx !== null
            ? s.isImposter
              ? 'border-color:var(--crew);background:rgba(16,185,129,0.14);'
              : picked
                ? 'border-color:var(--imposter);background:rgba(255,77,109,0.14);'
                : ''
            : '';
        return `
          <div class="clue-row" style="${border}">
            <div class="clue-player">
              <span class="avatar-badge" style="background:${COLORS[idx % COLORS.length]}26;border-color:${COLORS[idx % COLORS.length]};">${s.name[0]}</span>
              <span>${s.name}</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.6rem;">
              <span class="clue-word-pill">"${s.clue}"</span>
              ${
                pickedIdx === null
                  ? `<button type="button" class="btn btn-secondary btn-sm" data-daily-pick="${idx}">Accuse</button>`
                  : s.isImposter
                    ? '<strong style="color:var(--imposter);font-size:0.85rem;">IMPOSTER</strong>'
                    : '<span style="color:var(--text-muted);font-size:0.85rem;">Crew</span>'
              }
            </div>
          </div>
        `;
      })
      .join('');

    const won = pickedIdx !== null && p.suspects[pickedIdx].isImposter;

    root.innerHTML = `
      <div class="stage" style="max-width:600px;">
        <div style="display:flex;justify-content:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;">
          <span class="word-tag">📅 ${isPractice ? 'Bonus Puzzle' : `Daily #${dayNumber}`}</span>
          <span class="word-tag">🔥 Streak: <strong>${stats.streak}</strong></span>
          <span class="word-tag">🏆 Wins: <strong>${stats.wins}/${stats.played}</strong></span>
        </div>

        <div class="solo-role-banner crew">
          <div>
            <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;color:#6ee7b7;">Today's Secret Word</div>
            <div style="font-size:1.45rem;font-weight:900;">${p.secretWord}</div>
          </div>
          <div class="role-hint">Category: <strong>${p.category}</strong></div>
        </div>

        <p class="stage-sub" style="margin-bottom:0.85rem;">One of these 4 suspects did NOT know the secret word. Spot the clue that doesn't fit!</p>

        <div class="clue-board">${rows}</div>

        ${
          pickedIdx !== null
            ? `<div class="result-card" style="text-align:left;">
                 <h3 style="margin:0 0 0.4rem;">${won ? '🎉 Spot On! You Caught the Daily Imposter!' : '😅 Close! That Suspect Was Innocent.'}</h3>
                 <p style="margin:0;color:var(--text-muted);"><strong>Why ${imp.name} was the Imposter:</strong> ${imp.reason}</p>
               </div>
               <div style="display:flex;gap:0.65rem;justify-content:center;flex-wrap:wrap;">
                 <button type="button" class="btn btn-primary" id="btn-daily-share">📋 Copy Share Result</button>
                 <button type="button" class="btn btn-secondary" id="btn-daily-bonus">🎲 Play Bonus Puzzle</button>
               </div>`
            : ''
        }
      </div>
    `;

    document.querySelectorAll('[data-daily-pick]').forEach((btn) => {
      btn.onclick = () => {
        pickedIdx = Number(btn.dataset.dailyPick);
        const correct = p.suspects[pickedIdx].isImposter;
        if (!isPractice && stats.lastDay !== todayStr) {
          stats.played += 1;
          if (correct) {
            stats.wins += 1;
            stats.streak += 1;
          } else {
            stats.streak = 0;
          }
          stats.lastDay = todayStr;
          saveStats(stats);
        }
        render();
      };
    });

    const shareBtn = document.getElementById('btn-daily-share');
    if (shareBtn) {
      shareBtn.onclick = () => {
        const grid = p.suspects.map((s, i) => (s.isImposter ? '🟥' : i === pickedIdx ? '❌' : '🟩')).join('');
        const text = `ImposterGameOnline.net Daily #${dayNumber} ${won ? '✅' : '❌'}\n${grid}\nStreak: ${stats.streak} 🔥\nPlay: https://impostergameonline.net/daily-imposter/`;
        navigator.clipboard?.writeText(text);
        shareBtn.textContent = '✅ Copied to Clipboard!';
        setTimeout(() => { shareBtn.textContent = '📋 Copy Share Result'; }, 1500);
      };
    }

    const bonusBtn = document.getElementById('btn-daily-bonus');
    if (bonusBtn) {
      bonusBtn.onclick = () => {
        activeOffset += 1;
        pickedIdx = null;
        render();
      };
    }
  }

  render();
})();
