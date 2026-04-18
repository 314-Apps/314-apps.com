import { DateTime } from "luxon";
import type { PeriodSection } from "./types.js";

const TZ = "America/Chicago";

export interface PayoutWindowDef {
  id: number;
  label: string;
  startMinutes: number;
  endMinutes: number;
}

/** Minutes from midnight for local Chicago time. */
export const PAYOUT_WINDOWS: PayoutWindowDef[] = [
  { id: 1, label: "6:30am–9:00am", startMinutes: 6 * 60 + 30, endMinutes: 9 * 60 + 0 },
  { id: 2, label: "9:01am–11:00am", startMinutes: 9 * 60 + 1, endMinutes: 11 * 60 + 0 },
  { id: 3, label: "11:01am–1:00pm", startMinutes: 11 * 60 + 1, endMinutes: 13 * 60 + 0 },
  { id: 4, label: "1:01pm–3:00pm", startMinutes: 13 * 60 + 1, endMinutes: 15 * 60 + 0 },
];

export type TournamentDayKind = "Saturday" | "Sunday" | null;

export function tournamentDayKind(now: Date = new Date()): TournamentDayKind {
  const dt = DateTime.fromJSDate(now, { zone: TZ });
  const sat = process.env.BBB_SATURDAY_DATE?.trim();
  const sun = process.env.BBB_SUNDAY_DATE?.trim();
  const iso = dt.toISODate();
  if (sat && sun) {
    if (iso === sat) return "Saturday";
    if (iso === sun) return "Sunday";
    return null;
  }
  if (sat && iso === sat) return "Saturday";
  if (sun && iso === sun) return "Sunday";
  if (sat || sun) return null;

  const wd = dt.weekday;
  if (wd === 6) return "Saturday";
  if (wd === 7) return "Sunday";
  return null;
}

export interface ActiveWindowInfo {
  window: PayoutWindowDef;
  periodEnd: DateTime;
  minutesLeftInPeriod: number;
  day: TournamentDayKind;
}

/** Current payout window using inclusive end instant (e.g. 9:00:00.000 is still window 1). */
export function getActiveWindow(now: Date = new Date()): ActiveWindowInfo | null {
  const dt = DateTime.fromJSDate(now, { zone: TZ });
  const day = tournamentDayKind(now);
  if (!day) return null;

  const dayStart = dt.startOf("day");

  for (const w of PAYOUT_WINDOWS) {
    const start = dayStart.plus({ minutes: w.startMinutes });
    const end = dayStart.plus({ minutes: w.endMinutes });
    if (dt >= start && dt <= end) {
      const minutesLeft = (end.toMillis() - dt.toMillis()) / 60000;
      return {
        window: w,
        periodEnd: end,
        minutesLeftInPeriod: Math.max(0, minutesLeft),
        day,
      };
    }
  }
  return null;
}

export function effectiveMinutesLeft(
  minutesLeftInPeriod: number,
  travelMinutes: number,
): number {
  return minutesLeftInPeriod - travelMinutes;
}

/** Map scraped period headings to the active payout window (vendor wording may vary). */
export function periodMatchesWindow(
  period: PeriodSection,
  window: PayoutWindowDef,
  day: TournamentDayKind,
): boolean {
  if (!day || period.day !== day) return false;
  const h = period.h2.toLowerCase();
  switch (window.id) {
    case 1:
      return h.includes("6:30") && h.includes("9");
    case 2:
      return h.includes("9:01") && h.includes("11");
    case 3:
      return h.includes("11:01") && (h.includes("1pm") || h.includes("1 pm") || h.includes("1:00"));
    case 4:
      return h.includes("1:01") && h.includes("3");
    default:
      return false;
  }
}
