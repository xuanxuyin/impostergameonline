import fs from 'node:fs';
import path from 'node:path';
import { SITE, CATEGORIES } from './src/data/site.mjs';
import { BOT_PROFILES, SOLO_WORDS } from './src/data/botClues.mjs';
import { QUESTION_PAIRS, RANKING_PAIRS, DAILY_PUZZLES } from './src/data/extraGames.mjs';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const ASSETS_SRC = path.join(ROOT, 'src', 'assets');
const ASSETS_DIST = path.join(DIST, 'assets');
const OG_IMAGE_URL = `${SITE.url}/assets/og-cover.png`;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ICONS = {
  word: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  question: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  ranking: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  daily: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  generator: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.3" fill="#fff"/><circle cx="15.5" cy="8.5" r="1.3" fill="#fff"/><circle cx="12" cy="12" r="1.3" fill="#fff"/><circle cx="8.5" cy="15.5" r="1.3" fill="#fff"/><circle cx="15.5" cy="15.5" r="1.3" fill="#fff"/></svg>',
  school: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  kids: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  party: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
};

const ARCADE_CARDS = [
  {
    href: '#play-now',
    title: 'Imposter Word Game',
    pill: '1–12 Players',
    desc: 'Classic secret-word bluffing with Solo vs AI Bots & Pass-and-Play.',
    color: 'card-rose',
    icon: ICONS.word,
    tags: '1p,3p'
  },
  {
    href: '/question-imposter/',
    title: 'Imposter Question Game',
    pill: '3–10 Players',
    desc: 'Everyone answers a secret question — except the Imposter gets a twisted one!',
    color: 'card-indigo',
    icon: ICONS.question,
    tags: '3p'
  },
  {
    href: '/ranking-imposter/',
    title: 'Ranking Imposter (1–10)',
    pill: '3–10 Players',
    desc: 'Pick a secret 1–10 score and spot whose number makes zero sense.',
    color: 'card-emerald',
    icon: ICONS.ranking,
    tags: '3p'
  },
  {
    href: '/daily-imposter/',
    title: 'Daily Imposter Puzzle',
    pill: '1 Player • Daily',
    desc: 'One new mystery every day! Spot the suspect clue & build your streak.',
    color: 'card-amber',
    icon: ICONS.daily,
    tags: '1p,daily'
  },
  {
    href: '/imposter-game-words/',
    title: 'Imposter Game Words',
    pill: '300+ Free Words',
    desc: 'Browse 300+ free imposter words & hints across 12 packs — zero app-locked packs.',
    color: 'card-violet',
    icon: ICONS.generator,
    tags: '1p,daily'
  },
  {
    href: '/imposter-game-unblocked/',
    title: 'Imposter Game Unblocked',
    pill: 'Chromebook Ready',
    desc: 'Ultra-lightweight HTML5 edition with built-in School & Campus pack.',
    color: 'card-sky',
    icon: ICONS.school,
    tags: '1p,3p'
  },
  {
    href: '/kids-edition/',
    title: 'Kids & Family Edition',
    pill: 'Ages 6+',
    desc: '100% clean, easy-to-guess words for family nights & classrooms.',
    color: 'card-teal',
    icon: ICONS.kids,
    tags: '1p,3p'
  },
  {
    href: '/party-edition/',
    title: 'Imposter Party Game',
    pill: 'Pop Culture',
    desc: 'Celebrities, movies, and US cities packs for chaotic group nights.',
    color: 'card-fuchsia',
    icon: ICONS.party,
    tags: '3p'
  }
];

