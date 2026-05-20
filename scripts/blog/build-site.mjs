#!/usr/bin/env node
/**
 * Assembles _site/ for GitHub Pages: main site + published blog only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { execSync } from 'node:child_process';

const OUT = path.join(ROOT, '_site');

const COPY_DIRS = ['fish', 'funnel-tools', 'blog-admin'];
const COPY_FILES = [
  'index.html', 'style.css', 'contact.html', 'privacy-policy.html',
  'terms-of-service.html', 'CNAME', '.nojekyll', 'robots.txt',
];

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

fs.mkdirSync(path.join(OUT, 'blog-data'), { recursive: true });
// PIN is in blog-admin/config.json only (not copied to _site)

// Merge sitemaps
const mainUrls = `<url><loc>https://314-apps.com/</loc><priority>1.0</priority></url>`;
const blogSitemap = fs.existsSync(path.join(ROOT, 'sitemap-blog.xml'))
  ? fs.readFileSync(path.join(ROOT, 'sitemap-blog.xml'), 'utf8')
  : '';
const blogUrls = blogSitemap.replace(/<\?xml[\s\S]*?<urlset[^>]*>/, '').replace(/<\/urlset>\s*$/, '').trim();
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mainUrls}
${blogUrls}
</urlset>
`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);

console.log(`Site assembled at ${OUT}`);
