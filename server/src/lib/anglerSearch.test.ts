import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DateTime } from "luxon";
import { searchAnglers } from "./anglerSearch.js";

const TZ = "America/Chicago";

function ctMs(iso: string): number {
  return DateTime.fromISO(iso, { zone: TZ }).toMillis();
}

interface RowInput {
  name: string;
  weighStation: string;
  weightLb: number;
  rank?: string;
  anglerKey?: string;
  fishEntryKey?: string;
}

function enrichRow(r: RowInput) {
  const anglerKey =
    r.anglerKey ?? `${r.name.toLowerCase()}|${r.weighStation.toLowerCase()}`;
  const fishEntryKey = r.fishEntryKey ?? `${anglerKey}|${r.weightLb}`;
  return {
    rank: r.rank ?? "",
    name: r.name,
    weighStation: r.weighStation,
    weightRaw: r.weightLb.toFixed(2),
    weightLb: r.weightLb,
    anglerKey,
    fishEntryKey,
  };
}

interface SnapInput {
  fetchedAtMs: number;
  tournamentDay?: "Saturday" | "Sunday" | null;
  periods: { day: "Saturday" | "Sunday"; label: string; rows: RowInput[] }[];
}

function snapLine(s: SnapInput): string {
  const record = {
    schemaVersion: 2,
    capturedAt: new Date(s.fetchedAtMs).toISOString(),
    fetchedAtMs: s.fetchedAtMs,
    sourceUrl: "test://",
    tournamentDay: s.tournamentDay ?? null,
    activeWindow: null,
    periods: s.periods.map((p) => ({
      day: p.day,
      h2: p.label,
      label: p.label,
      rows: p.rows.map(enrichRow),
    })),
    payoutConsiderFloor: {},
  };
  return JSON.stringify(record);
}

function makeDir(files: Record<string, SnapInput[]>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "angler-search-"));
  for (const [name, snaps] of Object.entries(files)) {
    const full = path.join(dir, name);
    writeFileSync(full, snaps.map(snapLine).join("\n") + "\n", "utf8");
  }
  return dir;
}

