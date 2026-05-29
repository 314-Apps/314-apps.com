/**
 * Build-time SEO meta injection for consignment.314-apps.com static HTML.
 */
import { SITE_BASE } from './lib.mjs';

export const SEO_MARKER = '<!-- Inventr SEO -->';

const SITE_NAME = 'Inventr';

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function stripExistingSeo(html) {
  return html.replace(
    /\s*<!-- Inventr SEO -->[\s\S]*?<!-- \/Inventr SEO -->\s*/g,
    ''
  );
}

function parseTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m?.[1]?.replace(/\s*—\s*Inventr(?:\s+Blog)?\s*$/i, '').trim() ?? '';
}

function parseDescription(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m?.[1]?.trim() ?? '';
}

/**
 * @param {object} opts
 * @param {string} opts.canonicalUrl Full canonical URL
 * @param {string} opts.title Page title (plain text)
 * @param {string} [opts.description]
 * @param {'website'|'article'} [opts.type]
 * @param {string} [opts.datePublished] ISO date YYYY-MM-DD
 */
export function buildSeoBlock({ canonicalUrl, title, description, type = 'website', datePublished }) {
  const safeTitle = escapeAttr(title);
  const safeDesc = escapeAttr(description || title);
  const safeUrl = escapeAttr(canonicalUrl);

  const ogLines = [
    `<meta property="og:title" content="${safeTitle}">`,
    `<meta property="og:description" content="${safeDesc}">`,
    `<meta property="og:url" content="${safeUrl}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
  ];

  const twitterLines = [
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${safeTitle}">`,
    `<meta name="twitter:description" content="${safeDesc}">`,
  ];

  let jsonLd = '';
  if (type === 'article' && title) {
    const article = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: description || title,
      url: canonicalUrl,
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_BASE,
      },
    };
    if (datePublished) article.datePublished = datePublished;
    jsonLd = `<script type="application/ld+json">${JSON.stringify(article)}</script>`;
  }

  const canonical =
    `<link rel="canonical" href="${safeUrl}">`;

  return `${SEO_MARKER}
${canonical}
${ogLines.join('\n')}
${twitterLines.join('\n')}
${jsonLd}
${SEO_MARKER.replace('<!-- Inventr SEO -->', '<!-- /Inventr SEO -->')}`;
}

/**
 * Resolve SEO metadata for a deployed HTML file under _site/.
 * @param {string} relPath Path relative to _site (posix)
 * @param {string} html
 * @param {Map<string, object>} catalogByPath
 * @param {string} [articleLastmod] YYYY-MM-DD for blog articles
 */
export function resolvePageSeo(relPath, html, catalogByPath, articleLastmod) {
  const norm = relPath.split('\\').join('/');

  if (norm === 'index.html') {
    return {
      canonicalUrl: `${SITE_BASE}/`,
      title: 'Inventr — Reseller guides & free tools',
      description:
        'Practical reselling guides, calculators, and checklists for booth sellers and consignment shops.',
      type: 'website',
    };
  }

  if (norm.startsWith('blog/') && norm.endsWith('.html') && norm !== 'blog/index.html') {
    const articlePath = norm.slice('blog/'.length);
    const article = catalogByPath.get(articlePath);
    const title = article?.title || parseTitle(html);
    const description = article?.description || parseDescription(html);
    return {
      canonicalUrl: `${SITE_BASE}/blog/${articlePath}`,
      title,
      description,
      type: 'article',
      datePublished: articleLastmod,
    };
  }

  if (norm.startsWith('funnel-tools/') && norm.endsWith('/index.html')) {
    const slug = norm.slice('funnel-tools/'.length, -'/index.html'.length);
    const title = parseTitle(html) || slug;
    const description = parseDescription(html);
    const path = slug ? `/funnel-tools/${slug}/` : '/funnel-tools/';
    return {
      canonicalUrl: `${SITE_BASE}${path}`,
      title,
      description,
      type: 'website',
    };
  }

  const title = parseTitle(html);
  const description = parseDescription(html);
  if (!title) return null;

  const urlPath = norm === 'index.html' ? '/' : `/${norm.replace(/index\.html$/, '')}`;
  return {
    canonicalUrl: `${SITE_BASE}${urlPath}`.replace(/\/$/, '') || SITE_BASE,
    title,
    description,
    type: 'website',
  };
}

export function injectSeoMeta(html, meta) {
  if (typeof html !== 'string' || !meta) return html;
  const headCloseRe = /<\/head>/i;
  if (!headCloseRe.test(html)) return html;

  let next = stripExistingSeo(html);

  // Replace or insert canonical if a bare tag exists without our block
  next = next.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');

  const block = buildSeoBlock(meta);
  return next.replace(headCloseRe, `${block}\n</head>`);
}
