import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { extractArrivalsFromSnapshots, type FishArrival } from "./fishArrivals.js";
import type { TrainingSnapshotRecord } from "./trainingCapture.js";

const TZ = "America/Chicago";

function ctMs(iso: string): number {
  return DateTime.fromISO(iso, { zone: TZ }).toMillis();
}

interface MiniRow {
  name: string;
  weighStation: string;
  weightLb: number;
  anglerKey?: string;
  fishEntryKey?: string;
}

function makeSnap(args: {
  dayKind: "Saturday" | "Sunday";
  fetchedAtMs: number;
  periods: {
    day: "Saturday" | "Sunday";
    label: string;
    rows: MiniRow[];
  }[];
}): TrainingSnapshotRecord {
  return {
    schemaVersion: 2,
    capturedAt: new Date(args.fetchedAtMs).toISOString(),
    fetchedAtMs: args.fetchedAtMs,
    sourceUrl: "test://",
    tournamentDay: args.dayKind,
    activeWindow: null,
    periods: args.periods.map((p) => ({
      day: p.day,
      h2: p.label,
      label: p.label,
      rows: p.rows.map((r) => ({
        rank: "",
        name: r.name,
        weighStation: r.weighStation,
        weightRaw: String(r.weightLb),
        weightLb: r.weightLb,
        anglerKey: r.anglerKey ?? `${r.name.toLowerCase()}|${r.weighStation.toLowerCase()}`,
        fishEntryKey:
          r.fishEntryKey ??
          `${r.name.toLowerCase()}|${r.weighStation.toLowerCase()}|${r.weightLb}`,
      })),
    })),
    payoutConsiderFloor: {} as never,
  } as TrainingSnapshotRecord;
}

test("extractArrivalsFromSnapshots: first-seen ordering and priorFetchedMs bracket", () => {
  const s1 = ctMs("2026-04-18T07:00:00");
  const s2 = ctMs("2026-04-18T07:30:00");
  const s3 = ctMs("2026-04-18T08:00:00");

  const snaps: TrainingSnapshotRecord[] = [
    makeSnap({
      dayKind: "Saturday",
      fetchedAtMs: s1,
      periods: [
        {
          day: "Saturday",
          label: "6:30am-9:00am",
          rows: [{ name: "Alice", weighStation: "PB#2", weightLb: 4.2 }],
        },
      ],
    }),
    makeSnap({
      dayKind: "Saturday",
      fetchedAtMs: s2,
      periods: [
        {
          day: "Saturday",
          label: "6:30am-9:00am",
          rows: [
            { name: "Alice", weighStation: "PB#2", weightLb: 4.2 },
            { name: "Bob", weighStation: "PB#2", weightLb: 3.9 },
          ],
        },
      ],
    }),
    makeSnap({
      dayKind: "Saturday",
      fetchedAtMs: s3,
      periods: [
        {
          day: "Saturday",
          label: "6:30am-9:00am",
          rows: [
            { name: "Alice", weighStation: "PB#2", weightLb: 4.2 },
            { name: "Bob", weighStation: "PB#2", weightLb: 3.9 },
            { name: "Carol", weighStation: "Alhonna Resort & Marina", weightLb: 5.1 },
          ],
        },
      ],
    }),
  ];

  const arrivals = extractArrivalsFromSnapshots(snaps);
  assert.equal(arrivals.length, 3);

  const byName = Object.fromEntries(arrivals.map((a) => [a.name, a])) as Record<
    string,
    FishArrival
  >;
  assert.equal(byName["Alice"]!.firstSeenMs, s1);
  assert.equal(byName["Alice"]!.priorFetchedMs, null);
  assert.equal(byName["Bob"]!.firstSeenMs, s2);
  assert.equal(byName["Bob"]!.priorFetchedMs, s1);
  assert.equal(byName["Carol"]!.firstSeenMs, s3);
  assert.equal(byName["Carol"]!.priorFetchedMs, s2);

  const aliceF = byName["Alice"]!.fractionElapsedAtFirstSeen!;
  const bobF = byName["Bob"]!.fractionElapsedAtFirstSeen!;
  assert.ok(aliceF > 0.15 && aliceF < 0.25, `expected Alice fraction ~0.2, got ${aliceF}`);
  assert.ok(bobF > 0.35 && bobF < 0.45, `expected Bob fraction ~0.4, got ${bobF}`);

  for (let i = 1; i < arrivals.length; i += 1) {
    assert.ok(arrivals[i - 1]!.firstSeenMs <= arrivals[i]!.firstSeenMs);
  }
});

