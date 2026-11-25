import fs from 'node:fs';
import path from 'node:path';

const dist = path.join(import.meta.dirname, 'dist');
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(dist);

let errors = 0;
const fail = (msg) => {
  console.error('FAIL:', msg);
  errors += 1;
};

let jsonLdCount = 0;
let linkCount = 0;

for (const file of htmlFiles) {
  const rel = path.relative(dist, file);
  const html = fs.readFileSync(file, 'utf8');
  if (!/<title>.+<\/title>/.test(html)) fail(`${rel} missing <title>`);
  if (!/meta name="description" content="[^"]+"/.test(html)) fail(`${rel} missing meta description`);
  if (!/link rel="canonical" href="https:\/\/impostergameonline\.net\//.test(html)) fail(`${rel} bad canonical`);
  if (!/property="og:image" content="https:\/\/impostergameonline\.net\/assets\/og-cover\.png"/.test(html)) fail(`${rel} missing og:image`);
  if (!/<h1>.+<\/h1>/.test(html)) fail(`${rel} missing <h1>`);
  if (html.includes('imposter-word-generator')) fail(`${rel} contains old slug imposter-word-generator`);

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    jsonLdCount += 1;
    try {
      JSON.parse(m[1]);
    } catch (e) {
      fail(`${rel} invalid JSON-LD: ${e.message}`);
    }
  }

  for (const m of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
    linkCount += 1;
    const target = m[1];
    let p = path.join(dist, target);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) fail(`${rel} broken internal link: ${target}`);
  }
}

const required = [
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
  'assets/og-cover.png',
  'assets/favicon.svg',
  'assets/manifest.webmanifest',
  'assets/styles.css',
  'assets/ui.js',
  'assets/game.js',
  'assets/question-game.js',
  'assets/ranking-game.js',
  'assets/daily-game.js',
  'assets/generator.js'
];
for (const req of required) {
  const p = path.join(dist, req);
  if (!fs.existsSync(p) || fs.statSync(p).size === 0) fail(`Missing or empty: ${req}`);
}

const sm = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  const slug = loc.replace('https://impostergameonline.net', '');
  const p = path.join(dist, slug, 'index.html');
  if (!fs.existsSync(p)) fail(`Sitemap URL missing file: ${loc}`);
}

console.log(`AUDIT PASS CHECK: ${htmlFiles.length} HTML pages | ${locs.length} Sitemap URLs | ${jsonLdCount} JSON-LD blocks | ${linkCount} internal links | Errors: ${errors}`);
process.exit(errors ? 1 : 0);
