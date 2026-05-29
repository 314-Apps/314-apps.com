# 314-apps.com

Monorepo for [314 Apps](https://314-apps.com) products and sites.

## Inventr guides (consignment.314-apps.com)

Public marketing site for **Inventr** — reseller guides, calculators, and checklists:

**https://consignment.314-apps.com/**

Build locally:

```bash
npm run blog:site
npm run blog:preview   # serve _site/ on http://localhost:8765
```

Deploy: push to `main`; GitHub Actions publishes `_site/` to GitHub Pages.

### SEO / indexing checklist

After deploy, verify in [Google Search Console](https://search.google.com/search-console):

1. Property: `https://consignment.314-apps.com/`
2. Sitemap: `https://consignment.314-apps.com/sitemap.xml`
3. Request indexing on homepage + 2–3 key articles after adding external links

**Discovery (manual):** Add the guides URL to App Store Connect (Developer Website / Marketing URL) and link from at least one profile you control (GitHub org, LinkedIn, etc.). Google rarely crawls new subdomains with zero inbound links.
