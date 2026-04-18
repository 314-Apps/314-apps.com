import test from "node:test";
import assert from "node:assert/strict";
import {
  calibratePayoutPercent,
  inverseCalibratePayoutPercent,
} from "./payoutCalibration.js";

test("identity calibration round-trips", () => {
  assert.equal(calibratePayoutPercent(37), 37);
  assert.equal(inverseCalibratePayoutPercent(37), 37);
});
