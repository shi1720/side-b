/** Reject ungrounded fallback lists even when the upstream HTTP response is 200. */
export function scoredEvidenceEntities<T extends { entity_id: string; query?: { affinity?: number } }>(payload: { results: T[] | { entities?: T[] }; warnings?: { [key: string]: unknown }[] }, anchorId: string): T[] {
  const invalid=payload.warnings?.some(w=>Array.isArray(w['signal.interests.entities'])&&(w['signal.interests.entities'] as string[]).some(id=>id.toUpperCase()===anchorId.toUpperCase()));
  if(invalid) throw new Error('UNSCORABLE_SIGNAL');
  const results=Array.isArray(payload.results)?payload.results:payload.results.entities??[];
  const seen=new Set<string>();
  return results.filter(e=>{
    const id=e.entity_id.toUpperCase();
    if(seen.has(id)||typeof e.query?.affinity!=='number'||!Number.isFinite(e.query.affinity))return false;
    seen.add(id);return true;
  });
}
