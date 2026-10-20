/** Reject ungrounded fallback lists even when the upstream HTTP response is 200. */
export function scoredEvidenceEntities<
  T extends { entity_id: string; query?: { affinity?: number } },
>(
  payload: {
    results: T[] | { entities?: T[] };
    warnings?: { [key: string]: unknown }[];
  },
  anchorId: string,
  allowedIds?: ReadonlySet<string>,
): T[] {
  const invalid =
    Array.isArray(payload?.warnings) &&
    payload.warnings.some(
      (w) =>
        w &&
        Array.isArray(w["signal.interests.entities"]) &&
        (w["signal.interests.entities"] as unknown[]).some(
          (id) =>
            typeof id === "string" &&
            id.toUpperCase() === anchorId.toUpperCase(),
        ),
    );
  if (invalid) throw new Error("UNSCORABLE_SIGNAL");
  const results = Array.isArray(payload?.results)
    ? payload.results
    : payload?.results?.entities;
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  return results.filter((e) => {
    if (!e || typeof e.entity_id !== "string") return false;
    const id = e.entity_id.toUpperCase();
    if (
      seen.has(id) ||
      (allowedIds && !allowedIds.has(id)) ||
      typeof e.query?.affinity !== "number" ||
      !Number.isFinite(e.query.affinity)
    )
      return false;
    seen.add(id);
    return true;
  });
}
/** Native attribution is optional and must be a finite normalized contribution, never a forecast. */
export function inputContributions(
  explainability: unknown,
): Map<string, number> {
  const output = new Map<string, number>();
  if (!explainability || typeof explainability !== "object") return output;
  const list = (explainability as Record<string, unknown>)[
    "signal.interests.entities"
  ];
  if (!Array.isArray(list)) return output;
  for (const item of list) {
    if (
      !item ||
      typeof item.entity_id !== "string" ||
      typeof item.score !== "number" ||
      !Number.isFinite(item.score) ||
      item.score < 0 ||
      item.score > 1
    )
      continue;
    const id = item.entity_id.toUpperCase();
    if (!output.has(id)) output.set(id, item.score);
  }
  return output;
}
export function isSearchableName(name: string) {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}
