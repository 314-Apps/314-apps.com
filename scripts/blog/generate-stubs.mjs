#!/usr/bin/env node
/**
 * Creates draft stub HTML for titles in blog-data/CONTENT-PLAN.md (section 3).
 * Skips files that already exist. Run: npm run blog:stubs
 */
import fs from 'node:fs';
import path from 'node:path';
import { BLOG_SOURCE, BLOG_DATA, escapeHtml } from './lib.mjs';
import { APP_STORE_URL } from './app-links.mjs';

const PLAN_PATH = path.join(BLOG_DATA, 'CONTENT-PLAN.md');
const plan = fs.readFileSync(PLAN_PATH, 'utf8');
const lines = plan.split('\n');

let cluster = null;
let created = 0;
let skipped = 0;

const itemRe = /^\d+\.\s+`([^`]+\.html)`\s+—\s+(.+)$/;
const headerRe = /^####\s+(.+?)\s+\(\d+\)\s*$/;

function stubHtml(title, clusterName) {
  const label = clusterName.replace(/-/g, ' ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <meta name="article-status" content="draft">
  <title>${escapeHtml(title)} — Inventr Blog</title>
  <meta name="description" content="Draft article — not yet published.">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../funnel-tools/css/styles.css">
</head>
<body data-article-status="draft">
  <header class="site-header">
    <div class="container">
      <a href="/blog/" class="logo">Inventr <span>Blog</span></a>
      <nav class="nav-links">
        <a href="/blog/">All Posts</a>
        <a href="/funnel-tools/">Free Tools</a>
        <a class="btn btn--primary btn--sm" href="${APP_STORE_URL}" target="_blank" rel="noopener">Try Inventr Free</a>
      </nav>
    </div>
  </header>
  <section class="hero hero--small">
    <div class="container">
      <p style="margin-bottom:0.5rem;opacity:0.8;">${escapeHtml(label)}</p>
      <h1>${escapeHtml(title)}</h1>
    </div>
  </section>
  <main>
    <div class="container article">
      <p><em>Draft stub — replace this body before publishing.</em></p>
    </div>
  </main>
  <footer class="site-footer">
    <div class="container"><p>&copy; 2026 Inventr</p></div>
  </footer>
</body>
</html>
`;
}

for (const line of lines) {
  const hm = line.match(headerRe);
  if (hm) {
    cluster = hm[1].trim();
    continue;
  }
  const im = line.match(itemRe);
  if (!im || !cluster) continue;

  const filename = im[1];
  const title = im[2].trim();
  const rel = `${cluster}/${filename}`;
  const dest = path.join(BLOG_SOURCE, rel);

  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, stubHtml(title, cluster));
  created++;
}

console.log(`Stubs: ${created} created, ${skipped} already existed.`);
