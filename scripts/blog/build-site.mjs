#!/usr/bin/env node
/**
 * Assembles _site/ for consignment.314-apps.com (Inventr guides + tools only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT, SITE_BASE, SITE_HOME } from './lib.mjs';
import { injectPosthogSnippet } from './posthog-snippet.mjs';

const OUT = path.join(ROOT, '_site');

const ANALYTICS_SKIP_PREFIXES = ['blog-admin/'];

function shouldInjectAnalytics(relPath) {
  const norm = relPath.split(path.sep).join('/');
  return !ANALYTICS_SKIP_PREFIXES.some((p) => norm.startsWith(p));
}

function injectAnalyticsIntoSite() {
  let injected = 0;
  let skipped = 0;
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith('.html')) continue;
      const rel = path.relative(OUT, full);
      if (!shouldInjectAnalytics(rel)) {
        skipped++;
        continue;
      }
      const src = fs.readFileSync(full, 'utf8');
      const next = injectPosthogSnippet(src);
      if (next !== src) {
        fs.writeFileSync(full, next);
        injected++;
      }
    }
  }
  walk(OUT);
  console.log(`PostHog snippet injected into ${injected} HTML files (skipped ${skipped} admin/no-head).`);
}

const COPY_DIRS = ['funnel-tools', 'blog-admin'];
const COPY_FILES = ['CNAME', '.nojekyll', 'robots.txt'];

const BLOG_REDIRECT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=/">
  <link rel="canonical" href="${SITE_BASE}${SITE_HOME}">
  <title>Redirecting…</title>
  <script>location.replace('/');</script>
</head>
<body>
  <p><a href="/">Inventr guides home</a></p>
</body>
</html>
`;

function rmOut() {
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
}

function copyFile(rel) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) return;
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(rel) {
  const src = path.join(ROOT, rel);
  const dest = path.join(OUT, rel);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

rmOut();
execSync('node scripts/blog/generate-catalog.mjs', { cwd: ROOT, stdio: 'inherit' });
execSync('node scripts/blog/build-blog.mjs', { cwd: ROOT, stdio: 'inherit' });

for (const f of COPY_FILES) copyFile(f);
for (const d of COPY_DIRS) copyDir(d);
copyDir('blog');

// Guides home at site root (consignment.314-apps.com/)
const blogIndex = path.join(OUT, 'blog/index.html');
if (fs.existsSync(blogIndex)) {
  fs.copyFileSync(blogIndex, path.join(OUT, 'index.html'));
  fs.writeFileSync(blogIndex, BLOG_REDIRECT_HTML);
}

fs.mkdirSync(path.join(OUT, 'blog-data'), { recursive: true });

const blogSitemap = fs.existsSync(path.join(ROOT, 'sitemap-blog.xml'))
  ? fs.readFileSync(path.join(ROOT, 'sitemap-blog.xml'), 'utf8')
  : '';
const blogUrls = blogSitemap
  .replace(/<\?xml[\s\S]*?<urlset[^>]*>/, '')
  .replace(/<\/urlset>\s*$/, '')
  .trim()
  .replaceAll(`${SITE_BASE}/blog/`, `${SITE_BASE}/blog/`);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${blogUrls}
</urlset>
`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);

injectAnalyticsIntoSite();

console.log(`Site assembled at ${OUT}`);