function buildBreadcrumbSchema(slug, pageName) {
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` }
  ];
  if (slug) {
    items.push({ '@type': 'ListItem', position: 2, name: pageName, item: `${SITE.url}/${slug}/` });
  }
  return { '@type': 'BreadcrumbList', itemListElement: items };
}

function buildGamePageSchema(slug, name, description) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name,
        url: `${SITE.url}/${slug}/`,
        image: OG_IMAGE_URL,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description
      },
      buildBreadcrumbSchema(slug, name)
    ]
  };
}

function layout({
  slug,
  title,
  description,
  bodyHtml,
  includeGame = false,
  includeGenerator = false,
  extraScript = null,
  schemaJson = null
}) {
  const canonical = slug === '' ? `${SITE.url}/` : `${SITE.url}/${slug}/`;
  const navItems = [
    { href: '/', label: 'All Games', key: '' },
    { href: '/online/', label: 'Online', key: 'online' },
    { href: '/daily-imposter/', label: 'Daily Puzzle', key: 'daily-imposter' },
    { href: '/question-imposter/', label: 'Questions', key: 'question-imposter' },
    { href: '/ranking-imposter/', label: 'Ranking', key: 'ranking-imposter' },
    { href: '/imposter-game-words/', label: 'Word List', key: 'imposter-game-words' },
    { href: '/imposter-game-unblocked/', label: 'Unblocked', key: 'imposter-game-unblocked' }
  ];

  const navHtml = navItems
    .map(
      (item) =>
        `<a href="${item.href}" class="${item.key === slug ? 'active' : ''}">${item.label}</a>`
    )
    .join('');

  const dataScript =
    includeGame || includeGenerator
      ? `<script>window.IMPOSTER_DATA = ${JSON.stringify({ categories: CATEGORIES, bots: BOT_PROFILES, soloWords: SOLO_WORDS })};</script>`
      : '';

  const extraDataScript = extraScript
    ? `<script>window.IMPOSTER_EXTRA = ${JSON.stringify({ questionPairs: QUESTION_PAIRS, rankingPairs: RANKING_PAIRS, dailyPuzzles: DAILY_PUZZLES })};</script>`
    : '';

  const scripts = [
    `<script src="/assets/ui.js"></script>`,
    dataScript,
    extraDataScript,
    includeGame ? `<script src="/assets/game.js" defer></script>` : '',
    includeGenerator ? `<script src="/assets/generator.js" defer></script>` : '',
    extraScript ? `<script src="/assets/${extraScript}" defer></script>` : ''
  ]
    .filter(Boolean)
    .join('\n  ');

  const schemaScript = schemaJson
    ? `<script type="application/ld+json">${JSON.stringify(schemaJson)}</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="#ffffff" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="apple-touch-icon" href="/assets/favicon.svg" />
  <link rel="manifest" href="/assets/manifest.webmanifest" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(SITE.name)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${OG_IMAGE_URL}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${OG_IMAGE_URL}" />
  <link rel="stylesheet" href="/assets/styles.css" />
  <script defer src="https://www.pvuv.ai/f.js" data-site="gLYtLpxc" data-api="https://in.pvuv.ai"></script>
  ${schemaScript}
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/">
        <img src="/assets/favicon.svg" alt="${escapeHtml(SITE.name)} logo" width="34" height="34" />
        <span><em>Imposter</em> Game Online</span>
      </a>
      <div class="header-right">
        <nav class="main-nav" id="main-nav" aria-label="Main navigation">
          ${navHtml}
        </nav>
        <button type="button" class="theme-btn" id="theme-toggle" title="Toggle Light/Dark Mode"></button>
        <button type="button" class="menu-btn" id="menu-toggle" aria-label="Toggle Menu" aria-expanded="false">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  </header>

  <main class="container">
    ${bodyHtml}
  </main>

  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-copy">
        &copy; ${SITE.year} ${escapeHtml(SITE.name)} (${SITE.domain}). Free browser party games — no download required.
      </div>
      <div class="footer-links">
        <a href="/about/">About Us</a>
        <a href="/privacy-policy/">Privacy Policy</a>
        <a href="/terms-of-use/">Terms of Use</a>
        <a href="/contact/">Contact</a>
      </div>
    </div>
  </footer>
  ${scripts}
</body>
</html>`;
}

function gameAppContainer(defaultCategory = 'everyday-food', defaultMode = '') {
  return `<section class="game-shell" id="imposter-game-app" data-default-category="${defaultCategory}"${defaultMode ? ` data-default-mode="${defaultMode}"` : ''} aria-label="Imposter Game">
    <noscript>Please enable JavaScript to play Imposter Game Online.</noscript>
  </section>`;
}

function arcadeHubGrid() {
  return `
    <section class="hub-section" id="games">
      <div class="hub-header">
        <h2>Choose Your Imposter Game Mode</h2>
        <div class="filter-pills">
          <button type="button" class="filter-pill active" data-hub-filter="all">All Modes (8)</button>
          <button type="button" class="filter-pill" data-hub-filter="1p">1 Player / Solo</button>
          <button type="button" class="filter-pill" data-hub-filter="3p">3+ Players Party</button>
          <button type="button" class="filter-pill" data-hub-filter="daily">Daily &amp; Words</button>
        </div>
      </div>
      <div class="arcade-grid">
        ${ARCADE_CARDS.map(
          (c) => `
          <a class="arcade-card ${c.color}" href="${c.href}" data-game-tags="${c.tags}">
            <div class="arcade-card-top">
              <div class="arcade-icon-wrap">${c.icon}</div>
              <span class="arcade-pill">${c.pill}</span>
            </div>
            <div>
              <h3>${c.title}</h3>
              <p>${c.desc}</p>
            </div>
          </a>
        `
        ).join('')}
      </div>
    </section>
  `;
}

function editionCrossLinks(currentSlug) {
  const editions = [
    { slug: '', href: '/', title: 'Imposter Word Game (Solo & Party)', desc: 'Classic secret-word bluffing with AI Bots & Pass-and-Play.' },
    { slug: 'question-imposter', href: '/question-imposter/', title: 'Imposter Question Game', desc: 'Answer secret questions and expose who got the fake prompt.' },
    { slug: 'ranking-imposter', href: '/ranking-imposter/', title: 'Ranking Imposter (1–10)', desc: 'Secret 1–10 scale party game with hilarious score reveals.' },
    { slug: 'daily-imposter', href: '/daily-imposter/', title: 'Daily Imposter Puzzle', desc: 'One fresh deduction mystery every day with streak tracking.' },
    { slug: 'imposter-game-words', href: '/imposter-game-words/', title: 'Imposter Game Words (300+)', desc: 'Browse 300+ free imposter words & hints across 12 packs.' },
    { slug: 'imposter-game-unblocked', href: '/imposter-game-unblocked/', title: 'Imposter Game Unblocked', desc: 'Fast HTML5 edition built for Chromebooks and study hall.' }
  ].filter((e) => e.slug !== currentSlug);

  return `
    <section class="content-section">
      <h2>More Free Imposter Games</h2>
      <div class="edition-links">
        ${editions
          .map(
            (e) => `<a class="edition-card" href="${e.href}">
              <strong>${e.title}</strong>
              <span>${e.desc}</span>
            </a>`
          )
          .join('')}
      </div>
    </section>
  `;
}

const HOME_FAQS = [
  {
    q: 'What is Imposter Game Online?',
    a: 'Imposter Game Online (ImposterGameOnline.net) is a free browser-based social deduction word game where innocent players share a secret word or prompt while one hidden Imposter must bluff and blend in without getting caught.'
  },
  {
    q: 'Can I play Imposter Game Online by myself (1 player)?',
    a: 'Yes! You can play our Solo vs AI Bots mode immediately or solve today\'s Daily Imposter Puzzle — no extra players needed.'
  },
  {
    q: 'What Imposter game modes are included?',
    a: 'You can play Imposter Word Game (Solo vs AI + Pass & Play), Imposter Question Game, Ranking Imposter (1–10 Scale), Daily Imposter Puzzle, and use our 200+ Imposter Game Words Generator.'
  },
  {
    q: 'Can I play Imposter Game Unblocked at school on a Chromebook?',
    a: 'Yes. Every game runs in lightweight native HTML5 with zero downloads, zero Unity plugins, and instant loading on school Chromebooks and mobile browsers.'
  },
  {
    q: 'Where can I find free Imposter Game words?',
    a: 'Visit our Imposter Game Words page (/imposter-game-words/) to roll random secret words and Imposter hints or browse 300+ curated words across 12 free categories — with zero app-only locked packs.'
  }
];

const PAGES = [
  {
    slug: '',
    title: 'Imposter Game Online — Free Imposter Word Game (Play Now)',
    description:
      'Play Imposter Game Online for free in your browser! Includes Imposter Word Game (Solo vs AI Bots & Pass-and-Play), Imposter Question Game, Ranking 1–10, Daily Puzzle & 200+ Imposter Words.',
    includeGame: true,
    schemaJson: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebApplication',
          name: 'Imposter Game Online',
          alternateName: 'Imposter Word Game',
          url: `${SITE.url}/`,
          image: OG_IMAGE_URL,
          applicationCategory: 'GameApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          description:
            'Free browser-based Imposter Word Game and social deduction party arcade with Solo vs AI Bots, Pass & Play, Question Imposter, Ranking Imposter, and Daily Puzzle.'
        },
        {
          '@type': 'FAQPage',
          mainEntity: HOME_FAQS.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a }
          }))
        }
      ]
    },
    bodyHtml: `
      <div id="play-now"></div>
      ${gameAppContainer('everyday-food')}

      <section class="hero hero-compact">
        <div class="badge">Online Multiplayer • Pass Phone • Solo vs AI</div>
        <h1>Imposter Game Online — Free Imposter Word Game</h1>
        <p>Find the Imposter — or fool everyone trying. Create a private or public online room with a 6-digit code, pass one phone with friends, or play solo against AI bots right in your browser.</p>
      </section>

      ${arcadeHubGrid()}

      <section class="content-section">
        <h2>Compare All Imposter Game Modes</h2>
        <p><strong>ImposterGameOnline.net</strong> offers five ways to play the classic Imposter deduction game free online with zero downloads or sign-ups:</p>
        <div class="table-wrap">
          <table class="geo-table">
            <thead>
              <tr>
                <th>Game Mode</th>
                <th>Players</th>
                <th>Best For</th>
                <th>How It Plays</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Online Multiplayer Rooms</strong></td>
                <td data-label="Players">3–10 (+ AI Bots)</td>
                <td data-label="Best For">Remote friends &amp; quick match</td>
                <td data-label="How It Plays">Join via 6-digit room code or public lobby, receive private server cards, submit 1-word clues, and vote live.</td>
              </tr>
              <tr>
                <td><strong>Imposter Word Game</strong></td>
                <td data-label="Players">1 (vs AI) or 3–12</td>
                <td data-label="Best For">Anytime solo or party play</td>
                <td data-label="How It Plays">Give 1-word clues about a secret word and vote out the clueless Imposter.</td>
              </tr>
              <tr>
                <td><strong>Imposter Question Game</strong></td>
                <td data-label="Players">3–10</td>
                <td data-label="Best For">Laugh-out-loud group nights</td>
                <td data-label="How It Plays">Everyone answers a secret question while the Imposter answers a twisted version.</td>
              </tr>
              <tr>
                <td><strong>Ranking Imposter (1–10)</strong></td>
                <td data-label="Players">3–10</td>
                <td data-label="Best For">Fast 2-minute debates</td>
                <td data-label="How It Plays">Rate a secret prompt from 1–10 and spot whose score doesn't match the group.</td>
              </tr>
              <tr>
                <td><strong>Daily Imposter Puzzle</strong></td>
                <td data-label="Players">1 Player</td>
                <td data-label="Best For">Daily streak &amp; brain warm-up</td>
                <td data-label="How It Plays">Read 4 suspects' clues for today's secret word and accuse the bluffing Imposter.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="content-section">
        <h2>How to Play Imposter Word Game Online</h2>
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-num">1</div>
            <h3>Choose Solo or Party</h3>
            <p>Play solo immediately against 2–5 AI bots, or switch to Pass &amp; Play for 3–12 friends sharing one phone or Chromebook.</p>
          </div>
          <div class="step-card">
            <div class="step-num">2</div>
            <h3>Check Your Secret Card</h3>
            <p>Innocent players see the secret word (such as <em>Pizza</em>). The Imposter sees only an optional category hint and must blend in.</p>
          </div>
          <div class="step-card">
            <div class="step-num">3</div>
            <h3>Drop One-Word Clues</h3>
            <p>Each player gives one clue word that proves they know the secret word without giving it away to the Imposter.</p>
          </div>
          <div class="step-card">
            <div class="step-num">4</div>
            <h3>Vote &amp; Eject</h3>
            <p>Expose the faker in the final vote — if caught, the Imposter gets one last chance to guess the secret word and steal the round!</p>
          </div>
        </div>
      </section>

      <section class="content-section">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-list">
          ${HOME_FAQS.map(
            (f) => `<details>
              <summary>${escapeHtml(f.q)}</summary>
              <p>${escapeHtml(f.a)}</p>
            </details>`
          ).join('')}
        </div>
      </section>
    `
  },
  {
    slug: 'online',
    title: 'Play Imposter Game Online Multiplayer — Public & Private Rooms',
    description:
      'Play Imposter Game Online Multiplayer with friends or strangers! Create a 6-digit private room, join open public lobbies, add AI bots, and catch the Imposter live in your browser.',
    includeGame: true,
    schemaJson: buildGamePageSchema(
      'online',
      'Imposter Game Online Multiplayer',
      'Live browser multiplayer Imposter Word Game with 6-digit private rooms, public lobbies, AI bot backfill, and Imposter last-chance guess.'
    ),
    bodyHtml: `
      <div id="play-now"></div>
      ${gameAppContainer('everyday-food', 'online')}

      <section class="hero hero-compact">
        <div class="badge">Live Multiplayer • 6-Digit Room Codes • 12 Free Packs</div>
        <h1>Imposter Game Online Multiplayer</h1>
        <p>Create a private room with a 6-digit code, join an open public lobby, or fill empty seats with AI bots. Every word pack — including Brands, Anime, and Movies — is 100% free in your browser.</p>
      </section>

      <section class="content-section">
        <h2>How Online Multiplayer Rooms Work</h2>
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-num">1</div>
            <h3>Create or Join a Room</h3>
            <p>Tap <strong>Create Room</strong> for a private 6-digit invite link or join any open Public Lobby instantly.</p>
          </div>
          <div class="step-card">
            <div class="step-num">2</div>
            <h3>Private Server Cards</h3>
            <p>Each player's role is sent privately from our Cloudflare server — the Imposter never receives the secret word.</p>
          </div>
          <div class="step-card">
            <div class="step-num">3</div>
            <h3>Turn-Based Clues &amp; Vote</h3>
            <p>Submit one-word clues in turn order (or talk on Discord), then cast anonymous votes to eject the suspect.</p>
          </div>
          <div class="step-card">
            <div class="step-num">4</div>
            <h3>Last-Chance Word Steal</h3>
            <p>When Last-Chance Guess is enabled, a caught Imposter gets one 4-choice shot to guess the secret word and steal the win!</p>
          </div>
        </div>
      </section>

      ${editionCrossLinks('online')}
    `
  },
  {
    slug: 'question-imposter',
    title: 'Imposter Question Game — Free Imposter Questions Online',
    description:
      'Play Imposter Question Game online for free! Everyone answers a secret question while the Imposter gets a slightly different prompt. Compare answers and expose the faker.',
    extraScript: 'question-game.js',
    schemaJson: buildGamePageSchema(
      'question-imposter',
      'Imposter Question Game',
      'Free browser-based Imposter Question Game where players answer secret prompts and vote out the player who received a twisted question.'
    ),
    bodyHtml: `
      <section class="hero">
        <div class="badge">3–10 Players • Pass &amp; Play</div>
        <h1>Imposter Question Game</h1>
        <p>Everyone secretly answers a question — except the Imposter gets a slightly twisted version. When all answers appear side-by-side, spot who answered the fake question!</p>
      </section>
      <section class="game-shell" id="question-imposter-app"></section>
      <section class="content-section">
        <h2>How Imposter Question Game Works</h2>
        <p>Imposter Question Game is a hilarious twist on classic social deduction. Innocent players might answer <em>"What animal would be the funniest pet?"</em> while the Imposter secretly answers <em>"What animal are you most terrified of?"</em>. Once every answer is revealed under the Crew's true question, the Imposter has to defend their bizarre answer!</p>
      </section>
      ${editionCrossLinks('question-imposter')}
    `
  },
  {
    slug: 'ranking-imposter',
    title: 'Ranking Imposter Game — Free 1 to 10 Secret Scale Party Game',
    description:
      'Play Ranking Imposter (1–10 Scale) online for free! Rate a secret topic from 1 to 10 while the Imposter rates a different topic. Debate the numbers and expose the Imposter.',
    extraScript: 'ranking-game.js',
    schemaJson: buildGamePageSchema(
      'ranking-imposter',
      'Ranking Imposter Game',
      'Free online 1-to-10 Ranking Imposter party game where players lock in secret scores and hunt down the Imposter.'
    ),
    bodyHtml: `
      <section class="hero">
        <div class="badge">3–10 Players • 1–10 Secret Scale</div>
        <h1>Ranking Imposter Game</h1>
        <p>Everyone locks in a secret score from 1 to 10. The catch? The Imposter is rating a completely different prompt. Reveal the numbers and interrogate anyone who looks suspicious!</p>
      </section>
      <section class="game-shell" id="ranking-imposter-app"></section>
      <section class="content-section">
        <h2>Why Ranking Imposter Gets Hilarious Fast</h2>
        <p>When the Crew's prompt is <em>"Rate how much you love Pizza"</em> and someone proudly locks in a <strong>2 / 10</strong> because their secret prompt was about Broccoli, the entire room immediately erupts into interrogation mode.</p>
      </section>
      ${editionCrossLinks('ranking-imposter')}
    `
  },
  {
    slug: 'daily-imposter',
    title: 'Daily Imposter Puzzle — Free Daily Deduction Game Online',
    description:
      'Play today\'s Daily Imposter Puzzle! Four suspects give a one-word clue for the secret word — find the one Imposter who is bluffing, track your streak, and share your result.',
    extraScript: 'daily-game.js',
    schemaJson: buildGamePageSchema(
      'daily-imposter',
      'Daily Imposter Puzzle',
      'Free daily single-player Imposter deduction puzzle with streak tracking and spoiler-free result sharing.'
    ),
    bodyHtml: `
      <section class="hero">
        <div class="badge">1 Player • Resets Daily UTC • Streak Tracker</div>
        <h1>Daily Imposter Puzzle</h1>
        <p>Four suspects, four one-word clues, one clueless Imposter. Read carefully, accuse the faker, keep your daily streak alive, and copy your spoiler-free result card.</p>
      </section>
      <section class="game-shell" id="daily-imposter-app"></section>
      <section class="content-section">
        <h2>How the Daily Imposter Challenge Works</h2>
        <p>A new Daily Imposter puzzle unlocks every day at midnight UTC. You are shown the secret word and four suspects' clues. Three suspects know the word, while one Imposter only guessed from the broad category. Spot the clue that doesn't belong!</p>
      </section>
      ${editionCrossLinks('daily-imposter')}
    `
  },
  {
    slug: 'imposter-game-unblocked',
    title: 'Imposter Game Unblocked — Play Free Online at School',
    description:
      'Play Imposter Game Unblocked instantly on school Chromebooks, tablets, and office PCs. Lightweight HTML5 Imposter Word Game with Solo AI and School & Campus word pack.',
    includeGame: true,
    schemaJson: buildGamePageSchema(
      'imposter-game-unblocked',
      'Imposter Game Unblocked',
      'Play Imposter Game Unblocked in lightweight native HTML5 on school Chromebooks with Solo AI bots and School & Campus words.'
    ),
    bodyHtml: `
      <section class="hero">
        <div class="badge">School &amp; Chromebook Ready • Instant Load</div>
        <h1>Imposter Game Unblocked</h1>
        <p>Built with pure lightweight HTML5 for instant loading on school Wi-Fi, Chromebooks, and restricted networks — zero downloads, Solo AI Bots, and a built-in School &amp; Campus word pack.</p>
      </section>
      ${gameAppContainer('school-campus')}
      <section class="content-section">
        <h2>Why Imposter Game Unblocked Works Great in Class &amp; Study Hall</h2>
        <p>Unlike heavy Unity WebGL games that lag on school Chromebooks, <strong>ImposterGameOnline.net</strong> runs directly in your browser using pure JavaScript and CSS. Play Solo vs AI Bots quietly with sound muted, or pass a laptop around during study hall.</p>
      </section>
      ${editionCrossLinks('imposter-game-unblocked')}
    `
  },
  {
    slug: 'imposter-game-words',
    title: 'Imposter Game Words — 200+ Free Imposter Words & Word Generator',
    description:
      'Browse 200+ free Imposter Game words and hints or use our random Imposter word generator across 8 categories: Food, Movies, US Cities, Animals, School, Sports, and Kids.',
    includeGenerator: true,
    schemaJson: buildGamePageSchema(
      'imposter-game-words',
      'Imposter Game Words & Word Generator',
      'Free list of 200+ curated Imposter Game words with hints plus an interactive random Imposter word generator.'
    ),
    bodyHtml: `
      <section class="hero">
        <div class="badge">300+ Curated Imposter Words &amp; Hints</div>
        <h1>Imposter Game Words &amp; Free Word Generator</h1>
        <p>Need fresh secret words for your tabletop, Discord, or in-person Imposter game? Roll a random word with a matching Imposter hint or browse all 300+ Imposter words across 12 themed packs below.</p>
      </section>
      <div id="word-generator-app"></div>
      <section class="content-section">
        <h2>Complete List of 300+ Imposter Game Words by Category</h2>
        ${CATEGORIES.map(
          (cat) => `
          <h3>${cat.emoji} ${escapeHtml(cat.name)} (${cat.words.length} Words)</h3>
          <p>${escapeHtml(cat.description)}</p>
          <div class="word-tags">
            ${cat.words.map((w) => `<span class="word-tag">${escapeHtml(w.word)}</span>`).join('')}
          </div>
        `
        ).join('')}
      </section>
      ${editionCrossLinks('imposter-game-words')}
    `
  },
  {
    slug: 'kids-edition',
    title: 'Imposter Game Kids Edition — Family & Classroom Word Game',
    description:
      'Play a 100% clean, family-friendly Imposter word game for kids! Features simple everyday words like Dinosaur, Unicorn, Rainbow, and Superhero for ages 6+.',
    includeGame: true,
    schemaJson: buildGamePageSchema(
      'kids-edition',
      'Imposter Game Kids Edition',
      'Clean, family-friendly Imposter word game designed for kids, family game nights, and classrooms.'
    ),
    bodyHtml: `
      <section class="hero">
        <div class="badge">100% Clean &amp; Kid-Friendly • Ages 6+</div>
        <h1>Imposter Game — Kids Edition</h1>
        <p>Pre-loaded with our <strong>Kids Friendly</strong> word pack featuring fun, familiar words like Dinosaur, Superhero, Rainbow, and Treehouse. Great for family game nights and classrooms.</p>
      </section>
      ${gameAppContainer('kids-friendly')}
      ${editionCrossLinks('kids-edition')}
    `
  },
  {
    slug: 'party-edition',
    title: 'Imposter Party Game — Play Online with Friends & Pop Culture Packs',
    description:
      'Turn any hangout into a hilarious bluffing battle with Imposter Party Game! Packed with Pop Culture, Celebrities, Movies, and US Cities word packs for 4–12 friends.',
    includeGame: true,
    schemaJson: buildGamePageSchema(
      'party-edition',
      'Imposter Party Game',
      'Play Imposter Party Game online with friends using Pop Culture, Celebrities, Movies, and US Cities word packs.'
    ),
    bodyHtml: `
      <section class="hero">
        <div class="badge">Best for 5–12 Friends • Party Night</div>
        <h1>Imposter Party Game</h1>
        <p>Pre-loaded with our <strong>Pop Culture &amp; Celebrities</strong> pack. Add 2 Imposters for groups of 7+ players and turn off Imposter Hints for maximum chaos.</p>
      </section>
      ${gameAppContainer('pop-culture')}
      ${editionCrossLinks('party-edition')}
    `
  },
  {
    slug: 'about',
    title: 'About Us — Imposter Game Online',
    description: 'Learn about ImposterGameOnline.net, our mission to build fast, free, zero-download browser party games for friends, families, and classrooms.',
    bodyHtml: `
      <section class="hero">
        <h1>About Imposter Game Online</h1>
        <p>Fast, clean, browser-first party games anyone can play in seconds.</p>
      </section>
      <section class="content-section">
        <h2>Our Mission</h2>
        <p><strong>ImposterGameOnline.net</strong> makes classic social deduction party games effortless to play anywhere — solo against AI bots or with friends around one screen, with zero downloads and zero accounts.</p>
      </section>
    `
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy — Imposter Game Online',
    description: 'Privacy Policy for ImposterGameOnline.net covering local gameplay data, cookies, analytics, and third-party advertising partners.',
    bodyHtml: `
      <section class="hero">
        <h1>Privacy Policy</h1>
        <p>Last updated: November 2026</p>
      </section>
      <section class="content-section">
        <h2>1. Information We Collect</h2>
        <p>ImposterGameOnline.net does not require user registration or logins. Player names, scores, daily streaks, and custom words stay locally inside your browser.</p>
        <h2>2. Cookies &amp; Third-Party Advertising</h2>
        <p>We may use third-party advertising networks (such as Google AdSense) and analytics to keep our games free. Third-party vendors, including Google, use cookies to serve ads based on prior visits. You may opt out at <a href="https://www.google.com/settings/ads" rel="noopener noreferrer" target="_blank">Google Ads Settings</a>.</p>
        <h2>3. Contact</h2>
        <p>Questions? Email <a href="mailto:${SITE.email}">${SITE.email}</a>.</p>
      </section>
    `
  },
  {
    slug: 'terms-of-use',
    title: 'Terms of Use — Imposter Game Online',
    description: 'Terms of Use and disclaimer for playing free browser games on ImposterGameOnline.net.',
    bodyHtml: `
      <section class="hero">
        <h1>Terms of Use</h1>
        <p>Last updated: November 2026</p>
      </section>
      <section class="content-section">
        <h2>1. Acceptance of Terms</h2>
        <p>By playing on <strong>ImposterGameOnline.net</strong>, you agree to use these free browser games for personal, classroom, and non-commercial entertainment.</p>
        <h2>2. Independent Implementation</h2>
        <p>ImposterGameOnline.net is an independent, original browser implementation of classic social deduction party games and is not affiliated with any third-party publisher.</p>
      </section>
    `
  },
  {
    slug: 'contact',
    title: 'Contact Us — Imposter Game Online',
    description: 'Contact ImposterGameOnline.net for word pack suggestions, bug reports, or copyright inquiries.',
    bodyHtml: `
      <section class="hero">
        <h1>Contact Us</h1>
        <p>Have a word pack idea, bug report, or feedback? Reach out anytime.</p>
      </section>
      <section class="content-section">
        <h2>Get in Touch</h2>
        <p style="font-size:1.15rem;"><strong>Email:</strong> <a href="mailto:${SITE.email}">${SITE.email}</a></p>
      </section>
    `
  }
];

function build() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
  ensureDir(ASSETS_DIST);

  for (const file of fs.readdirSync(ASSETS_SRC)) {
    fs.copyFileSync(path.join(ASSETS_SRC, file), path.join(ASSETS_DIST, file));
  }

  const urls = [];
  for (const page of PAGES) {
    const html = layout(page);
    const outDir = page.slug ? path.join(DIST, page.slug) : DIST;
    ensureDir(outDir);
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    urls.push(page.slug ? `${SITE.url}/${page.slug}/` : `${SITE.url}/`);
  }

  // Sitemap
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u, idx) => `  <url>
    <loc>${u}</loc>
    <lastmod>${today}</lastmod>
    <priority>${idx === 0 ? '1.0' : idx <= 8 ? '0.9' : '0.4'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8');

  // Robots.txt (explicitly welcomes traditional + AI search crawlers for SEO & GEO)
  const robots = `User-agent: *
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: ${SITE.url}/sitemap.xml
`;
  fs.writeFileSync(path.join(DIST, 'robots.txt'), robots, 'utf8');

  // GEO: llms.txt for AI search engines (ChatGPT Search, Perplexity, Google AI Overview)
  const llmsTxt = `# Imposter Game Online (${SITE.domain})

> Free browser-based Imposter Word Game and social deduction party arcade. Play solo against AI bots, solve today's Daily Imposter Puzzle, or play Pass & Play with 3–12 friends with zero downloads or sign-ups.

## Core Game Modes
- [Imposter Game Online — Word Imposter](${SITE.url}/): Classic secret-word social deduction game featuring Online Multiplayer (6-digit rooms & public lobbies), Pass & Play (with Undercover mode), Solo vs AI Bots, and 300+ free words across 12 packs (no app-locked packs).
- [Imposter Game Online Multiplayer](${SITE.url}/online/): Dedicated multiplayer lobby page to create private 6-digit rooms, join public lobbies, add AI bots, and play with Imposter Last-Chance Guess.
- [Imposter Question Game](${SITE.url}/question-imposter/): Pass-and-play party game where innocent players answer a secret question while the Imposter answers a subtly twisted question.
- [Ranking Imposter (1–10 Scale)](${SITE.url}/ranking-imposter/): Secret 1-to-10 rating game where the Imposter rates a different topic and tries to blend in.
- [Daily Imposter Puzzle](${SITE.url}/daily-imposter/): Daily single-player deduction challenge with 4 suspects, streak tracking, and spoiler-free result sharing.
- [Imposter Game Words & Generator](${SITE.url}/imposter-game-words/): 300+ curated Imposter words and Imposter hints across 12 free categories (Food, Movies & TV, US Cities, Animals, School, Sports & Games, Pop Culture, Kids, Brands & Logos, Anime & Manga, Video Games, Internet & Memes).
- [Imposter Game Unblocked](${SITE.url}/imposter-game-unblocked/): Lightweight native HTML5 edition designed for instant loading on school Chromebooks and restricted networks.

## Key Facts
- Price: 100% Free
- Platforms: Mobile, Tablet, Chromebook, Desktop Web Browsers
- Account Required: No
- Downloads Required: No
`;
  fs.writeFileSync(path.join(DIST, 'llms.txt'), llmsTxt, 'utf8');

  console.log(`Built ${PAGES.length} pages + sitemap.xml + robots.txt + llms.txt into ${DIST}`);
}

build();
