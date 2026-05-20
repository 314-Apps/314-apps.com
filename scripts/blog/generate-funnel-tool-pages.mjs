#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'funnel-tools/manifest.json'), 'utf8')
);

function shell({ title, desc, slug, body, wide }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Inventr</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="https://consignment.314-apps.com/funnel-tools/${slug}/">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/styles.css">
  <link rel="stylesheet" href="../css/tools.css">
</head>
<body data-tool="${slug}">
  <header class="site-header">
    <motion class="container">
      <a href="/blog/" class="logo">Inventr <span>Blog</span></a>
      <nav class="nav-links">
        <a href="/blog/">All Posts</a>
        <a href="/funnel-tools/">Free Tools</a>
        <a class="btn btn--primary btn--sm" href="https://inventrapp.com?utm_source=funnel_tools&amp;utm_medium=${slug}" target="_blank" rel="noopener">Try Inventr Free</a>
      </nav>
    </motion>
  </header>
  <section class="hero hero--small">
    <motion class="container">
      <h1>${title}</h1>
      <p>${desc}</p>
    </motion>
  </section>
  <main>
    <motion class="container">
      <motion class="tool-panel${wide ? ' tool-panel--wide' : ''}">
${body}
      </motion>
      <p style="text-align:center;margin-top:1rem;">
        <a class="btn btn--outline" href="/funnel-tools/">← All free tools</a>
      </p>
    </motion>
  </main>
  <footer class="site-footer"><motion class="container"><p>&copy; 2026 Inventr</p></motion></footer>
  <script src="../js/tools.js"></script>
</body>
</html>
`.replaceAll('motion', 'motion');
}

function checklistBody(id, items) {
  const lis = items
    .map(
      (text, i) => `          <li>
            <input type="checkbox" data-id="${id}-${i}" id="${id}-${i}">
            <label for="${id}-${i}">${text}</label>
          </li>`
    )
    .join('\n');
  return `        <ul class="checklist" id="${id}">
${lis}
        </ul>
        <div class="tool-actions">
          <button type="button" class="btn secondary" id="checklist-reset">Reset checklist</button>
        </motion>`;
}

const bodies = {
  'profit-calculator': `        <div class="tool-grid-2">
          <div class="tool-field"><label for="sale">Sale price ($)</label><input type="number" id="sale" min="0" step="0.01" value="45"></div>
          <div class="tool-field"><label for="cogs">Cost of goods ($)</label><input type="number" id="cogs" min="0" step="0.01" value="12"></div>
          <div class="tool-field"><label for="feePct">Platform + payment fees (%)</label><input type="number" id="feePct" min="0" step="0.1" value="13"></div>
          <div class="tool-field"><label for="shipOut">Shipping you pay ($)</label><input type="number" id="shipOut" min="0" step="0.01" value="5.50"></div>
          <div class="tool-field"><label for="shipIn">Shipping charged to buyer ($)</label><input type="number" id="shipIn" min="0" step="0.01" value="0"></div>
        </div>
        <div class="tool-results">
          <h3>Results</h3>
          <dl>
            <dt>Platform fees</dt><dd id="fees">$0.00</dd>
            <dt>Net profit</dt><dd id="netProfit">$0.00</dd>
            <dt>Profit margin</dt><dd id="margin">0%</dd>
          </dl>
        </div>`,
  'break-even-calculator': `        <motion class="tool-field"><label for="fixed">Monthly fixed costs ($)</label><input type="number" id="fixed" min="0" step="1" value="350"></div>
        <div class="tool-grid-2">
          <div class="tool-field"><label for="profitPerSale">Average net profit per sale ($)</label><input type="number" id="profitPerSale" min="0" step="0.01" value="18"></div>
          <div class="tool-field"><label for="avgSale">Average sale price ($)</label><input type="number" id="avgSale" min="0" step="0.01" value="42"></div>
        </div>
        <div class="tool-results">
          <h3>Break-even</h3>
          <dl>
            <dt>Sales needed per month</dt><dd id="unitsNeeded">—</dd>
            <dt>Gross revenue at break-even</dt><dd id="revenueNeeded">—</dd>
          </dl>
        </motion>`,
  'sell-through-calculator': `        <div class="tool-grid-2">
          <div class="tool-field"><label for="startUnits">Starting active listings</label><input type="number" id="startUnits" min="0" step="1" value="200"></div>
          <div class="tool-field"><label for="soldUnits">Units sold in period</label><input type="number" id="soldUnits" min="0" step="1" value="38"></div>
          <div class="tool-field"><label for="days">Days in period</label><input type="number" id="days" min="1" step="1" value="30"></motion>
        </div>
        <div class="tool-results">
          <h3>Sell-through</h3>
          <dl>
            <dt>Period sell-through rate</dt><dd id="stRate">0%</dd>
            <dt>Annualized (estimate)</dt><dd id="annualized">—</dd>
            <dt>Units still listed</dt><dd id="remaining">0</dd>
          </dl>
        </div>`,
  'pnl-template': `        <p>Monthly P&amp;L worksheet. Download CSV or copy the table.</p>
        <table class="pnl-table" id="pnl-table">
          <thead><tr><th>Category</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>Gross sales</td><td></td></tr>
            <tr><td>Cost of goods sold</td><td></td></tr>
            <tr><td>Platform fees</td><td></td></tr>
            <tr><td>Shipping paid</td><td></td></tr>
            <tr><td>Supplies &amp; packaging</td><td></td></tr>
            <tr><td>Booth rent</td><td></td></tr>
            <tr><td>Mileage (deductible)</td><td></td></tr>
            <tr><td>Other expenses</td><td></td></tr>
            <tr><td><strong>Net profit</strong></td><td></td></tr>
          </tbody>
        </table>
        <div class="tool-actions">
          <button type="button" class="btn btn--primary" id="pnl-download">Download CSV</button>
          <button type="button" class="btn btn--outline" id="pnl-copy">Copy table</button>
        </div>`,
  'spreadsheet-template': `        <p>Starter inventory columns for Sheets or Excel.</p>
        <table class="sheet-table">
          <thead><tr><th>SKU</th><th>Title</th><th>Cost</th><th>List Price</th><th>Channel</th><th>Status</th></tr></thead>
          <tbody><tr><td></td><td></td><td></td><td></td><td></td><td>Available</td></tr></tbody>
        </table>
        <div class="tool-actions">
          <button type="button" class="btn btn--primary" id="sheet-download">Download CSV template</button>
        </div>`,
  'photo-checklist': checklistBody('photo-checklist', [
    'Hero shot on neutral background',
    'Full front view',
    'Brand / size / care tag close-up',
    'Any flaws or wear (with scale)',
    'Measurements for clothing',
    'Weight for shipping estimate',
  ]),
  'tax-checklist': checklistBody('tax-checklist', [
    'Export all platform sales reports',
    'Separate personal vs business purchases',
    'Mileage log for sourcing trips',
    'Home office deduction worksheet',
    'Inventory snapshot (year-end)',
    '1099-K / 1099-NEC forms received',
    'Schedule C expense categories mapped',
    'Quarterly estimated payments reviewed',
  ]),
  'sourcing-guide': checklistBody('sourcing-checklist', [
    'Research comps before leaving home',
    'Bring measuring tape & flashlight',
    'Set max spend per category',
    'Check sold comps on one item per rack',
    'Skip categories below target $/hour',
    'Photograph tags on high-value finds',
    'Track mileage from first stop',
  ]),
  'migration-guide': checklistBody('migration-checklist', [
    'Export spreadsheet to CSV',
    'Map columns: SKU, title, cost, price',
    'Clean duplicate SKUs',
    'Archive sold items older than 12 months',
    'Import into Inventr',
    'Verify 10 random items match source',
    'Run first sell-through report',
    'Retire old spreadsheet (read-only backup)',
  ]),
  'booth-scorecard': `        <p>Rate each area 1 (weak) to 5 (excellent).</p>
        ${['Display & lighting', 'Signage & booth identity', 'Pricing clarity', 'Traffic / location', 'Checkout speed', 'Inventory freshness']
          .map(
            (label, i) => `        <div class="score-row">
          <label>${label}</label>
          <select data-cat="${i}">
            <option value="">—</option>
            <option value="1">1</option><option value="2">2</option>
            <option value="3">3</option><option value="4">4</option><option value="5">5</option>
          </select>
        </div>`
          )
          .join('')}
        <div class="tool-results">
          <h3>Score</h3>
          <dl>
            <dt>Average</dt><dd id="boothScore">—</dd>
            <dt>Summary</dt><dd id="boothLabel" style="color:var(--color-text)">—</dd>
          </dl>
        </div>`,
};

let html = fs.readFileSync(path.join(ROOT, 'scripts/blog/funnel-tool-shell.txt'), 'utf8');

for (const t of manifest) {
  const body = bodies[t.slug];
  if (!body) {
    console.warn(`No body for ${t.slug}`);
    continue;
  }
  const page = shell({
    title: t.title,
    desc: t.description,
    slug: t.slug,
    body,
    wide: ['pnl-template', 'spreadsheet-template'].includes(t.slug),
  });
  const dir = path.join(ROOT, 'funnel-tools', t.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page);
}

console.log(`Generated ${manifest.length} funnel tool pages`);
