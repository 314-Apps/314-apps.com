/** Canonical App Store URL for Inventr (Resell Tracker) iOS app. */
export const APP_STORE_URL =
  'https://apps.apple.com/us/app/resell-tracker-flip-profit/id6753903683';

/** href for CTAs; preserves optional query string (use &amp; in HTML templates). */
export function appStoreHref(query = '') {
  if (!query) return APP_STORE_URL;
  const q = query.startsWith('?') ? query : `?${query}`;
  return `${APP_STORE_URL}${q}`;
}
