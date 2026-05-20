#!/usr/bin/env node
import fs from 'node:fs';
import { CATALOG_PATH, PUBLISHED_PATH } from './lib.mjs';

if (!fs.existsSync(CATALOG_PATH)) {
  console.error(`Missing ${CATALOG_PATH}. Run: npm run blog:catalog`);
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const published = new Set(
  JSON.parse(fs.readFileSync(PUBLISHED_PATH, 'utf8')).paths ?? []
);
const byPath = new Map(catalog.articles.map((a) => [a.path, a]));

const violations = [];

for (const livePath of published) {
  const article = byPath.get(livePath);
  if (!article) {
    violations.push({
      source: livePath,
      target: livePath,
      reason: 'live article not in catalog (run blog:catalog)',
    });
    continue;
  }
  for (const target of article.linksTo ?? []) {
    if (!byPath.has(target)) {
      violations.push({ source: livePath, target, reason: 'missing source file' });
    } else if (!published.has(target)) {
      violations.push({ source: livePath, target, reason: 'not published' });
    }
  }
}

if (violations.length === 0) {
  console.log(`OK: ${published.size} live articles, all internal links resolve.`);
  process.exit(0);
}

console.error(`Broken internal links from live articles (${violations.length}):`);
for (const v of violations) {
  console.error(`  ${v.source} -> /blog/${v.target}  (${v.reason})`);
}
process.exit(1);
