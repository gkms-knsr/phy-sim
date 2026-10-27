import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTime, frameIndex, format } from "../src/clock.ts";
test("frame rate does not change simulated elapsed time", () => {
  const advance = (n: number) =>
    Array.from({ length: n }).reduce<number>(
      (t) => nextTime(t, 1 / n, 2, 30),
      0,
    );
  assert.ok(Math.abs(advance(30) - advance(144)) < 1e-12);
  assert.equal(frameIndex(advance(30), 1 / 120, 3601), 240);
});
test("clock clamps at boundaries and handles fixed steps", () => {
  assert.equal(nextTime(29, 2, 4, 30), 30);
  assert.equal(nextTime(1, -2, 1, 30), 1);
  assert.equal(frameIndex(1 / 120, 1 / 120, 3601), 1);
  assert.equal(frameIndex(50, 1 / 120, 3601), 3600);
  assert.equal(format(-0.0001), "0.00");
});
