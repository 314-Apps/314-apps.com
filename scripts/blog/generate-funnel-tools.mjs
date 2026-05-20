#!/usr/bin/env node
/** Regenerates funnel-tools/index.html from manifest.json */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'funnel-tools/manifest.json'), 'utf8')
);

const cards = manifest
  .map(
    (t) => `
        <div class="tool-card">
          <h3>${t.title}</h3>
          <p>${t.description}</p>
          <a class="btn btn--primary" href="/funnel-tools/${t.slug}/">Open tool</a>
        </div>`
  )
  .join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Free Reseller Tools — Inventr</title>
  <meta name="description" content="Free calculators, checklists, and templates for resellers, booth sellers, and consignment shops.">
  <link rel="canonical" href="https://consignment.314-apps.com/funnel-tools/">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header class="site-header">
    <motion class="container">
      <a href="/" class="logo">Inventr</a>
      <nav class="nav-links">
        <a href="/">Guides</a>
        <a href="/funnel-tools/">Free Tools</a>
        <a class="btn btn--primary btn--sm" href="https://inventrapp.com?utm_source=funnel_tools&amp;utm_medium=nav" target="_blank" rel="noopener">Try Inventr Free</a>
      </nav>
    </motion>
  </header>
  <section class="hero hero--small">
    <motion class="container">
      <h1>Free tools for resellers</h1>
      <p>Calculators, checklists, and templates referenced in our guides. Always free — no account required.</p>
    </motion>
  </section>
  <main>
    <motion class="container">
      <motion class="tools-grid">${cards}
      </motion>
    </motion>
  </main>
  <footer class="site-footer">
    <motion class="container">
      <p>&copy; 2026 Inventr · <a href="https://314-apps.com">314 Apps</a></p>
    </motion>
  </footer>
</body>
</html>
`;

fs.writeFileSync(
  path.join(ROOT, 'funnel-tools/index.html'),
  html.replace(/motion/g, 'motion').replace(/<motion/g, '<div').replace(/<\/motion>/g, '</div>')
);

console.log(`Updated funnel-tools/index.html (${manifest.length} tools)`);
