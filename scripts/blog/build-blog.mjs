#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  BLOG_SOURCE,
  BLOG_OUT,
  CATALOG_PATH,
  SITE_BASE,
  SITE_HOME,
  SITE_STYLES,
  CLUSTER_SECTIONS,
  readPublished,
  readPublishedLastmod,
  escapeHtml,
} from './lib.mjs';
import { APP_STORE_URL } from './app-links.mjs';

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

function relatedGuidesHtml(relPath, catalog, published) {
  const current = catalog.articles.find((a) => a.path === relPath);
  if (!current) return '';

  const related = catalog.articles
    .filter(
      (a) =>
        published.has(a.path) &&
        a.path !== relPath &&
        a.cluster === current.cluster &&
        a.status === 'ready'
    )
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 3);

  if (related.length === 0) return '';

  const items = related
    .map(
      (a) =>
        `<li><a href="/blog/${escapeHtml(a.path)}">${escapeHtml(a.title)}</a></li>`
    )
    .join('\n');

  return `
  <section class="related-guides" aria-label="More guides">
    <div class="container">
      <h2>More ${escapeHtml(current.clusterLabel)} guides</h2>
      <ul class="related-guides__list">${items}
      </ul>
    </div>
  </section>`;
}

function injectRelatedGuides(html, relPath, catalog, published) {
  const block = relatedGuidesHtml(relPath, catalog, published);
  if (!block) return html;
  if (html.includes('class="related-guides"')) return html;

  const ctaIdx = html.indexOf('<section class="cta-banner">');
  if (ctaIdx !== -1) {
    return html.slice(0, ctaIdx) + block + '\n\n  ' + html.slice(ctaIdx);
  }

  const footerIdx = html.indexOf('<footer class="site-footer">');
  if (footerIdx !== -1) {
    return html.slice(0, footerIdx) + block + '\n\n  ' + html.slice(footerIdx);
  }

  return html;
}

function copyPublished(published, catalog) {
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
    let html = stripDraftNoindex(fs.readFileSync(src, 'utf8'));
    html = injectRelatedGuides(html, rel, catalog, published);
    fs.writeFileSync(dest, html);
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
  <title>Inventr — Reseller guides &amp; free tools</title>
  <meta name="description" content="Practical reselling guides, calculators, and checklists for booth sellers and consignment shops.">
  <link rel="canonical" href="${SITE_BASE}${SITE_HOME}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${SITE_STYLES}">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a href="${SITE_HOME}" class="logo">Inventr</a>
      <nav class="nav-links">
        <a href="${SITE_HOME}">Guides</a>
        <a href="/funnel-tools/">Free Tools</a>
        <a class="btn btn--primary btn--sm" href="${APP_STORE_URL}?utm_source=blog&amp;utm_medium=nav" target="_blank" rel="noopener">Try Inventr Free</a>
      </nav>
    </div>
  </header>
  <section class="hero">
    <div class="container">
      <h1>Reseller &amp; booth guides that show the math</h1>
      <p>Long-form playbooks for online platforms, local flips, and consignment operations — plus free calculators and checklists.</p>
      <p style="margin-top:1.25rem;display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center;">
        <a class="btn btn--white btn--lg" href="/funnel-tools/">Browse free tools</a>
        <a class="btn btn--outline btn--lg" href="#guides" style="border-color:rgba(255,255,255,0.5);color:#fff;">Jump to guides</a>
      </p>
    </div>
  </section>
  <main id="guides">
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
      <a class="btn btn--white btn--lg" href="${APP_STORE_URL}?utm_source=blog&amp;utm_medium=cta" target="_blank" rel="noopener">Try Inventr Free</a>
    </div>
  </section>
  <footer class="site-footer">
    <div class="container">
      <p>&copy; 2026 Inventr · <a href="https://314-apps.com">314 Apps</a> · <a href="/privacy-policy.html">Privacy</a> · <a href="/terms.html">Terms</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

function funnelToolUrls(lastmod) {
  const manifestPath = path.join(ROOT, 'funnel-tools/manifest.json');
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.map(
    (t) =>
      `<url><loc>${SITE_BASE}/funnel-tools/${t.slug}/</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.75</priority></url>`
  );
}

function buildSitemap(published, lastmod) {
  const urls = [
    `<url><loc>${SITE_BASE}${SITE_HOME}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${SITE_BASE}/funnel-tools/</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`,
    ...funnelToolUrls(lastmod),
    ...[...published].sort().map(
      (p) =>
        `<url><loc>${SITE_BASE}/blog/${p}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq></url>`
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
const lastmod = readPublishedLastmod();
copyPublished(published, catalog);
fs.writeFileSync(path.join(BLOG_OUT, 'index.html'), buildIndex(catalog, published));
fs.writeFileSync(path.join(ROOT, 'sitemap-blog.xml'), buildSitemap(published, lastmod));
console.log(`Built blog: ${published.size} published of ${catalog.count} in catalog.`);
