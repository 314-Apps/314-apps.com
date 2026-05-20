#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  BLOG_SOURCE,
  BLOG_OUT,
  CATALOG_PATH,
  SITE_BASE,
  CLUSTER_SECTIONS,
  readPublished,
  escapeHtml,
} from './lib.mjs';

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`Missing ${CATALOG_PATH}. Run: npm run blog:catalog`);
  }
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
}

function stripDraftNoindex(html) {
  return html
    .replace(/<meta\s+name="robots"\s+content="noindex[^"]*"\s*\/?>\s*/gi, '')
    .replace(/<meta\s+name="article-status"\s+content="draft"\s*\/?>\s*/gi, '')
    .replace(/\s*data-article-status="draft"/gi, '');
}

function copyPublished(published) {
  if (fs.existsSync(BLOG_OUT)) {
    fs.rmSync(BLOG_OUT, { recursive: true, force: true });
  }
  fs.mkdirSync(BLOG_OUT, { recursive: true });

  for (const rel of published) {
    const src = path.join(BLOG_SOURCE, rel);
    const dest = path.join(BLOG_OUT, rel);
    if (!fs.existsSync(src)) {
      console.warn(`Skip missing source: ${rel}`);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, stripDraftNoindex(fs.readFileSync(src, 'utf8')));
  }
}

function buildIndex(catalog, published) {
  const byPath = new Map(catalog.articles.map((a) => [a.path, a]));
  const publishedArticles = [...published]
    .map((p) => byPath.get(p))
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));

  const sectionsHtml = CLUSTER_SECTIONS.map((section) => {
    const cards = publishedArticles
      .filter((a) => section.clusters.includes(a.cluster))
      .map(
        (a) => `
          <a class="post-card" href="/blog/${escapeHtml(a.path)}">
            <p class="cluster">${escapeHtml(a.clusterLabel)}</p>
            <h3>${escapeHtml(a.title)}</h3>
            <p>${escapeHtml(a.description || '')}</p>
          </a>`
      )
      .join('\n');
    if (!cards.trim()) return '';
    return `
      <section id="${section.id}" class="cluster-section">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="post-grid">${cards}
        </div>
      </section>`;
  }).join('\n');

  const navChips = CLUSTER_SECTIONS.filter((s) =>
    publishedArticles.some((a) => s.clusters.includes(a.cluster))
  )
    .map((s) => `<a href="#${s.id}">${escapeHtml(s.title)}</a>`)
    .join('\n');

  const emptyMsg =
    publishedArticles.length === 0
      ? '<p class="placeholder-note">No articles published yet.</p>'
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inventr Blog — Guides for Resellers, Booth Sellers &amp; Consignment Shops</title>
  <meta name="description" content="Practical reselling guides for resellers and consignment sellers.">
  <link rel="canonical" href="${SITE_BASE}/blog/">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../funnel-tools/css/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a href="/blog/" class="logo">Inventr <span>Blog</span></a>
      <nav class="nav-links">
        <a href="/blog/">All Posts</a>
        <a href="/funnel-tools/">Free Tools</a>
        <a class="btn btn--primary btn--sm" href="https://inventrapp.com?utm_source=blog&amp;utm_medium=nav" target="_blank" rel="noopener">Try Inventr Free</a>
      </nav>
    </div>
  </header>
  <section class="hero">
    <div class="container">
      <h1>Reseller &amp; booth guides that show the math</h1>
      <p>Long-form playbooks for online platforms, local flips, and consignment operations.</p>
    </div>
  </section>
  <main>
    <div class="container">
      ${navChips ? `<nav class="category-nav" aria-label="Topics">${navChips}</nav>` : ''}
      ${emptyMsg}
      ${sectionsHtml}
    </div>
  </main>
  <section class="cta-banner">
    <div class="container">
      <h2>Track inventory and real profit in one app</h2>
      <p>Inventr is built for booth sellers and multi-channel resellers.</p>
      <a class="btn btn--white btn--lg" href="https://inventrapp.com?utm_source=blog&amp;utm_medium=cta" target="_blank" rel="noopener">Try Inventr Free</a>
    </div>
  </section>
  <footer class="site-footer">
    <div class="container">
      <p>&copy; 2026 Inventr · <a href="https://314-apps.com">314 Apps</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

function funnelToolUrls() {
  const manifestPath = path.join(ROOT, 'funnel-tools/manifest.json');
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.map(
    (t) =>
      `<url><loc>${SITE_BASE}/funnel-tools/${t.slug}/</loc><changefreq>monthly</changefreq><priority>0.75</priority></url>`
  );
}

function buildSitemap(published) {
  const urls = [
    `<url><loc>${SITE_BASE}/blog/</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`,
    `<url><loc>${SITE_BASE}/funnel-tools/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>`,
    ...funnelToolUrls(),
    ...[...published].sort().map(
      (p) => `<url><loc>${SITE_BASE}/blog/${p}</loc><changefreq>monthly</changefreq></url>`
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

const catalog = loadCatalog();
const published = readPublished();
copyPublished(published);
fs.writeFileSync(path.join(BLOG_OUT, 'index.html'), buildIndex(catalog, published));
fs.writeFileSync(path.join(ROOT, 'sitemap-blog.xml'), buildSitemap(published));
console.log(`Built blog: ${published.size} published of ${catalog.count} in catalog.`);
