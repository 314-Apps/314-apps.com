import test from "node:test";
import assert from "node:assert/strict";
import {
  calibratePayoutPercent,
  inverseCalibratePayoutPercent,
} from "./payoutCalibration.js";

test("calibrate maps raw endpoints through loaded knots", () => {
  assert.equal(calibratePayoutPercent(0), 0);
  assert.equal(calibratePayoutPercent(100), 100);
});

test("inverseCalibratePayoutPercent returns finite raw in valid range", () => {
  const r = inverseCalibratePayoutPercent(50);
  assert.ok(Number.isFinite(r));
  assert.ok(r >= 0 && r <= 100);
});
