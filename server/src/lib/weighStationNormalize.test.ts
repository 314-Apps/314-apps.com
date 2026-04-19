import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalWeighStationKey,
  displayWeighStationFromRaw,
  formatWeighStationDisplay,
} from "./weighStationNormalize.js";

test("canonicalWeighStationKey merges # and & variants", () => {
  assert.equal(canonicalWeighStationKey("PB # 2"), "pb#2");
  assert.equal(canonicalWeighStationKey("pb#2"), "pb#2");
  assert.equal(canonicalWeighStationKey("  PB  #  2  "), "pb#2");
  assert.equal(canonicalWeighStationKey("PB2"), "pb#2");
  assert.equal(canonicalWeighStationKey("pb 2"), "pb#2");
  assert.equal(canonicalWeighStationKey("Foo & Bar"), "foo & bar");
  assert.equal(canonicalWeighStationKey("Foo&Bar"), "foo & bar");
  assert.equal(
    canonicalWeighStationKey("Ivy Bend Resort and Marina"),
    canonicalWeighStationKey("Ivy Bend Resort & Marina"),
  );
});

test("displayWeighStationFromRaw matches stable labels", () => {
  assert.equal(displayWeighStationFromRaw("ivy bend RESORT & marina"), "Ivy Bend Resort & Marina");
  assert.equal(displayWeighStationFromRaw("PB #2"), "PB#2");
  assert.equal(displayWeighStationFromRaw(""), "Unknown station");
});

test("formatWeighStationDisplay", () => {
  assert.equal(formatWeighStationDisplay("point randall resort"), "Point Randall Resort");
});
