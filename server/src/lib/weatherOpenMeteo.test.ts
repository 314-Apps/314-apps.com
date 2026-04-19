import test from "node:test";
import assert from "node:assert/strict";
import { parseOpenMeteoHourly } from "./weatherOpenMeteo.js";

test("parseOpenMeteoHourly: aligns hours and passes through native units", () => {
  const fixture = {
    hourly: {
      time: [1713589200, 1713592800, 1713596400],
      temperature_2m: [48.7, 46.1, 45.9],
      wind_speed_10m: [4.6, 4.1, 3.6],
      wind_direction_10m: [14, 9, 360],
      wind_gusts_10m: [11, 8.5, 6.9],
      pressure_msl: [1024.8, 1025, 1025.1],
      cloud_cover: [24, 9, 45],
      precipitation: [0, 0, 0],
      relative_humidity_2m: [61, 72, 78],
    },
  };

  const hours = parseOpenMeteoHourly(fixture);
  assert.equal(hours.length, 3);

  assert.equal(hours[0]!.hourStartMs, 1713589200_000);
  assert.equal(hours[0]!.tempF, 48.7);
  assert.equal(hours[0]!.windMph, 4.6);
  assert.equal(hours[0]!.gustMph, 11);
  assert.equal(hours[0]!.windDeg, 14);
  assert.equal(hours[0]!.pressureHpa, 1024.8);
  assert.equal(hours[0]!.cloudCoverPct, 24);
  assert.equal(hours[0]!.precipMm, 0);
  assert.equal(hours[0]!.humidityPct, 61);

  const delta1 = hours[1]!.hourStartMs - hours[0]!.hourStartMs;
  const delta2 = hours[2]!.hourStartMs - hours[1]!.hourStartMs;
  assert.equal(delta1, 3_600_000);
  assert.equal(delta2, 3_600_000);
});

test("parseOpenMeteoHourly: null fields stay null, not NaN", () => {
  const fixture = {
    hourly: {
      time: [1713589200],
      temperature_2m: [null],
      wind_speed_10m: [null],
      wind_direction_10m: [null],
      wind_gusts_10m: [null],
      pressure_msl: [null],
      cloud_cover: [null],
      precipitation: [null],
      relative_humidity_2m: [null],
    },
  };
  const hours = parseOpenMeteoHourly(fixture);
  assert.equal(hours.length, 1);
  assert.equal(hours[0]!.tempF, null);
  assert.equal(hours[0]!.windMph, null);
  assert.equal(hours[0]!.gustMph, null);
  assert.equal(hours[0]!.windDeg, null);
  assert.equal(hours[0]!.pressureHpa, null);
  assert.equal(hours[0]!.cloudCoverPct, null);
  assert.equal(hours[0]!.precipMm, null);
  assert.equal(hours[0]!.humidityPct, null);
});

test("parseOpenMeteoHourly: missing hourly block returns []", () => {
  assert.deepEqual(parseOpenMeteoHourly({}), []);
  assert.deepEqual(parseOpenMeteoHourly(null), []);
  assert.deepEqual(parseOpenMeteoHourly({ hourly: { time: null } }), []);
});
