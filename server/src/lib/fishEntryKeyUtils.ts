/**
 * Stable weight string for fish entry keys (training capture + eval merge).
 * Rounds to 0.001 lb so the same fish is not split into multiple keys from float noise across snapshots.
 */
export function normalizeFishWeightForEntryKey(w: number): string {
  if (!Number.isFinite(w)) return "?";
  return String(Math.round(w * 1000) / 1000);
}

/** Canonical numeric lb for storage/rank (same rounding as key). */
export function canonicalFishWeightLb(w: number): number {
  return Math.round(w * 1000) / 1000;
}
