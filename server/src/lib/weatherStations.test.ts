import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadWeatherStations, parseWeatherStations } from "./weatherStations.js";

test("parseWeatherStations: _readme and _aliases are ignored, entries normalized to {lat, lon}", () => {
  const file = {
    _readme: "ignore me",
    _aliases: { "ivy bend resort": "ivy bend resort & marina" },
    "ivy bend resort & marina": { lat: 38.20242, lng: -92.98428, label: "Ivy Bend Resort & Marina" },
    "pb#2": { lat: 38.115605, lng: -92.668627, label: "PB#2" },
  };
  const stations = parseWeatherStations(file as never);
  assert.equal(stations.length, 2);
  const keys = stations.map((s) => s.key).sort();
  assert.deepEqual(keys, ["ivy bend resort & marina", "pb#2"]);
  const ivy = stations.find((s) => s.key === "ivy bend resort & marina")!;
  assert.equal(ivy.lat, 38.20242);
  assert.equal(ivy.lon, -92.98428);
  assert.equal(ivy.label, "Ivy Bend Resort & Marina");
});

test("parseWeatherStations: entries missing lat/lng are skipped (no crash)", () => {
  const file = {
    "broken": { label: "no coords" },
    "also broken": { lat: "not a number", lng: 0 },
    "good": { lat: 38.1, lng: -92.7 },
  };
  const stations = parseWeatherStations(file as never);
  assert.equal(stations.length, 1);
  assert.equal(stations[0]!.key, "good");
});

test("loadWeatherStations: loads real data file from disk", () => {
  const stations = loadWeatherStations();
  assert.ok(stations.length >= 5, `expected >= 5 stations, got ${stations.length}`);
  for (const s of stations) {
    assert.ok(!s.key.startsWith("_"), `station key should not start with _: ${s.key}`);
    assert.ok(Number.isFinite(s.lat), `lat must be finite for ${s.key}`);
    assert.ok(Number.isFinite(s.lon), `lon must be finite for ${s.key}`);
  }
});

test("loadWeatherStations: accepts a custom path", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "weather-stations-test-"));
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "locs.json");
  writeFileSync(
    file,
    JSON.stringify({
      _readme: "x",
      foo: { lat: 1, lng: 2, label: "Foo" },
    }),
    "utf8",
  );
  const stations = loadWeatherStations(file);
  assert.equal(stations.length, 1);
  assert.equal(stations[0]!.key, "foo");
});
