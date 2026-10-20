import type { Constraints, Evidence, InventoryItem, ScoredItem } from './types';

export function cents(value: number) { return Math.round(value * 100); }
export function money(value: number) { return Math.round(value * 100) / 100; }
export function rankFit(rank: number, poolSize: number) {
  return poolSize <= 1 ? 1 : Math.max(0, Math.min(1, 1 - (rank - 1) / (poolSize - 1)));
}

/** Rank fusion is a merchandising heuristic, never a purchase probability. */
export function optimizeInventory(inventory: InventoryItem[], evidence: Map<string, Evidence[]>, anchorCount: number, c: Constraints) {
  const scored: ScoredItem[] = inventory.map(item => {
    const ev = evidence.get(item.sku) ?? [];
    const fit = ev.reduce((sum,e) => sum + e.rankFit,0) / Math.max(1,anchorCount);
    const margin = item.price > 0 ? (cents(item.price) - cents(item.cost)) / cents(item.price) : 0;
    // Culture dominates; age is a bounded preference after all hard constraints.
    const objective = .8 * fit + (c.prioritizeAge ? .15 * Math.min(item.daysOnShelf / 365,1) : 0) + .05 * Math.max(0,margin);
    const exclusion = item.quantity < 1 ? 'Out of stock'
      : cents(item.price) > cents(c.maxPrice) ? 'Above per-record price cap'
      : margin + 1e-9 < c.minMargin ? 'Below gross margin floor'
      : !ev.length ? 'No Qloo affinity returned for this artist'
      : fit + 1e-9 < c.minFit ? 'Below cultural rank-fit floor'
      : undefined;
    return {...item,fit,margin,objective,evidence:ev,selected:false,exclusion};
  });
  const ranked = [...scored].filter(i=>!i.exclusion).sort((a,b)=>b.objective-a.objective || a.sku.localeCompare(b.sku));
  const artists = new Set<string>();
  let selectedCount=0;
  for (const item of ranked) {
    const artist = (item.entityId || item.artist).toLowerCase();
    if (artists.has(artist)) item.exclusion='Artist already represented';
    else if(selectedCount>=c.count) item.exclusion='Outside collection size limit';
    else { item.selected=true; artists.add(artist); selectedCount++; }
  }
  const selected=ranked.filter(i=>i.selected);
  const retail=cents(selected.reduce((s,i)=>s+i.price,0))/100;
  const cost=cents(selected.reduce((s,i)=>s+i.cost,0))/100;
  return {items:scored,selected,economics:{retail,cost,contribution:money(retail-cost),margin:retail?money((retail-cost)/retail):0,agedUnits:selected.filter(i=>i.daysOnShelf>=90).length}};
}
