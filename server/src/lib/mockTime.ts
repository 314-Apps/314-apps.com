import { DateTime } from "luxon";

const TZ = "America/Chicago";

let realT0Ms: number | null = null;

function timeScale(): number {
  const n = Number.parseFloat(process.env.MOCK_TIME_SCALE || "20");
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/** Wall-clock instant when the Node process started (or first mock access). */
function realAnchorMs(): number {
  if (realT0Ms == null) {
    const env = process.env.MOCK_REAL_T0_MS?.trim();
    if (env && /^\d+$/.test(env)) {
      realT0Ms = Number.parseInt(env, 10);
    } else {
      realT0Ms = Date.now();
    }
  }
  return realT0Ms;
}

/** Simulated instant in Chicago used for payout windows + mock boards. */
export function getMockSimulatedDate(): Date {
  const startIso = process.env.MOCK_SIM_START_ISO?.trim();
  let base: DateTime;
  if (startIso) {
    base = DateTime.fromISO(startIso, { zone: TZ });
  } else {
    const nowCt = DateTime.now().setZone(TZ);
    const sat = saturdayOfWeekContaining(nowCt);
    base = sat.set({ hour: 6, minute: 30, second: 0, millisecond: 0 });
  }
  if (!base.isValid) {
    const nowCt = DateTime.now().setZone(TZ);
    const sat = saturdayOfWeekContaining(nowCt);
    base = sat.set({ hour: 6, minute: 30, second: 0, millisecond: 0 });
  }

  const realElapsedMs = Date.now() - realAnchorMs();
  const simElapsedMin = (realElapsedMs / 60000) * timeScale();
  return base.plus({ minutes: simElapsedMin }).toJSDate();
}

export function getSimulationMeta(): {
  timeScale: number;
  realAnchorMs: number;
  simulatedIso: string;
  realElapsedMinutes: number;
  simulatedElapsedMinutes: number;
} {
  const scale = timeScale();
  const anchor = realAnchorMs();
  const realElapsedMs = Date.now() - anchor;
  const simElapsedMin = (realElapsedMs / 60000) * scale;
  const sim = getMockSimulatedDate();
  return {
    timeScale: scale,
    realAnchorMs: anchor,
    simulatedIso: DateTime.fromJSDate(sim, { zone: TZ }).toISO() ?? sim.toISOString(),
    realElapsedMinutes: realElapsedMs / 60000,
    simulatedElapsedMinutes: simElapsedMin,
  };
}

function saturdayOfWeekContaining(dt: DateTime): DateTime {
  const wd = dt.weekday;
  const daysBack = wd === 6 ? 0 : wd === 7 ? 1 : wd + 1;
  return dt.startOf("day").minus({ days: daysBack });
}
