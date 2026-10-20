import type {
  AgentRun,
  Constraints,
  Evidence,
  InventoryItem,
  TasteEntity,
} from "./types";
import { AppError } from "./errors";
import { entitiesFrom, qloo, searchEntities, UUID } from "./qloo";
import { optimizeInventory, rankFit } from "./optimizer";
import artistMap from "./artist-map.json";
import {
  scoredEvidenceEntities,
  inputContributions,
  isSearchableName,
} from "./evidence";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "");
export async function mapBounded<T, R>(
  items: T[],
  fn: (i: T) => Promise<R>,
  width = 2,
) {
  const output = new Array<R>(items.length);
  let next = 0,
    failed = false;
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      while (!failed && next < items.length) {
        const index = next++;
        try {
          output[index] = await fn(items[index]);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );
  return output;
}
export async function runAgent(
  inventory: InventoryItem[],
  inputAnchors: TasteEntity[],
  constraints: Constraints,
): Promise<AgentRun> {
  const steps: AgentRun["steps"] = [],
    warnings: string[] = [];
  let calls = 0;
  const start = Date.now();
  const anchors = await mapBounded(inputAnchors, async (anchor) => {
    const result = await searchEntities(anchor.name, anchor.kind);
    if (!result.cached) calls++;
    const found = result.entities.find(
      (e) => e.id.toUpperCase() === anchor.id.toUpperCase(),
    );
    if (!found)
      throw new AppError(
        `Please search for and select “${anchor.name}” again. Its Qloo identity could not be confirmed.`,
      );
    return found;
  });
  steps.push({
    tool: "resolve_audience",
    status: "done",
    detail: `Verified ${anchors.length} cultural ${anchors.length === 1 ? "anchor" : "anchors"} against Qloo search. No invented entity IDs.`,
    durationMs: Date.now() - start,
  });
  if (!inventory.length)
    throw new AppError("Add inventory before building a collection.");
  const resolutionStart = Date.now();
  const artistNames = [...new Set(inventory.map((i) => i.artist))];
  const resolved = await mapBounded(artistNames, async (name) => {
    const known = (artistMap as Record<string, { id: string; name: string }>)[
      normalize(name)
    ];
    if (known && UUID.test(known.id)) return { name, id: known.id };
    if (!isSearchableName(name)) return { name, id: undefined };
    const result = await searchEntities(name, "artist");
    if (!result.cached) calls++;
    const exact = result.entities.find(
      (e) => normalize(e.name) === normalize(name),
    );
    return { name, id: exact?.id };
  });
  const artistIds = new Map(
    resolved.filter((r) => r.id).map((r) => [r.name, r.id!]),
  );
  const enriched = inventory.map((i) => ({
    ...i,
    entityId: artistIds.get(i.artist),
  }));
  const unresolved = resolved.filter((r) => !r.id).map((r) => r.name);
  if (unresolved.length)
    warnings.push(
      `Not resolved in Qloo: ${unresolved.join(", ")}. These records remain in stock but cannot receive cultural evidence.`,
    );
  const pool = [...new Set([...artistIds.values()])].sort();
  if (pool.length < 3)
    warnings.push(
      "This is a very small artist pool. Relative rank-fit is coarse and should not be treated as strength of demand.",
    );
  if (!pool.length)
    throw new AppError(
      "None of the stocked artists could be resolved exactly in Qloo. Check artist spelling in your inventory.",
    );
  steps.push({
    tool: "inspect_stock",
    status: unresolved.length ? "warning" : "done",
    detail: `Resolved ${pool.length} stocked artists across ${inventory.length} SKUs. Candidate set restricted to your actual inventory.`,
    durationMs: Date.now() - resolutionStart,
  });
  const evidence = new Map<string, Evidence[]>();
  const queryStart = Date.now();
  await mapBounded(anchors, async (anchor) => {
    const result = await qloo(
      "/v2/insights",
      {
        "filter.type": "urn:entity:artist",
        "filter.results.entities": pool.join(","),
        "signal.interests.entities": anchor.id,
        "feature.explainability": "true",
        take: "50",
      },
      86400,
    );
    if (!result.cached) calls++;
    let entities;
    try {
      entities = scoredEvidenceEntities(result.data, anchor.id, new Set(pool));
    } catch {
      throw new AppError(
        `Qloo can find “${anchor.name}” but cannot use it as an affinity signal yet. Choose another cultural anchor.`,
        422,
      );
    }
    if (!entities.length)
      warnings.push(
        `Qloo returned no scored stock for ${anchor.name}. This anchor contributes zero cultural rank-fit.`,
      );
    let matched = 0;
    entities.forEach((e, index) => {
      if (!pool.includes(e.entity_id.toUpperCase())) return;
      const ev: Evidence = {
        anchorId: anchor.id,
        anchorName: anchor.name,
        rank: index + 1,
        poolSize: pool.length,
        score: typeof e.query?.affinity === "number" ? e.query.affinity : null,
        rankFit: rankFit(index + 1, pool.length),
        fetchedAt: result.fetchedAt,
        cached: result.cached,
      };
      for (const item of enriched.filter(
        (i) => i.entityId?.toUpperCase() === e.entity_id.toUpperCase(),
      )) {
        evidence.set(item.sku, [...(evidence.get(item.sku) ?? []), ev]);
        matched++;
      }
    });
    steps.push({
      tool: "qloo_inventory_affinity",
      status: matched ? "done" : "warning",
      detail: `${anchor.name} → stocked artists. ${matched} SKUs received evidence; ${result.cached ? "reused cached Qloo response" : "live Qloo response"}. Filter: ${pool.length} actual stocked artists.`,
    });
  });
  // A joint query adds Qloo's native attribution for multi-anchor audiences.
  // It is supplementary evidence; selection still uses documented marginal rank fusion.
  if (anchors.length > 1) {
    try {
      const joint = await qloo(
        "/v2/insights",
        {
          "filter.type": "urn:entity:artist",
          "filter.results.entities": pool.join(","),
          "signal.interests.entities": anchors.map((a) => a.id).join(","),
          "feature.explainability": "true",
          take: "50",
        },
        86400,
      );
      if (!joint.cached) calls++;
      const jointItems = entitiesFrom(joint.data);
      for (const entity of jointItems) {
        const contributions = inputContributions(entity.query?.explainability);
        for (const item of enriched.filter(
          (i) => i.entityId?.toUpperCase() === entity.entity_id.toUpperCase(),
        )) {
          for (const ev of evidence.get(item.sku) ?? []) {
            const contribution = contributions.get(ev.anchorId.toUpperCase());
            if (contribution !== undefined) ev.contribution = contribution;
          }
        }
      }
      steps.push({
        tool: "verify_joint_audience",
        status: "done",
        detail:
          "Queried the same stock pool with all audience anchors together and retained Qloo’s native input-contribution attribution where available. Missing attribution is unknown, not zero.",
      });
    } catch {
      warnings.push(
        "Joint audience attribution is temporarily unavailable. The collection still uses the verified per-anchor Qloo rankings.",
      );
      steps.push({
        tool: "verify_joint_audience",
        status: "warning",
        detail:
          "Optional joint attribution could not be retrieved. No contribution weights were invented; verified marginal rankings remain available.",
      });
    }
  }
  steps.push({
    tool: "fuse_cultural_ranks",
    status: "done",
    detail: `Combined within-pool rank scores across ${anchors.length} anchors. Missing results receive zero; raw Qloo affinities are retained separately and never averaged.`,
    durationMs: Date.now() - queryStart,
  });
  const { items, selected, economics } = optimizeInventory(
    enriched,
    evidence,
    anchors.length,
    constraints,
  );
  steps.push({
    tool: "optimize_collection",
    status: selected.length < constraints.count ? "warning" : "done",
    detail: `Selected ${selected.length}/${constraints.count} records with one per artist, price ≤ ${constraints.maxPrice}, gross margin ≥ ${Math.round(constraints.minMargin * 100)}%, rank-fit ≥ ${Math.round(constraints.minFit * 100)}. Stock age is a bounded preference; constraints never relaxed.`,
  });
  if (selected.length < constraints.count)
    warnings.push(
      `Only ${selected.length} records meet every constraint. Review the exclusion reasons, lower your fit floor, or increase the price cap; no unsuitable stock was silently added.`,
    );
  if (anchors.every((a) => a.kind === "artist"))
    warnings.push(
      "Add a film or book anchor to explore a cross-domain audience bridge.",
    );
  warnings.push(
    "Artist-level cultural affinity does not establish album-level taste, purchase intent, or sales uplift.",
  );
  const available = items.filter(
    (i) =>
      i.quantity > 0 &&
      i.price <= constraints.maxPrice &&
      i.margin >= constraints.minMargin,
  );
  const oldest = [...available]
    .sort((a, b) => b.daysOnShelf - a.daysOnShelf)
    .slice(0, constraints.count)
    .map((i) => i.sku);
  const margin = [...available]
    .sort((a, b) => b.price - b.cost - (a.price - a.cost))
    .slice(0, constraints.count)
    .map((i) => i.sku);
  const titles = anchors.map((a) => a.name);
  const title =
    titles.length === 1
      ? `For the love of ${titles[0]}`
      : `Where ${titles[0]} meets ${titles[1]}`;
  const description = `A ${selected.length}-record discovery from our shelves, connected by the cultural tastes around ${titles.join(" and ")}. Each selection has Qloo artist-affinity evidence and is available individually. Discover something beyond your usual bin.`;
  steps.push({
    tool: "prepare_storefront",
    status: "done",
    detail:
      "Created editable collection copy and an auditable decision receipt. Review before publishing. No message sent and no paid order placed.",
  });
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode: "live",
    anchors,
    constraints,
    items,
    selected,
    steps,
    title,
    description,
    economics,
    baseline: {
      oldest,
      margin,
      culturalOverlap: oldest.filter((sku) =>
        selected.some((i) => i.sku === sku),
      ).length,
    },
    warnings,
    calls,
  };
}