test("extractArrivalsFromSnapshots: cull (same angler, different weight) emits two arrivals", () => {
  const s1 = ctMs("2026-04-18T07:10:00");
  const s2 = ctMs("2026-04-18T08:15:00");

  const snaps: TrainingSnapshotRecord[] = [
    makeSnap({
      dayKind: "Saturday",
      fetchedAtMs: s1,
      periods: [
        {
          day: "Saturday",
          label: "6:30am-9:00am",
          rows: [{ name: "Alice", weighStation: "PB#2", weightLb: 3.5 }],
        },
      ],
    }),
    makeSnap({
      dayKind: "Saturday",
      fetchedAtMs: s2,
      periods: [
        {
          day: "Saturday",
          label: "6:30am-9:00am",
          rows: [{ name: "Alice", weighStation: "PB#2", weightLb: 4.2 }],
        },
      ],
    }),
  ];

  const arrivals = extractArrivalsFromSnapshots(snaps);
  assert.equal(arrivals.length, 2);
  const weights = arrivals.map((a) => a.weightLb).sort((a, b) => a - b);
  assert.deepEqual(weights, [3.5, 4.2]);
  assert.ok(arrivals.every((a) => a.anglerKey === arrivals[0]!.anglerKey));
});

test("extractArrivalsFromSnapshots: wrong-day period blocks are ignored", () => {
  const sat = ctMs("2026-04-18T07:00:00");

  const snaps: TrainingSnapshotRecord[] = [
    makeSnap({
      dayKind: "Saturday",
      fetchedAtMs: sat,
      periods: [
        {
          day: "Saturday",
          label: "6:30am-9:00am",
          rows: [{ name: "Alice", weighStation: "PB#2", weightLb: 4.2 }],
        },
        {
          day: "Sunday",
          label: "9:01am-11:00am",
          rows: [{ name: "Ghost", weighStation: "PB#2", weightLb: 9.9 }],
        },
      ],
    }),
  ];

  const arrivals = extractArrivalsFromSnapshots(snaps);
  assert.equal(arrivals.length, 1);
  assert.equal(arrivals[0]!.name, "Alice");
  assert.equal(arrivals[0]!.day, "Saturday");
  assert.equal(arrivals[0]!.windowId, 1);
});

test("extractArrivalsFromSnapshots: separate windows track separately", () => {
  const s1 = ctMs("2026-04-18T07:00:00");
  const s2 = ctMs("2026-04-18T10:00:00");

  const snaps: TrainingSnapshotRecord[] = [
    makeSnap({
      dayKind: "Saturday",
      fetchedAtMs: s1,
      periods: [
        {
          day: "Saturday",
          label: "6:30am-9:00am",
          rows: [{ name: "Alice", weighStation: "PB#2", weightLb: 4.2 }],
        },
      ],
    }),
    makeSnap({
      dayKind: "Saturday",
      fetchedAtMs: s2,
      periods: [
        {
          day: "Saturday",
          label: "9:01am-11:00am",
          rows: [{ name: "Alice", weighStation: "PB#2", weightLb: 4.2 }],
        },
      ],
    }),
  ];

  const arrivals = extractArrivalsFromSnapshots(snaps);
  assert.equal(arrivals.length, 2);
  const windows = arrivals.map((a) => a.windowId).sort();
  assert.deepEqual(windows, [1, 2]);
  assert.ok(arrivals.every((a) => a.priorFetchedMs === null));
});
