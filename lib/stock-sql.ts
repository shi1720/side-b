/** Pure SQL statement builders shared by D1 runtime and trigger-free invariants.
 * Execute each returned array as ONE atomic D1.batch, never separate requests.
 */
export type StockStatement = { sql: string; params: (string | number | null)[] };
export type HoldInput = { id: string; ownerId: string; campaignId: string; sku: string; artist: string; title: string; priceCents: number; customerName: string; idempotencyKey: string; createdAt: string; reference: string };
export function reserveStatements(a: HoldInput): StockStatement[] {
  return [{
    sql: `INSERT INTO reservations (id,owner_id,campaign_id,sku,item_title,customer_name,quantity,status,idempotency_key,created_at,reference)
      SELECT ?,c.owner_id,c.id,i.sku,i.title,?,1,'held',?,?,?
      FROM campaigns c JOIN inventory i ON i.owner_id=c.owner_id
      WHERE c.id=? AND c.owner_id=? AND c.published=1
      AND i.sku=? AND i.artist=? AND i.title=? AND i.price_cents=? AND i.quantity>=1
      AND EXISTS (SELECT 1 FROM json_each(c.run_json,'$.selected') j WHERE json_extract(j.value,'$.sku')=i.sku AND json_extract(j.value,'$.artist')=i.artist AND json_extract(j.value,'$.title')=i.title AND CAST(ROUND(json_extract(j.value,'$.price')*100) AS INTEGER)=i.price_cents)
      AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.campaign_id=c.id AND r.idempotency_key=?)
      AND (SELECT count(*) FROM reservations r WHERE r.campaign_id=c.id AND r.status='held')<100
      ON CONFLICT(campaign_id,idempotency_key) DO NOTHING`,
    params: [a.id,a.customerName,a.idempotencyKey,a.createdAt,a.reference,a.campaignId,a.ownerId,a.sku,a.artist,a.title,a.priceCents,a.idempotencyKey],
  }, {
    // id is a new server-generated UUID for EVERY attempt. An idempotent retry
    // inserts no row with this fresh id and therefore cannot decrement again.
    sql: "UPDATE inventory SET quantity=quantity-1 WHERE owner_id=? AND sku=? AND quantity>=1 AND EXISTS (SELECT 1 FROM reservations WHERE id=? AND owner_id=? AND sku=? AND status='held')",
    params: [a.ownerId,a.sku,a.id,a.ownerId,a.sku],
  }];
}
export function cancelStatements(ownerId: string, id: string): StockStatement[] {
  return [{
    sql: "UPDATE inventory SET quantity=quantity+(SELECT quantity FROM reservations WHERE id=? AND owner_id=? AND status='held') WHERE owner_id=? AND sku=(SELECT sku FROM reservations WHERE id=? AND owner_id=? AND status='held')",
    params: [id,ownerId,ownerId,id,ownerId],
  }, {
    sql: "UPDATE reservations SET status='cancelled' WHERE id=? AND owner_id=? AND status='held'", params: [id,ownerId],
  }];
}
export function collectStatement(ownerId: string, id: string): StockStatement {
  return { sql: "UPDATE reservations SET status='collected' WHERE id=? AND owner_id=? AND status='held'", params: [id,ownerId] };
}
export function expireStatements(ownerId: string, cutoff: string): StockStatement[] {
  return [{
    sql: "UPDATE inventory SET quantity=quantity+(SELECT COALESCE(SUM(r.quantity),0) FROM reservations r WHERE r.owner_id=inventory.owner_id AND r.sku=inventory.sku AND r.status='held' AND r.created_at<?) WHERE owner_id=? AND EXISTS (SELECT 1 FROM reservations r WHERE r.owner_id=inventory.owner_id AND r.sku=inventory.sku AND r.status='held' AND r.created_at<?)",
    params: [cutoff,ownerId,cutoff],
  }, {
    sql: "UPDATE reservations SET status='cancelled' WHERE owner_id=? AND status='held' AND created_at<?", params: [ownerId,cutoff],
  }];
}
export function inventoryReplacementGuard(ownerId: string): StockStatement {
  // Deliberately reproduce an existing primary key if active holds exist.
  // A constraint failure rolls back the WHOLE batch, including replacement.
  // This relies on table PKs, which hosted schema migrations preserve.
  return {
    sql: "INSERT INTO inventory (owner_id,sku,artist,title,price_cents,cost_cents,quantity,days_on_shelf,genre,color,entity_id,image) SELECT owner_id,sku,artist,title,price_cents,cost_cents,quantity,days_on_shelf,genre,color,entity_id,image FROM inventory WHERE owner_id=? AND EXISTS (SELECT 1 FROM reservations WHERE owner_id=? AND status='held') LIMIT 1",
    params: [ownerId,ownerId],
  };
}
