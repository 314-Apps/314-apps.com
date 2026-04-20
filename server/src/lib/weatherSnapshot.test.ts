import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { DateTime } from "luxon";
import { buildWeatherSnapshot } from "./weatherSnapshot.js";
import type { WeatherDayFile } from "./weatherCollector.js";

const HOUR_MS = 3_600_000;
const TZ = "America/Chicago";

function dayFile(date: string, stations: WeatherDayFile["stations"]): WeatherDayFile {
  return {
    date,
    source: "open-meteo:forecast",
    fetchedAt: "2026-04-19T00:00:00.000Z",
    stations,
  };
}

function writeFixture(dir: string, file: WeatherDayFile): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${file.date}.json`), JSON.stringify(file));
}

/** Build an hourly row at the given hourStartMs with the supplied fields. */
function hour(hourStartMs: number, overrides: Partial<{
  tempF: number | null;
  windMph: number | null;
  gustMph: number | null;
  windDeg: number | null;
  pressureHpa: number | null;
  cloudCoverPct: number | null;
  precipMm: number | null;
  humidityPct: number | null;
}> = {}) {
  return {
    hourStartMs,
    tempF: 60,
    windMph: 5,
    gustMph: 10,
    windDeg: 180,
    pressureHpa: 1015,
    cloudCoverPct: 50,
    precipMm: 0,
    humidityPct: 60,
    ...overrides,
  };
}

/** Make 24 hourly rows covering a Chicago-calendar day starting at local midnight. */
function hoursForDay(isoDate: string, overridesByHour: Record<number, Parameters<typeof hour>[1]> = {}) {
  const startMs = DateTime.fromISO(isoDate, { zone: TZ }).toMillis();
  const out = [];
  for (let h = 0; h < 24; h += 1) {
    out.push(hour(startMs + h * HOUR_MS, overridesByHour[h] ?? {}));
  }
  return out;
}

test("buildWeatherSnapshot: averages current hour across stations", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "weather-snap-"));
  const date = "2026-04-19";
  // Pick a "now" that clearly lands at 10:30 local on date.
  const nowMs = DateTime.fromISO(date, { zone: TZ }).plus({ hours: 10, minutes: 30 }).toMillis();

  const stations: WeatherDayFile["stations"] = {
    a: {
      lat: 1, lon: 2, label: "A",
      hourly: hoursForDay(date, { 10: { tempF: 50, pressureHpa: 1020, windDeg: 350, windMph: 4 } }),
    },
    b: {
      lat: 3, lon: 4, label: "B",
      hourly: hoursForDay(date, { 10: { tempF: 60, pressureHpa: 1022, windDeg: 10, windMph: 6 } }),
    },
  };
  writeFixture(dir, dayFile(date, stations));

  const snap = buildWeatherSnapshot({ nowMs, weatherDir: dir });
  assert.ok(snap, "snapshot should exist");
  assert.equal(snap!.stationsUsed, 2);
  assert.equal(snap!.tempF, 55); // (50+60)/2
  assert.equal(snap!.pressureHpa, 1021); // (1020+1022)/2
  assert.equal(snap!.windMph, 5);
  // Vector mean of 350° and 10° is ~0° (or ~360°); allow either.
  assert.ok(snap!.windDeg === 0 || snap!.windDeg === 360, `windDeg=${snap!.windDeg}`);
});

test("buildWeatherSnapshot: computes pressure trend 3h ago and classifies falling", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "weather-snap-"));
  const date = "2026-04-19";
  const nowMs = DateTime.fromISO(date, { zone: TZ }).plus({ hours: 10, minutes: 30 }).toMillis();

  writeFixture(
    dir,
    dayFile(date, {
      a: {
        lat: 1, lon: 2, label: "A",
        hourly: hoursForDay(date, {
          7: { pressureHpa: 1020 },
          10: { pressureHpa: 1018 },
        }),
      },
    }),
  );

  const snap = buildWeatherSnapshot({ nowMs, weatherDir: dir });
  assert.ok(snap);
  assert.equal(snap!.pressureHpa, 1018);
  assert.equal(snap!.pressureTrend.deltaHpa3h, -2);
  assert.equal(snap!.pressureTrend.direction, "falling");
});

test("buildWeatherSnapshot: rising classification (>+0.3 hPa/3h)", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "weather-snap-"));
  const date = "2026-04-19";
  const nowMs = DateTime.fromISO(date, { zone: TZ }).plus({ hours: 10, minutes: 0 }).toMillis();
  writeFixture(
    dir,
    dayFile(date, {
      a: {
        lat: 1, lon: 2, label: "A",
        hourly: hoursForDay(date, {
          7: { pressureHpa: 1015 },
          10: { pressureHpa: 1016.5 },
        }),
      },
    }),
  );
  const snap = buildWeatherSnapshot({ nowMs, weatherDir: dir })!;
  assert.equal(snap.pressureTrend.direction, "rising");
  assert.equal(snap.pressureTrend.deltaHpa3h, 1.5);
});

test("buildWeatherSnapshot: steady classification within ±0.3 hPa deadband", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "weather-snap-"));
  const date = "2026-04-19";
  const nowMs = DateTime.fromISO(date, { zone: TZ }).plus({ hours: 10 }).toMillis();
  writeFixture(
    dir,
    dayFile(date, {
      a: {
        lat: 1, lon: 2, label: "A",
        hourly: hoursForDay(date, {
          7: { pressureHpa: 1015.1 },
          10: { pressureHpa: 1015.3 },
        }),
      },
    }),
  );
  const snap = buildWeatherSnapshot({ nowMs, weatherDir: dir })!;
  assert.equal(snap.pressureTrend.direction, "steady");
});

test("buildWeatherSnapshot: skips null values when averaging", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "weather-snap-"));
  const date = "2026-04-19";
  const nowMs = DateTime.fromISO(date, { zone: TZ }).plus({ hours: 10 }).toMillis();
  writeFixture(
    dir,
    dayFile(date, {
      a: {
        lat: 1, lon: 2, label: "A",
        hourly: hoursForDay(date, { 10: { tempF: 70, pressureHpa: 1020 } }),
      },
      b: {
        lat: 3, lon: 4, label: "B",
        hourly: hoursForDay(date, { 10: { tempF: null, pressureHpa: null } }),
      },
    }),
  );
  const snap = buildWeatherSnapshot({ nowMs, weatherDir: dir })!;
  assert.equal(snap.stationsUsed, 2, "both rows were found");
  assert.equal(snap.tempF, 70, "only non-null temp counted");
  assert.equal(snap.pressureHpa, 1020);
});

test("buildWeatherSnapshot: falls back to yesterday's file when today's is missing", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "weather-snap-"));
  const today = "2026-04-19";
  const yesterday = "2026-04-18";
  // "now" is just past midnight on today (00:05), no today file yet.
  const nowMs = DateTime.fromISO(today, { zone: TZ }).plus({ minutes: 5 }).toMillis();

  writeFixture(
    dir,
    dayFile(yesterday, {
      a: {
        lat: 1, lon: 2, label: "A",
        hourly: hoursForDay(yesterday, { 23: { tempF: 42, pressureHpa: 1010 } }),
      },
    }),
  );

  const snap = buildWeatherSnapshot({ nowMs, weatherDir: dir });
  assert.ok(snap, "should fall back to yesterday's file");
  // No row in yesterday's file is <= nowMs AND within [hourStart, hourStart+1h) for "now";
  // the latest row with hourStartMs <= nowMs is 23:00 yesterday.
  assert.equal(snap!.stationsUsed, 1);
  assert.equal(snap!.tempF, 42);
});

test("buildWeatherSnapshot: returns null when no day files exist", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "weather-snap-"));
  const nowMs = DateTime.fromISO("2026-04-19", { zone: TZ }).plus({ hours: 10 }).toMillis();
  const snap = buildWeatherSnapshot({ nowMs, weatherDir: dir });
  assert.equal(snap, null);
});
