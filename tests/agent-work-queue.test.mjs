import test from "node:test";
import assert from "node:assert/strict";
import { mapBounded } from "../lib/agent.ts";
test("a failed agent tool stops scheduling new upstream jobs while an existing call finishes", async () => {
  const started = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const run = mapBounded(
    [0, 1, 2, 3, 4],
    async (item) => {
      started.push(item);
      if (item === 0) throw new Error("upstream unavailable");
      await gate;
      return item;
    },
    2,
  );
  await assert.rejects(() => run, /upstream unavailable/);
  release();
  await new Promise(setImmediate);
  assert.deepEqual(started, [0, 1]);
});
test("bounded work preserves input ordering despite completion order", async () => {
  const result = await mapBounded(
    [3, 2, 1],
    async (item) => {
      await new Promise(setImmediate);
      return item * 2;
    },
    2,
  );
  assert.deepEqual(result, [6, 4, 2]);
});
