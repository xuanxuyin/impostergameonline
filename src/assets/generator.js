(() => {
  const root = document.getElementById('word-generator-app');
  if (!root || !window.IMPOSTER_DATA) return;

  const categories = window.IMPOSTER_DATA.categories;
  let selectedCat = 'all';
  let current = null;

  function pickRandom() {
    const pool = [];
    categories.forEach((c) => {
      if (selectedCat === 'all' || selectedCat === c.id) {
        c.words.forEach((w) => pool.push({ ...w, category: c.name, emoji: c.emoji }));
      }
    });
    current = pool[Math.floor(Math.random() * pool.length)];
    render();
  }

  function render() {
    const options = `<option value="all" ${selectedCat === 'all' ? 'selected' : ''}>All Categories (200 Words)</option>` +
      categories.map((c) => `<option value="${c.id}" ${selectedCat === c.id ? 'selected' : ''}>${c.emoji} ${c.name}</option>`).join('');

    root.innerHTML = `
      <div class="game-shell">
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;">
          <div style="flex:1;min-width:200px;">
            <select id="gen-cat-select" aria-label="Select word category">${options}</select>
          </div>
          <button type="button" class="btn btn-primary" id="btn-gen-word">🎲 Generate Secret Word</button>
          <button type="button" class="btn btn-secondary" id="btn-copy-word">📋 Copy Word</button>
        </div>

        ${
          current
            ? `<div class="generator-result">
                 <div class="role-pill" style="background:var(--accent-soft);color:var(--accent);display:inline-block;">${current.emoji} ${current.category}</div>
                 <div class="secret-word" id="gen-secret-text">${current.word}</div>
                 <div class="mini-tag" style="background:var(--bg-elevated);color:var(--text);display:inline-block;padding:0.4rem 0.85rem;font-size:0.88rem;">Imposter Hint: <strong>${current.hint}</strong></div>
               </div>`
            : ''
        }
      </div>
    `;

    document.getElementById('gen-cat-select').onchange = (e) => {
      selectedCat = e.target.value;
      pickRandom();
    };
    document.getElementById('btn-gen-word').onclick = pickRandom;
    document.getElementById('btn-copy-word').onclick = () => {
      if (!current) return;
      navigator.clipboard?.writeText(`Secret Word: ${current.word} (Hint: ${current.hint})`);
      const btn = document.getElementById('btn-copy-word');
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy Word'; }, 1400);
    };
  }

  pickRandom();
})();
