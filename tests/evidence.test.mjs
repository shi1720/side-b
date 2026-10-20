import test from "node:test";
import assert from "node:assert/strict";
import { scoredEvidenceEntities } from "../lib/evidence.ts";
const id = "9A62B37E-9A6D-47DA-A6FD-9414FA7F7710";
test("unknown signal warning cannot turn a generic result list into evidence", () => {
  assert.throws(
    () =>
      scoredEvidenceEntities(
        {
          warnings: [{ type: "not_found", "signal.interests.entities": [id] }],
          results: {
            entities: [{ entity_id: "record", query: { affinity: 0.99 } }],
          },
        },
        id,
      ),
    /UNSCORABLE_SIGNAL/,
  );
});
test("entities without finite affinity are never treated as culturally scored", () => {
  const r = scoredEvidenceEntities(
    {
      results: {
        entities: [
          { entity_id: "generic", query: {} },
          { entity_id: "valid", query: { affinity: 0.8 } },
          { entity_id: "invalid", query: { affinity: NaN } },
        ],
      },
    },
    id,
  );
  assert.deepEqual(
    r.map((x) => x.entity_id),
    ["valid"],
  );
});
test("unrelated explainability warnings preserve valid affinity evidence", () => {
  const r = scoredEvidenceEntities(
    {
      warnings: [{ type: "explainability_not_available" }],
      results: { entities: [{ entity_id: "valid", query: { affinity: 0 } }] },
    },
    id,
  );
  assert.equal(r.length, 1);
});
test("duplicate upstream artist rows do not double-count one audience anchor", () => {
  const r = scoredEvidenceEntities(
    {
      results: {
        entities: [
          { entity_id: "abc", query: { affinity: 0.9 } },
          { entity_id: "ABC", query: { affinity: 0.8 } },
        ],
      },
    },
    id,
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].query.affinity, 0.9);
});
test("stock pool filtering happens before ranks are assigned", () => {
  const rows = scoredEvidenceEntities(
    {
      results: {
        entities: [
          { entity_id: "outsider", query: { affinity: 1 } },
          { entity_id: "stock", query: { affinity: 0.8 } },
        ],
      },
    },
    id,
    new Set(["STOCK"]),
  );
  assert.deepEqual(
    rows.map((r) => r.entity_id),
    ["stock"],
  );
});
test("malformed upstream entities and warning values cannot crash evidence parsing", () => {
  const rows = scoredEvidenceEntities(
    {
      warnings: [null, { "signal.interests.entities": [12, null] }],
      results: {
        entities: [
          null,
          { entity_id: 5 },
          { entity_id: "ok", query: { affinity: 0.5 } },
        ],
      },
    },
    id,
  );
  assert.deepEqual(
    rows.map((r) => r.entity_id),
    ["ok"],
  );
});
const { inputContributions, isSearchableName } =
  await import("../lib/evidence.ts");
test("optional attribution accepts only finite normalized entity contributions", () => {
  const values = inputContributions({
    "signal.interests.entities": [
      null,
      { entity_id: "a", score: 0.4 },
      { entity_id: "A", score: 0.9 },
      { entity_id: "b", score: 2 },
      { entity_id: "c", score: NaN },
      { entity_id: 8, score: 0.3 },
    ],
  });
  assert.deepEqual([...values], [["A", 0.4]]);
  assert.equal(
    inputContributions({ "signal.interests.entities": "malformed" }).size,
    0,
  );
});
test("inventory artist names outside upstream search bounds can remain unresolved without aborting stock analysis", () => {
  assert.equal(isSearchableName("X"), false);
  assert.equal(isSearchableName("A".repeat(81)), false);
  assert.equal(isSearchableName("Nick Drake"), true);
});
