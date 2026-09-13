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

### Paid-ad destination: `/app` and `/android`

Meta (and any other paid) traffic points at **`https://consignment.314-apps.com/app`**
rather than at the App Store directly, so the click is measured on our own domain
before it leaves.

| Path | What it does |
|------|--------------|
| [`app/index.html`](app/index.html) | Branches on user agent: Android → `/android/`, everything else → the App Store. Records an `app_redirect` event first. |
| [`android/index.html`](android/index.html) | Waitlist page — there is no Play release, so Android visitors are asked for an email instead of sent to a store they cannot install from. |

Both are `noindex`. Neither is in the sitemap.

**Why the redirect waits ~0.2-1.2s.** `/app/` is the only place an ad click is
counted, and PostHog's snippet queues events until `array.js` loads — navigating
away sooner loses the pageview. The page polls for the real library, fires
`app_redirect`, then leaves, capped at 1.2s so a blocked CDN never strands anyone.

**Campaign tagging.** App Store links here carry Apple's `ct` + `mt`, *not*
`utm_*`, which the App Store ignores. See `appStoreCampaignHref()` in
[`scripts/blog/app-links.mjs`](scripts/blog/app-links.mjs). To make campaigns show
up under App Analytics → Acquisition, set `APP_STORE_PROVIDER_TOKEN` there to the
`pt=` value from an App Store Connect campaign link — until then `ct` is passed
but not attributed.

**Waitlist emails** land in PostHog as identified persons with
`android_waitlist: true` (the site is static, so there is no backend to post to).
Read them from Persons, or filter the `android_waitlist_joined` event.

### SEO / indexing checklist

After deploy, verify in [Google Search Console](https://search.google.com/search-console):

1. Property: `https://consignment.314-apps.com/`
2. Sitemap: `https://consignment.314-apps.com/sitemap.xml`
3. Request indexing on homepage + 2–3 key articles after adding external links

**Discovery (manual):** Add the guides URL to App Store Connect (Developer Website / Marketing URL) and link from at least one profile you control (GitHub org, LinkedIn, etc.). Google rarely crawls new subdomains with zero inbound links.

### App Store legal URLs

Use these in App Store Connect for Inventr (Resell Tracker):

- Privacy Policy: `https://consignment.314-apps.com/privacy-policy.html`
- Terms of Service: `https://consignment.314-apps.com/terms.html`
