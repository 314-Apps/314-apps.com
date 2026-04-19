/**
 * Derive per-fish arrival events from a chronological sequence of training snapshots.
 *
 * A "fish" is identified by `fishEntryKey` (anglerKey + rounded weight). The first snapshot that
 * shows a given key for a given (day, windowId) emits an arrival with:
 *   - `firstSeenMs` = that snapshot's fetchedAtMs
 *   - `priorFetchedMs` = fetchedAtMs of the previous snapshot that observed the same (day, windowId),
 *     or `null` if this was the first snapshot for that window
 *   - `fractionElapsedAtFirstSeen` = where `firstSeenMs` falls within the payout window [start, end],
 *     clamped to [0, 1]. `null` if tournament date or window bounds cannot be determined.
 *
 * A cull (same angler, different weight) is treated as a new arrival: the fishEntryKey differs,
 * so both the pre-cull weight (already recorded) and the post-cull weight both appear in the output.
 * We do not try to pair up the "disappearance" of the old fish with the arrival of the new one.
 */
import { DateTime } from "luxon";
import type { TrainingSnapshotRecord } from "./trainingCapture.js";
import { PAYOUT_WINDOWS, type TournamentDayKind } from "./payoutWindows.js";

const TZ = "America/Chicago";

export type ArrivalDayKind = Exclude<TournamentDayKind, null>;
export type ArrivalWindowId = 1 | 2 | 3 | 4;

export interface FishArrival {
  fishEntryKey: string;
  anglerKey: string;
  name: string;
  weighStation: string;
  weightLb: number;
  day: ArrivalDayKind;
  windowId: ArrivalWindowId;
  firstSeenMs: number;
  priorFetchedMs: number | null;
  fractionElapsedAtFirstSeen: number | null;
}

function isArrivalDay(day: unknown): day is ArrivalDayKind {
  return day === "Saturday" || day === "Sunday";
}

function matchesWindowLabel(label: string, windowId: ArrivalWindowId): boolean {
  const l = label.toLowerCase();
  switch (windowId) {
    case 1:
      return l.includes("6:30") && l.includes("9");
    case 2:
      return l.includes("9:01") && l.includes("11");
    case 3:
      return l.includes("11:01") && (l.includes("1pm") || l.includes("1:00") || l.includes("1 pm"));
    case 4:
      return l.includes("1:01") && l.includes("3");
  }
}

/**
 * Window start/end epoch ms for a snapshot's tournament date. Uses `fetchedAtMs` to determine the
 * Chicago calendar date the window belongs to. Returns `null` if we cannot resolve a valid tz date.
 */
function windowBoundsForSnapshot(
  fetchedAtMs: number,
  windowId: ArrivalWindowId,
): { startMs: number; endMs: number } | null {
  const dt = DateTime.fromMillis(fetchedAtMs, { zone: TZ });
  if (!dt.isValid) return null;
  const dayStart = dt.startOf("day");
  const def = PAYOUT_WINDOWS.find((w) => w.id === windowId);
  if (!def) return null;
  const startMs = dayStart.plus({ minutes: def.startMinutes }).toMillis();
  const endMs = dayStart.plus({ minutes: def.endMinutes }).toMillis();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
}

function fractionElapsed(
  firstSeenMs: number,
  bounds: { startMs: number; endMs: number } | null,
): number | null {
  if (bounds == null) return null;
  const raw = (firstSeenMs - bounds.startMs) / (bounds.endMs - bounds.startMs);
  if (!Number.isFinite(raw)) return null;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

/**
 * Given snapshots in *any* order (they will be sorted ascending by `fetchedAtMs`), return the
 * deduplicated arrival list. Output is sorted by `firstSeenMs` then `fishEntryKey`.
 */
export function extractArrivalsFromSnapshots(
  snaps: readonly TrainingSnapshotRecord[],
): FishArrival[] {
  const ordered = [...snaps].sort((a, b) => a.fetchedAtMs - b.fetchedAtMs);

  const seenByWindow = new Map<string, Set<string>>();
  const lastFetchedByWindow = new Map<string, number>();
  const out: FishArrival[] = [];

  for (const snap of ordered) {
    const fetchedAtMs = snap.fetchedAtMs;
    if (!Number.isFinite(fetchedAtMs) || fetchedAtMs <= 0) continue;

    const snapDayKind = snap.tournamentDay === "Saturday" || snap.tournamentDay === "Sunday"
      ? snap.tournamentDay
      : null;

    for (const period of snap.periods ?? []) {
      const day = period.day;
      if (!isArrivalDay(day)) continue;
      if (snapDayKind != null && snapDayKind !== day) continue;

      for (const windowId of [1, 2, 3, 4] as const) {
        if (!matchesWindowLabel(period.label ?? "", windowId)) continue;

        const windowKey = `${day}-W${windowId}`;
        let seen = seenByWindow.get(windowKey);
        if (!seen) {
          seen = new Set<string>();
          seenByWindow.set(windowKey, seen);
        }

        const priorFetchedMs = lastFetchedByWindow.get(windowKey) ?? null;
        const bounds = windowBoundsForSnapshot(fetchedAtMs, windowId);

        for (const row of period.rows ?? []) {
          const weightLb = row.weightLb;
          if (weightLb == null || !Number.isFinite(weightLb)) continue;
          const fishEntryKey = (row as { fishEntryKey?: string }).fishEntryKey;
          const anglerKey = (row as { anglerKey?: string }).anglerKey;
          if (typeof fishEntryKey !== "string" || fishEntryKey.length === 0) continue;
          if (typeof anglerKey !== "string" || anglerKey.length === 0) continue;

          if (seen.has(fishEntryKey)) continue;
          seen.add(fishEntryKey);

          out.push({
            fishEntryKey,
            anglerKey,
            name: row.name,
            weighStation: row.weighStation,
            weightLb,
            day,
            windowId,
            firstSeenMs: fetchedAtMs,
            priorFetchedMs,
            fractionElapsedAtFirstSeen: fractionElapsed(fetchedAtMs, bounds),
          });
        }

        lastFetchedByWindow.set(windowKey, fetchedAtMs);
      }
    }
  }

  out.sort((a, b) => {
    if (a.firstSeenMs !== b.firstSeenMs) return a.firstSeenMs - b.firstSeenMs;
    return a.fishEntryKey < b.fishEntryKey ? -1 : a.fishEntryKey > b.fishEntryKey ? 1 : 0;
  });
  return out;
}
