import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalFishWeightLb,
  normalizeFishWeightForEntryKey,
} from "./fishEntryKeyUtils.js";

test("normalizeFishWeightForEntryKey collapses float noise", () => {
  assert.equal(normalizeFishWeightForEntryKey(4.33), normalizeFishWeightForEntryKey(4.329999999999999));
  assert.equal(
    normalizeFishWeightForEntryKey(3.125),
    normalizeFishWeightForEntryKey(3.1249999999999996),
  );
});

test("canonicalFishWeightLb matches key rounding", () => {
  assert.equal(Number(normalizeFishWeightForEntryKey(4.32999999)), canonicalFishWeightLb(4.32999999));
});
