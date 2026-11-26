(() => {
  // v2.0 defaults to clean iOS light theme; user can still toggle dark mode
  const savedTheme = localStorage.getItem('igo_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  function syncThemeBtn() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.innerHTML = isDark
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  document.addEventListener('DOMContentLoaded', () => {
    syncThemeBtn();
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('igo_theme', next);
        syncThemeBtn();
      });
    }

    // Mobile hamburger menu toggle
    const menuBtn = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');
    if (menuBtn && mainNav) {
      menuBtn.addEventListener('click', () => {
        const isOpen = mainNav.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', String(isOpen));
      });
      mainNav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
          mainNav.classList.remove('open');
          menuBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // Arcade hub player-count filters
    const filterBtns = document.querySelectorAll('[data-hub-filter]');
    const cards = document.querySelectorAll('[data-game-tags]');
    if (filterBtns.length && cards.length) {
      filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.hubFilter;
          filterBtns.forEach((b) => b.classList.toggle('active', b === btn));
          cards.forEach((card) => {
            const tags = (card.dataset.gameTags || '').split(',');
            card.classList.toggle('hidden', target !== 'all' && !tags.includes(target));
          });
        });
      });
    }
  });
})();
