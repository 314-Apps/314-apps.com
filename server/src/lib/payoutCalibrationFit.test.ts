import test from "node:test";
import assert from "node:assert/strict";
import {
  poolAdjacentViolators,
  buildCalibrationKnotsFromSamples,
  rawPercentBinIndex,
} from "./payoutCalibrationFit.js";

test("rawPercentBinIndex matches 10% bands", () => {
  assert.equal(rawPercentBinIndex(0), 0);
  assert.equal(rawPercentBinIndex(9.9), 0);
  assert.equal(rawPercentBinIndex(10), 1);
  assert.equal(rawPercentBinIndex(89.9), 8);
  assert.equal(rawPercentBinIndex(90), 9);
  assert.equal(rawPercentBinIndex(100), 9);
});

test("PAV enforces monotonicity", () => {
  const y = [0.8, 0.3, 0.9];
  const w = [10, 10, 10];
  const m = poolAdjacentViolators(y, w);
  assert.ok(m[0]! <= m[1]!);
  assert.ok(m[1]! <= m[2]!);
  assert.ok(Math.abs(m[0]! - 0.55) < 1e-9);
  assert.ok(Math.abs(m[1]! - 0.55) < 1e-9);
});

test("buildCalibrationKnotsFromSamples returns identity when too few samples", () => {
  const { file } = buildCalibrationKnotsFromSamples(
    [{ rawPercent: 50, paid: true }],
    { minSamplesTotal: 100 },
  );
  assert.deepEqual(file.knots, [
    [0, 0],
    [100, 100],
  ]);
});

test("buildCalibrationKnotsFromSamples produces monotone display knots", () => {
  const samples = Array.from({ length: 40 }, (_, i) => ({
    rawPercent: (i % 10) * 10 + 5,
    paid: i % 3 === 0,
  }));
  const { file } = buildCalibrationKnotsFromSamples(samples, { minSamplesTotal: 10 });
  let lastY = -1;
  for (const [, y] of file.knots) {
    assert.ok(y >= lastY);
    lastY = y;
  }
});
