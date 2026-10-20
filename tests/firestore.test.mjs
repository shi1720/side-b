import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (enabled && !String(process.env.GOOGLE_CLOUD_PROJECT).startsWith("demo-"))
  throw new Error(
    "Firestore tests require an isolated demo-* emulator project.",
  );
let store, db, quota;
const owners = [];
async function modules() {
  if (!store) {
    store = await import("../lib/store.ts");
    db = (await import("../lib/firebase-admin.ts")).firestore();
    quota = (await import("../lib/qloo.ts")).quota;
  }
  return store;
}
async function fixture(quantity = 1) {
  await modules();
  const ownerId = "test_" + randomUUID();
  owners.push(ownerId);
  const generation = randomUUID();
  const stock = {
    sku: "A1",
    artist: "Test artist",
    title: "Test record",
    price: 30,
    cost: 15,
    quantity,
    daysOnShelf: 100,
    genre: "Jazz",
  };
  await db
    .collection("workspaces")
    .doc(ownerId)
    .set({
      name: "Test shop",
      currency: "USD",
      sample: true,
      pickupInstructions: "Demo only",
      inventory: [stock],
      generation,
      activeHolds: 0,
      campaignCount: 0,
      runCount: 0,
      createdAt: new Date().toISOString(),
    });
  const run = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    mode: "live",
    anchors: [],
    constraints: {
      count: 1,
      maxPrice: 40,
      minMargin: 0.25,
      minFit: 0.2,
      prioritizeAge: true,
    },
    items: [],
    selected: [
      {
        ...stock,
        fit: 1,
        margin: 0.5,
        objective: 0.8,
        evidence: [],
        selected: true,
      },
    ],
    steps: [],
    title: "Test collection",
    description: "Test",
    economics: {
      retail: 30,
      cost: 15,
      contribution: 15,
      margin: 0.5,
      agedUnits: 1,
    },
    baseline: { oldest: ["A1"], margin: ["A1"], culturalOverlap: 1 },
    warnings: [],
    calls: 0,
  };
  await store.saveAgentRun(ownerId, run, generation);
  const campaign = await store.publishCampaign(ownerId, { runId: run.id });
  return { ownerId, generation, stock, run, campaign };
}
const input = () => ({
  sku: "A1",
  customerName: "Test customer",
  quantity: 1,
  idempotencyKey: randomUUID(),
});
const state = async (ownerId) =>
  (await db.collection("workspaces").doc(ownerId).get()).data();
