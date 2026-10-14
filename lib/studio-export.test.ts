import { test } from "node:test";
import assert from "node:assert/strict";
import { exportWithReward } from "./studio-export.ts";
const png = () => Promise.resolve(new Blob(["png"], { type: "image/png" }));
test("PNG generation failure never starts or completes a reward", async () => {
  let calls = 0;
  await assert.rejects(() =>
    exportWithReward(
      async () => {
        throw new Error("tainted canvas");
      },
      async () => {},
      async () => {
        calls++;
        return { token: "x" };
      },
      async () => {
        calls++;
        return { awarded: 100 };
      },
    ),
  );
  assert.equal(calls, 0);
});
test("failed download handoff does not complete mission", async () => {
  let completions = 0;
  await assert.rejects(() =>
    exportWithReward(
      png,
      async () => {
        throw new Error("download failed");
      },
      async () => ({ token: "x" }),
      async () => {
        completions++;
        return { awarded: 100 };
      },
    ),
  );
  assert.equal(completions, 0);
});
test("completion follows successful handoff, repeat downloads remain possible", async () => {
  const order: string[] = [];
  for (let i = 0; i < 2; i++) {
    const r = await exportWithReward(
      png,
      async () => {
        order.push("handoff");
      },
      async () => {
        order.push("begin");
        return { token: "x" };
      },
      async () => {
        order.push("complete");
        return { awarded: i === 0 ? 100 : 0 };
      },
    );
    assert.equal(r.awarded, i === 0 ? 100 : 0);
  }
  assert.deepEqual(order, [
    "begin",
    "handoff",
    "complete",
    "begin",
    "handoff",
    "complete",
  ]);
});
test("reward service errors never block an export", async () => {
  let downloads = 0;
  const r = await exportWithReward(
    png,
    async () => {
      downloads++;
    },
    async () => {
      throw new Error("offline");
    },
    async () => ({ awarded: 100 }),
  );
  assert.equal(downloads, 1);
  assert.equal(r.awarded, 0);
  assert.equal(r.rewardError, true);
});
test("empty or non-PNG output cannot earn Ink", async () => {
  for (const blob of [
    new Blob([], { type: "image/png" }),
    new Blob(["jpg"], { type: "image/jpeg" }),
  ])
    await assert.rejects(() =>
      exportWithReward(
        async () => blob,
        async () => {},
        async () => ({ token: "x" }),
        async () => ({ awarded: 100 }),
      ),
    );
});
