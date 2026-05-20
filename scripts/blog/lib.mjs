import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BLOG_SOURCE = path.join(ROOT, 'blog-source');
export const BLOG_DATA = path.join(ROOT, 'blog-data');
export const BLOG_OUT = path.join(ROOT, 'blog');
export const PUBLISHED_PATH = path.join(BLOG_DATA, 'published.json');
export const CATALOG_PATH = path.join(BLOG_DATA, 'catalog.json');
export const SITE_BASE = 'https://consignment.314-apps.com';
/** Site root on consignment.314-apps.com (guides home). Articles stay under /blog/. */
export const SITE_HOME = '/';
export const SITE_STYLES = '/funnel-tools/css/styles.css';

export const CLUSTER_LABELS = {
  'profit-calculator': 'Profit calculator',
  'break-even-calculator': 'Break-even calculator',
  'sell-through-calculator': 'Sell-through calculator',
  'pnl-template': 'P&L template',
  'spreadsheet-template': 'Spreadsheet template',
  'photo-checklist': 'Photo checklist',
  'tax-checklist': 'Tax checklist',
  'sourcing-guide': 'Sourcing guide',
  'migration-guide': 'Migration guide',
  'booth-scorecard': 'Booth scorecard',
  'inventr-app': 'Inventr app',
  ebay: 'eBay',
  etsy: 'Etsy',
  poshmark: 'Poshmark',
  mercari: 'Mercari',
  whatnot: 'Whatnot',
  'facebook-marketplace': 'Facebook Marketplace',
  depop: 'Depop',
  'amazon-resellers': 'Amazon resellers',
  'offerup-craigslist': 'OfferUp & Craigslist',
  'niches-vintage-clothing': 'Vintage clothing',
  'niches-books': 'Books',
  'niches-electronics': 'Electronics',
  'niches-toys-collectibles': 'Toys & collectibles',
  'niches-furniture': 'Furniture',
  'niches-glassware-pottery': 'Glassware & pottery',
  'niches-vinyl': 'Vinyl',
  'niches-tools': 'Tools',
  'niches-handbags': 'Handbags',
  'niches-sports-memorabilia': 'Sports memorabilia',
  'consignment-shop-ops': 'Consignment shop ops',
  'operations-fulfillment': 'Operations & fulfillment',
  'scaling-growth': 'Scaling & growth',
  'mindset-burnout': 'Mindset & burnout',
};

export const CLUSTER_SECTIONS = [
  { id: 'tools', title: 'Calculators & templates', clusters: [
    'profit-calculator', 'break-even-calculator', 'sell-through-calculator',
    'pnl-template', 'spreadsheet-template', 'photo-checklist', 'tax-checklist',
    'sourcing-guide', 'migration-guide', 'booth-scorecard', 'inventr-app',
  ]},
  { id: 'platforms', title: 'Online platforms', clusters: [
    'ebay', 'etsy', 'poshmark', 'mercari', 'whatnot', 'facebook-marketplace',
    'depop', 'amazon-resellers', 'offerup-craigslist',
  ]},
  { id: 'niches', title: 'Niches', clusters: [
    'niches-vintage-clothing', 'niches-books', 'niches-electronics',
    'niches-toys-collectibles', 'niches-furniture', 'niches-glassware-pottery',
    'niches-vinyl', 'niches-tools', 'niches-handbags', 'niches-sports-memorabilia',
  ]},
  { id: 'ops', title: 'Operations & business', clusters: [
    'consignment-shop-ops', 'operations-fulfillment', 'scaling-growth', 'mindset-burnout',
  ]},
];

export function walkHtmlFiles(dir, base = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkHtmlFiles(full, base));
    } else if (name.endsWith('.html') && name !== 'index.html') {
      results.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return results;
}

export function extractBlogLinks(html) {
  const re = /href="\/blog\/([^"#?]+)"/g;
  const paths = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1] && !m[1].endsWith('/')) paths.add(m[1]);
  }
  return [...paths].sort();
}

export function parseArticleMeta(html, relPath) {
  const cluster = relPath.includes('/') ? relPath.split('/')[0] : 'uncategorized';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const isDraft =
    /content="draft"/i.test(html) ||
    /content="stub"/i.test(html) ||
    html.includes('data-article-status="draft"');
  const titleRaw = titleMatch?.[1] ?? '';
  const title = titleRaw.replace(/\s*—\s*Inventr Blog\s*$/i, '').trim() || h1Match?.[1]?.trim() || relPath;
  const description = descMatch?.[1]?.trim() ?? '';
  const wordCount = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const status = isDraft || wordCount < 400 ? 'stub' : 'ready';
  return {
    path: relPath,
    cluster,
    clusterLabel: CLUSTER_LABELS[cluster] ?? cluster.replace(/-/g, ' '),
    title,
    description,
    status,
    wordCount,
    linksTo: extractBlogLinks(html),
  };
}

export function readPublished() {
  const raw = JSON.parse(fs.readFileSync(PUBLISHED_PATH, 'utf8'));
  return new Set(raw.paths ?? []);
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
