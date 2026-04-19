/**
 * Canonical weigh-in station strings for training leaderboards, charts, and `weigh-station-locations.json` keys.
 * Collapses spacing variants so leaderboard text, stats buckets, and map pins line up.
 */

/** Lowercase key for grouping and JSON lookup (same bucket for "PB #2", "pb#2", "PB  # 2"). */
export function canonicalWeighStationKey(raw: string): string {
  if (typeof raw !== "string") return "__unknown__";
  let s = raw.trim().toLowerCase();
  if (s.length === 0) return "__unknown__";
  s = s.replace(/\s+/g, " ");
  // Leaderboard text often uses "and" instead of "&" for marinas (must run before & tightening).
  s = s.replace(/\s+and\s+/g, " & ");
  s = s.replace(/\s*&\s*/g, " & ");
  s = s.replace(/\s*#\s*/g, "#");
  // "PB2", "PB 2", "pb # 2" → pb#2 (location JSON uses one key per site).
  s = s.replace(/\bpb\s*#?\s*(\d+)\b/g, "pb#$1");
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 0 ? s : "__unknown__";
}

/**
 * Display label from a canonical key (title case, `PB#2`-style tokens).
 * Use {@link displayWeighStationFromRaw} when starting from scrape text.
 */
export function formatWeighStationDisplay(key: string): string {
  if (key === "__unknown__") return "Unknown station";
  return key
    .split(/\s+/)
    .map((word) => {
      if (word === "&") return "&";
      const m = word.match(/^([a-z]+)(#\d+)$/);
      if (m) return m[1]!.toUpperCase() + m[2]!;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** Normalize raw leaderboard text to the same display string used in training UI + weigh-station APIs. */
export function displayWeighStationFromRaw(raw: string): string {
  return formatWeighStationDisplay(canonicalWeighStationKey(raw));
}