test.after(async () => {
  if (!enabled || !store) return;
  for (const ownerId of owners) {
    try {
      await store.deleteWorkspace(ownerId);
    } catch (error) {
      console.error("Fixture cleanup failed", error.message);
    }
  }
  await db.terminate();
});
const options = { skip: !enabled, timeout: 60000 };
test(
  "Firestore concurrent last-unit requests cannot oversell",
  options,
  async () => {
    const f = await fixture();
    const result = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        store.reserveRecord(f.campaign.id, input(), "last-" + i),
      ),
    );
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    const ws = await state(f.ownerId);
    assert.equal(ws.inventory[0].quantity, 0);
    assert.equal(ws.activeHolds, 1);
    assert.equal(
      (
        await db
          .collection("workspaces")
          .doc(f.ownerId)
          .collection("reservations")
          .get()
      ).size,
      1,
    );
  },
);
test(
  "Firestore concurrent duplicate requests return one reservation and one decrement",
  options,
  async () => {
    const f = await fixture(2);
    const payload = input();
    const result = await Promise.all([
      store.reserveRecord(f.campaign.id, payload, "same"),
      store.reserveRecord(f.campaign.id, payload, "same"),
    ]);
    assert.equal(result[0].id, result[1].id);
    assert.equal((await state(f.ownerId)).inventory[0].quantity, 1);
    await assert.rejects(
      () =>
        store.reserveRecord(
          f.campaign.id,
          { ...payload, customerName: "Different customer" },
          "same",
        ),
      (e) => e.status === 409,
    );
  },
);
test(
  "Firestore cancellation racing expiry restores stock exactly once",
  options,
  async () => {
    const f = await fixture();
    const held = await store.reserveRecord(f.campaign.id, input(), "expiry");
    await db
      .collection("workspaces")
      .doc(f.ownerId)
      .collection("reservations")
      .doc(held.id)
      .update({ expiresAt: Date.now() - 1 });
    await Promise.all([
      store.expireHolds(f.ownerId),
      store.transitionReservation(f.ownerId, held.id, "cancelled"),
    ]);
    assert.equal((await state(f.ownerId)).inventory[0].quantity, 1);
    assert.equal((await state(f.ownerId)).activeHolds, 0);
    await store.expireHolds(f.ownerId);
    assert.equal((await state(f.ownerId)).inventory[0].quantity, 1);
  },
);
test(
  "Firestore collected reservation stays consumed and cannot be cancelled or changed by another owner",
  options,
  async () => {
    const f = await fixture();
    const other = await fixture();
    const held = await store.reserveRecord(f.campaign.id, input(), "collected");
    await assert.rejects(
      () => store.transitionReservation(other.ownerId, held.id, "cancelled"),
      (e) => e.status === 404,
    );
    await store.transitionReservation(f.ownerId, held.id, "collected");
    await store.transitionReservation(f.ownerId, held.id, "collected");
    await assert.rejects(
      () => store.transitionReservation(f.ownerId, held.id, "cancelled"),
      (e) => e.status === 409,
    );
    assert.equal((await state(f.ownerId)).inventory[0].quantity, 0);
  },
);
test(
  "Firestore inventory replacement racing a hold cannot invalidate held stock",
  options,
  async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      store.reserveRecord(f.campaign.id, input(), "replacement"),
      store.replaceInventory(
        f.ownerId,
        [{ ...f.stock, title: "Different record" }],
        false,
      ),
    ]);
    assert.ok(results.some((r) => r.status === "rejected"));
    const ws = await state(f.ownerId);
    if (ws.activeHolds) {
      assert.equal(ws.inventory[0].title, f.stock.title);
      assert.equal(ws.inventory[0].quantity, 0);
    } else assert.equal(ws.inventory[0].title, "Different record");
  },
);
test(
  "Firestore pause hides public collection and blocks new holds while existing holds survive",
  options,
  async () => {
    const f = await fixture(2);
    const held = await store.reserveRecord(f.campaign.id, input(), "pause");
    await store.setCampaignPublished(f.ownerId, f.campaign.id, false);
    await assert.rejects(
      () => store.publicCampaign(f.campaign.id),
      (e) => e.status === 404,
    );
    await assert.rejects(
      () => store.reserveRecord(f.campaign.id, input(), "paused"),
      (e) => e.status === 404,
    );
    await store.transitionReservation(f.ownerId, held.id, "cancelled");
    assert.equal((await state(f.ownerId)).inventory[0].quantity, 2);
    await store.setCampaignPublished(f.ownerId, f.campaign.id, true);
    assert.equal(
      (await store.publicCampaign(f.campaign.id)).inventory[0].quantity,
      2,
    );
  },
);
test(
  "Firestore public responses omit private data; reset invalidates old runs",
  options,
  async () => {
    const f = await fixture();
    const view = await store.publicCampaign(f.campaign.id);
    const encoded = JSON.stringify(view);
    for (const key of ['"cost"', '"economics"', '"ownerId"', '"customerName"'])
      assert.ok(!encoded.includes(key), key);
    await store.deleteWorkspace(f.ownerId);
    await assert.rejects(
      () => store.publicCampaign(f.campaign.id),
      (e) => e.status === 404,
    );
    const fresh = await fixture();
    await db
      .collection("workspaces")
      .doc(f.ownerId)
      .set({ ...(await state(fresh.ownerId)), generation: randomUUID() });
    await assert.rejects(
      () =>
        store.saveAgentRun(
          f.ownerId,
          { ...f.run, id: randomUUID() },
          f.generation,
        ),
      (e) => e.status === 409,
    );
  },
);
test(
  "Firestore quota is atomic under concurrent requests",
  options,
  async () => {
    await modules();
    const key = "audit-quota-" + randomUUID();
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, () => quota(key, 3, 60)),
    );
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 3);
    assert.ok(
      attempts
        .filter((r) => r.status === "rejected")
        .every((r) => r.reason.status === 429),
    );
  },
);
test(
  "Firestore limiter resets expired windows and writes a real TTL timestamp",
  options,
  async () => {
    await modules();
    const key = "expired-quota-" + randomUUID();
    const { createHash } = await import("node:crypto");
    const ref = db
      .collection("rate_limits")
      .doc(createHash("sha256").update(key).digest("hex"));
    await ref.set({ count: 99, expiresAt: Date.now() - 1 });
    await quota(key, 1, 60);
    const value = (await ref.get()).data();
    assert.equal(value.count, 1);
    assert.equal(typeof value.cleanupAt.toDate, "function");
    assert.ok(value.cleanupAt.toMillis() > Date.now());
    await ref.delete();
  },
);
test(
  "Firestore legacy sample pickup sentinel never becomes real-shop pickup instructions",
  options,
  async () => {
    const f = await fixture();
    const legacy =
      "Demo collection only " +
      String.fromCharCode(8212) +
      " no real stock or pickup.";
    await db
      .collection("workspaces")
      .doc(f.ownerId)
      .update({ pickupInstructions: legacy });
    await store.replaceInventory(f.ownerId, [f.stock], false);
    assert.equal((await state(f.ownerId)).pickupInstructions, "");
    await assert.rejects(
      () => store.publishCampaign(f.ownerId, { runId: f.run.id }),
      (e) => e.status === 409,
    );
    await assert.rejects(
      () => store.updateWorkspace(f.ownerId, { pickupInstructions: legacy }),
      (e) => e.status === 409,
    );
    await store.updateWorkspace(f.ownerId, {
      pickupInstructions: "123 Test Street. Collect noon to6pm.",
    });
    const campaign = await store.publishCampaign(f.ownerId, {
      runId: f.run.id,
    });
    assert.equal(
      (await store.publicCampaign(campaign.id)).shop.pickupInstructions,
      "123 Test Street. Collect noon to6pm.",
    );
  },
);
