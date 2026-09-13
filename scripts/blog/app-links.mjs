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
 * Left empty deliberately: emitting a guessed `pt` attributes installs to
 * somebody else's provider id, which is worse than emitting none.
 */
export const APP_STORE_PROVIDER_TOKEN = '';

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
