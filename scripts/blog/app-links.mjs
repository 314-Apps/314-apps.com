/** Canonical App Store URL for Inventr (Resell Tracker) iOS app. */
export const APP_STORE_URL =
  'https://apps.apple.com/us/app/resell-tracker-flip-profit/id6753903683';

/**
 * Apple App Analytics provider token.
 *
 * Apple attributes a campaign from `pt` + `ct` + `mt` — NOT from `utm_*`, which
 * the App Store ignores entirely. `ct` alone is recorded but will not show up
 * under App Analytics → Acquisition → Campaigns without the matching `pt`.
 *
 * Find it in App Store Connect → Analytics → Acquisition → Campaigns →
 * "Create Campaign": the generated link contains `pt=<provider id>`. It is the
 * same value for every app on the account.
 *
 * 128212107 is the 314 Apps LLC provider id, taken from a campaign link that
 * App Store Connect generated on 2026-09-14. A guessed `pt` would attribute
 * installs to somebody else's provider id, so never fill this from memory.
 * `APP_STORE_PROVIDER_TOKEN` in the environment overrides the committed value
 * (useful in CI), and both go through `resolveProviderToken`.
 */
const COMMITTED_PROVIDER_TOKEN = '128212107';

export const APP_STORE_PROVIDER_TOKEN = resolveProviderToken(
  process.env.APP_STORE_PROVIDER_TOKEN ?? COMMITTED_PROVIDER_TOKEN,
);

/**
 * Apple provider ids are plain digits (e.g. `pt=118431040`). Anything else is a
 * paste error, and a wrong `pt` credits installs to someone else's account, so
 * the build fails loudly instead of emitting it.
 */
function resolveProviderToken(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (!/^\d{1,20}$/.test(value)) {
    throw new Error(
      `APP_STORE_PROVIDER_TOKEN must be the numeric pt= value from an App Store Connect campaign link, got: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * Rewrite every App Store campaign link in an HTML/JS string so it carries the
 * provider token. Only links that already have a `ct=` are touched (blog nav
 * links use `utm_*` and are left alone), and links that already carry `pt=`
 * are left as-is. The separator (`&amp;` in HTML attributes, `&` in JS) is
 * copied from the link itself so the output stays valid in either context.
 */
export function withProviderToken(text) {
  if (!APP_STORE_PROVIDER_TOKEN) return text;
  const urlRe = /https:\/\/apps\.apple\.com\/[^\s"'<>]*\?[^\s"'<>]*/g;
  return text.replace(urlRe, (url) => {
    if (!/[?&;]ct=/.test(url) || /[?&;]pt=/.test(url)) return url;
    const amp = url.includes('&amp;') ? '&amp;' : '&';
    return url.replace('?', `?pt=${encodeURIComponent(APP_STORE_PROVIDER_TOKEN)}${amp}`);
  });
}

/** href for CTAs; preserves optional query string (use &amp; in HTML templates). */
export function appStoreHref(query = '') {
  if (!query) return APP_STORE_URL;
  const q = query.startsWith('?') ? query : `?${query}`;
  return `${APP_STORE_URL}${q}`;
}

/**
 * App Store link tagged for Apple App Analytics.
 *
 * @param {string} campaign  Campaign token, e.g. 'meta_resellers_2026_09'.
 *                           Shown verbatim in App Analytics; keep it stable,
 *                           lowercase, and matched to the ad campaign name.
 * @param {string} [amp]     Set to '&amp;' when the result is written into HTML.
 */
export function appStoreCampaignHref(campaign, amp = '&') {
  if (!campaign) return APP_STORE_URL;
  const params = [];
  if (APP_STORE_PROVIDER_TOKEN) params.push(`pt=${encodeURIComponent(APP_STORE_PROVIDER_TOKEN)}`);
  params.push(`ct=${encodeURIComponent(campaign)}`);
  params.push('mt=8');
  return `${APP_STORE_URL}?${params.join(amp)}`;
}
