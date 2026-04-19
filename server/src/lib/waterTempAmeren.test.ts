import test from "node:test";
import assert from "node:assert/strict";
import { parseAmerenSurfaceWaterTemp } from "./waterTempAmeren.js";

const AMEREN_FIXTURE = `
<!doctype html>
<html><body>
  <div class="forecast">
    <table>
      <tr><td>Current Lake level is</td><td>657.1</td></tr>
      <tr><td>River Level is</td><td>553.7</td></tr>
      <tr><td>Surface Water Temp is</td><td>60</td></tr>
      <tr><td>HST Lake Level is</td><td>709.2</td></tr>
    </table>
  </div>
</body></html>
`;

const AMEREN_FIXTURE_INLINE = `
<div class="daily"><p>Surface Water Temp is 58</p></div>
`;

const AMEREN_FIXTURE_NO_LABEL = `
<!doctype html>
<html><body>
  <div class="forecast">
    <table>
      <tr><td>Current Lake level is</td><td>657.1</td></tr>
    </table>
  </div>
</body></html>
`;

test("parseAmerenSurfaceWaterTemp: structural table parse returns the value in the next cell", () => {
  assert.equal(parseAmerenSurfaceWaterTemp(AMEREN_FIXTURE), 60);
});

test("parseAmerenSurfaceWaterTemp: inline label + number in one element", () => {
  assert.equal(parseAmerenSurfaceWaterTemp(AMEREN_FIXTURE_INLINE), 58);
});

test("parseAmerenSurfaceWaterTemp: missing label returns null (no guessing)", () => {
  assert.equal(parseAmerenSurfaceWaterTemp(AMEREN_FIXTURE_NO_LABEL), null);
});

test("parseAmerenSurfaceWaterTemp: implausible values ignored", () => {
  const wild = "<div>Surface Water Temp is 200</div>";
  assert.equal(parseAmerenSurfaceWaterTemp(wild), null);
});

test("parseAmerenSurfaceWaterTemp: empty input returns null", () => {
  assert.equal(parseAmerenSurfaceWaterTemp(""), null);
  assert.equal(parseAmerenSurfaceWaterTemp(null as unknown as string), null);
});
