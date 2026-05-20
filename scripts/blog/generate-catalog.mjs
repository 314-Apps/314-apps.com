#!/usr/bin/env node
import fs from 'node:fs';
import {
  BLOG_SOURCE,
  CATALOG_PATH,
  walkHtmlFiles,
  parseArticleMeta,
} from './lib.mjs';

const paths = walkHtmlFiles(BLOG_SOURCE).sort();
const articles = paths.map((rel) => {
  const html = fs.readFileSync(`${BLOG_SOURCE}/${rel}`, 'utf8');
  return parseArticleMeta(html, rel);
});

const catalog = {
  generatedAt: new Date().toISOString(),
  count: articles.length,
  articles,
};

fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${articles.length} articles to ${CATALOG_PATH}`);
