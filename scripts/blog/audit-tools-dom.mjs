#!/usr/bin/env node
/** Static checks: each tool page exists and has expected hooks. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'funnel-tools/manifest.json'), 'utf8'));

const requiredBySlug = {
  'profit-calculator': ['id="sale"', 'id="netProfit"', 'data-tool="profit-calculator"'],
  'sell-through-calculator': ['id="startUnits"', 'id="stRate"', 'id="stNote"'],
  'break-even-calculator': ['id="fixed"', 'id="unitsNeeded"', 'id="beNote"'],
  'pnl-template': ['id="pnl-table"', 'data-pnl="gross-sales"', 'id="pnl-download"', 'id="pnl-net-profit"'],
  'spreadsheet-template': ['sheet-table', 'id="sheet-add-row"', 'id="sheet-download"'],
  'photo-checklist': ['id="photo-checklist"', 'id="checklist-reset"'],
  'tax-checklist': ['id="tax-checklist"'],
  'sourcing-guide': ['id="sourcing-checklist"', 'id="src-buy"'],
  'migration-guide': ['id="migration-checklist"'],
  'booth-scorecard': ['id="boothScore"', 'id="boothLabel"', 'class="score-row"'],
};

let failed = 0;
for (const { slug } of manifest) {
  const file = path.join(ROOT, 'funnel-tools', slug, 'index.html');
  if (!fs.existsSync(file)) {
    console.error('MISSING', slug);
    failed++;
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  if (html.includes('<motion') || html.includes('</motion>')) {
    console.error('INVALID HTML (motion tags):', slug);
    failed++;
  }
  if (!html.includes('../js/tools.js')) {
    console.error('MISSING tools.js:', slug);
    failed++;
  }
  for (const needle of requiredBySlug[slug] || []) {
    if (!html.includes(needle)) {
      console.error(slug, 'missing', needle);
      failed++;
    }
  }
}
if (failed) process.exit(1);
console.log(`DOM audit OK for ${manifest.length} tools.`);