test("searchAnglers: case-insensitive substring match", () => {
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: ctMs("2026-04-18T07:00:00"),
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [
              { name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 },
              { name: "Jim Gianladis", weighStation: "Red Oak Resort", weightLb: 3.5 },
            ],
          },
        ],
      },
    ],
  });
  try {
    const lowerHit = searchAnglers({ q: "curt", dir });
    assert.equal(lowerHit.length, 1);
    assert.equal(lowerHit[0]!.displayName, "Ian Curtis");

    const upperHit = searchAnglers({ q: "CURTIS", dir });
    assert.equal(upperHit.length, 1);
    assert.equal(upperHit[0]!.anglerKey, "ian curtis|alhonna resort");

    const spaceHit = searchAnglers({ q: "ian cur", dir });
    assert.equal(spaceHit.length, 1);

    const noHit = searchAnglers({ q: "nobody", dir });
    assert.equal(noHit.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: empty query returns no results", () => {
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: ctMs("2026-04-18T07:00:00"),
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [{ name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 }],
          },
        ],
      },
    ],
  });
  try {
    assert.equal(searchAnglers({ q: "", dir }).length, 0);
    assert.equal(searchAnglers({ q: "   ", dir }).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: dedupes by fishEntryKey and keeps earliest snapshot", () => {
  const early = ctMs("2026-04-18T07:05:00");
  const mid = ctMs("2026-04-18T07:30:00");
  const late = ctMs("2026-04-18T08:45:00");
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: mid,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [{ name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 }],
          },
        ],
      },
      {
        fetchedAtMs: early,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [{ name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 }],
          },
        ],
      },
      {
        fetchedAtMs: late,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [{ name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 }],
          },
        ],
      },
    ],
  });
  try {
    const hits = searchAnglers({ q: "ian", dir });
    assert.equal(hits.length, 1);
    const a = hits[0]!;
    assert.equal(a.fishCount, 1);
    assert.equal(a.fish.length, 1);
    assert.equal(a.fish[0]!.firstSeenAtMs, early);
    assert.equal(a.totalWeightLb, 4.63);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: multiple distinct fish (e.g. culls) appear as separate entries", () => {
  const t1 = ctMs("2026-04-18T07:05:00");
  const t2 = ctMs("2026-04-18T08:00:00");
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: t1,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [{ name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 3.1 }],
          },
        ],
      },
      {
        fetchedAtMs: t2,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [
              { name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 3.1 },
              { name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 },
            ],
          },
        ],
      },
    ],
  });
  try {
    const hits = searchAnglers({ q: "ian", dir });
    assert.equal(hits.length, 1);
    const a = hits[0]!;
    assert.equal(a.fishCount, 2);
    assert.deepEqual(
      a.fish.map((f) => f.weightLb),
      [3.1, 4.63],
    );
    assert.deepEqual(
      a.fish.map((f) => f.firstSeenAtMs),
      [t1, t2],
    );
    assert.equal(a.totalWeightLb, 7.73);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: aggregates fish across multiple days", () => {
  const sat = ctMs("2026-04-18T07:05:00");
  const sun = ctMs("2026-04-19T07:30:00");
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: sat,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [{ name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 }],
          },
        ],
      },
    ],
    "2026-04-19.jsonl": [
      {
        fetchedAtMs: sun,
        tournamentDay: "Sunday",
        periods: [
          {
            day: "Sunday",
            label: "6:30am-9am",
            rows: [{ name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 3.9 }],
          },
        ],
      },
    ],
  });
  try {
    const hits = searchAnglers({ q: "ian", dir });
    assert.equal(hits.length, 1);
    const a = hits[0]!;
    assert.equal(a.fishCount, 2);
    assert.deepEqual(
      a.fish.map((f) => f.tournamentDate),
      ["2026-04-18", "2026-04-19"],
    );
    assert.deepEqual(
      a.fish.map((f) => f.periodDay),
      ["Saturday", "Sunday"],
    );
    assert.equal(a.totalWeightLb, 8.53);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: filters out period blocks whose day != snapshot tournamentDay", () => {
  const sat = ctMs("2026-04-18T07:05:00");
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: sat,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [{ name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 }],
          },
          {
            day: "Sunday",
            label: "6:30am-9am",
            rows: [
              { name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 },
            ],
          },
        ],
      },
    ],
  });
  try {
    const hits = searchAnglers({ q: "ian", dir });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.fishCount, 1);
    assert.equal(hits[0]!.fish[0]!.periodDay, "Saturday");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: groups by anglerKey (same name at two stations → two cards)", () => {
  const t = ctMs("2026-04-18T07:05:00");
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: t,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [
              { name: "Jim Smith", weighStation: "Alhonna Resort", weightLb: 3.1 },
              { name: "Jim Smith", weighStation: "Red Oak Resort", weightLb: 2.5 },
            ],
          },
        ],
      },
    ],
  });
  try {
    const hits = searchAnglers({ q: "jim smith", dir });
    assert.equal(hits.length, 2);
    const keys = hits.map((h) => h.anglerKey).sort();
    assert.deepEqual(keys, [
      "jim smith|alhonna resort",
      "jim smith|red oak resort",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: limit caps the number of anglers returned", () => {
  const t = ctMs("2026-04-18T07:05:00");
  const rows: RowInput[] = [];
  for (let i = 0; i < 5; i++) {
    rows.push({
      name: `Angler ${i}`,
      weighStation: "Alhonna Resort",
      weightLb: 2 + i * 0.1,
    });
  }
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: t,
        tournamentDay: "Saturday",
        periods: [{ day: "Saturday", label: "6:30am-9am", rows }],
      },
    ],
  });
  try {
    const hits = searchAnglers({ q: "angler", dir, limit: 3 });
    assert.equal(hits.length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: latestRank reflects the most recent snapshot that contained the fish", () => {
  const t1 = ctMs("2026-04-18T07:05:00");
  const t2 = ctMs("2026-04-18T07:30:00");
  const t3 = ctMs("2026-04-18T08:00:00");
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: t1,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [
              { rank: "1", name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 },
            ],
          },
        ],
      },
      {
        fetchedAtMs: t2,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [
              { rank: "1", name: "Other Person", weighStation: "Red Oak Resort", weightLb: 5.5 },
              { rank: "2", name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 },
            ],
          },
        ],
      },
      {
        fetchedAtMs: t3,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [
              { rank: "1", name: "Other Person", weighStation: "Red Oak Resort", weightLb: 5.5 },
              { rank: "2", name: "Yet Another", weighStation: "Alhonna Resort", weightLb: 4.7 },
              { rank: "3", name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 },
            ],
          },
        ],
      },
    ],
  });
  try {
    const hits = searchAnglers({ q: "curtis", dir });
    assert.equal(hits.length, 1);
    const f = hits[0]!.fish[0]!;
    assert.equal(f.firstSeenAtMs, t1);
    assert.equal(f.latestSeenAtMs, t3);
    assert.equal(f.latestRank, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: non-numeric rank becomes null", () => {
  const t = ctMs("2026-04-18T07:05:00");
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: t,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [
              { rank: "", name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 },
            ],
          },
        ],
      },
    ],
  });
  try {
    const hits = searchAnglers({ q: "curtis", dir });
    assert.equal(hits[0]!.fish[0]!.latestRank, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("searchAnglers: returns Chicago-local firstSeenIso", () => {
  const t = ctMs("2026-04-18T07:05:00");
  const dir = makeDir({
    "2026-04-18.jsonl": [
      {
        fetchedAtMs: t,
        tournamentDay: "Saturday",
        periods: [
          {
            day: "Saturday",
            label: "6:30am-9am",
            rows: [{ name: "Ian Curtis", weighStation: "Alhonna Resort", weightLb: 4.63 }],
          },
        ],
      },
    ],
  });
  try {
    const hits = searchAnglers({ q: "ian", dir });
    const iso = hits[0]!.fish[0]!.firstSeenIso;
    assert.match(iso, /^2026-04-18 07:05:00 /);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
