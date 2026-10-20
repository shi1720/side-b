import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { SAMPLE_INVENTORY } from './seed';
import type { AgentRun, Campaign, InventoryItem, Reservation, Workspace } from './types';
import { z } from 'zod';
import { AppError } from './errors';
import { quota, requestIdentity } from './qloo';

export class ApiError extends AppError { constructor(status: number, message: string) { super(message, status); } }
export function database(): D1Database {
  if (!env.DB) throw new ApiError(503, 'The workspace database is not configured.');
  return env.DB;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'Please make this change from the Side B application.');
  }
}
export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'Send application/json.');
  const limit = 80_000;
  if (Number(request.headers.get('content-length')) > limit) throw new ApiError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'A JSON body is required.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const result = await reader.read(); if (result.done) break;
    size += result.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new ApiError(413, 'Request is too large.'); }
    chunks.push(result.value);
  }
  const joined = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  let input: unknown;
  try { input = JSON.parse(new TextDecoder().decode(joined)); } catch { throw new ApiError(400, 'Invalid JSON.'); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map(i => `${i.path.join('.') || 'request'}: ${i.message}`).slice(0, 3).join('; '));
  return parsed.data;
}
export function json(data: unknown, cookie?: string, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
}
export function apiError(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message }, undefined, error.status);
  const message = error instanceof Error ? error.message : '';
  if (/stock unavailable|active holds|invalid reservation|invalid stock|campaign unavailable|campaign hold limit|reservation transition/i.test(message)) return json({ error: 'Stock or reservation status changed. Refresh and try again.' }, undefined, 409);
  console.error('Workspace operation failed', error instanceof Error ? error.name : 'unknown');
  return json({ error: 'This change could not be saved. Please try again.' }, undefined, 500);
}

type Row = Record<string, unknown>;
function itemFromRow(row: Row): InventoryItem {
  return { sku: String(row.sku), artist: String(row.artist), title: String(row.title), price: Number(row.price_cents)/100,
    cost: Number(row.cost_cents)/100, quantity: Number(row.quantity), daysOnShelf: Number(row.days_on_shelf), genre: String(row.genre),
    ...(row.color ? { color: String(row.color) } : {}), ...(row.entity_id ? { entityId: String(row.entity_id) } : {}), ...(row.image ? { image: String(row.image) } : {}) };
}
function campaignFromRow(row: Row): Campaign {
  return { id: String(row.id), title: String(row.title), description: String(row.description), createdAt: String(row.created_at),
    published: Boolean(row.published), run: JSON.parse(String(row.run_json)), reservations: Number(row.holds || 0), sales: Number(row.sales || 0) };
}
function reservationFromRow(row: Row): Reservation {
  return { id: String(row.id), campaignId: String(row.campaign_id), sku: String(row.sku), itemTitle: String(row.item_title),
    customerName: String(row.customer_name), quantity: Number(row.quantity), status: row.status as Reservation['status'], createdAt: String(row.created_at), reference: String(row.reference) };
}
export function insertInventory(db: D1Database, ownerId: string, item: InventoryItem) {
  return db.prepare('INSERT INTO inventory (owner_id,sku,artist,title,price_cents,cost_cents,quantity,days_on_shelf,genre,color,entity_id,image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(ownerId,item.sku,item.artist,item.title,Math.round(item.price*100),Math.round(item.cost*100),item.quantity,item.daysOnShelf,item.genre,item.color || null,item.entityId || null,item.image || null);
}
export const SAMPLE_PICKUP = 'Demo collection only — no real stock or pickup.';
/** Opportunistic cleanup: no background scheduler or promised notification. */
export async function expireHolds(ownerId: string) {
  const cutoff = new Date(Date.now()-48*60*60*1000).toISOString();
  await database().prepare("UPDATE reservations SET status='cancelled' WHERE owner_id=? AND status='held' AND created_at < ?").bind(ownerId,cutoff).run();
}
export async function getWorkspaceContext(request: Request): Promise<{ ownerId: string; workspace: Workspace; cookie?: string }> {
  const user = await getChatGPTUser();
  const existing = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('sideb_guest='))?.slice(12);
  const token = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : null;
  let ownerId: string; let cookie: string | undefined;
  if (user) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sideb:user:${user.userId}`));
    ownerId = `user_${Array.from(new Uint8Array(hash)).map(v => v.toString(16).padStart(2,'0')).join('')}`;
  } else {
    const nextToken = token || Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v => v.toString(16).padStart(2,'0')).join('');
    ownerId = `guest_${nextToken}`;
    if (!token) cookie = `sideb_guest=${nextToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
  }
  const db = database();
  // INSERT OR IGNORE plus seed conditional on a new workspace is one transaction;
  // simultaneous initial reads cannot duplicate stock or overwrite owner changes.
  const exists = await db.prepare('SELECT owner_id FROM workspaces WHERE owner_id=?').bind(ownerId).first();
  if (!exists) {
    await quota(`workspace-create:${await requestIdentity(request)}`,30,86400);
    await db.batch([
    db.prepare('INSERT OR IGNORE INTO workspaces (owner_id,name,currency,sample,created_at) VALUES (?,?,?,?,?)').bind(ownerId,'Side B Records','USD',1,new Date().toISOString()),
    ...SAMPLE_INVENTORY.map(item => db.prepare('INSERT OR IGNORE INTO inventory (owner_id,sku,artist,title,price_cents,cost_cents,quantity,days_on_shelf,genre,color) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workspaces WHERE owner_id=? AND initialized=0)')
      .bind(ownerId,item.sku,item.artist,item.title,Math.round(item.price*100),Math.round(item.cost*100),item.quantity,item.daysOnShelf,item.genre,item.color || null,ownerId)),
    db.prepare('UPDATE workspaces SET initialized=1 WHERE owner_id=? AND initialized=0').bind(ownerId),
    ]);
  }
  await expireHolds(ownerId);
  const [w, stock, campaignRows, reservationRows] = await Promise.all([
    db.prepare('SELECT * FROM workspaces WHERE owner_id=?').bind(ownerId).first<Row>(),
    db.prepare('SELECT * FROM inventory WHERE owner_id=? ORDER BY sku').bind(ownerId).all<Row>(),
    db.prepare("SELECT c.*, (SELECT count(*) FROM reservations r WHERE r.campaign_id=c.id AND r.status='held') holds, (SELECT count(*) FROM reservations r WHERE r.campaign_id=c.id AND r.status='collected') sales FROM campaigns c WHERE owner_id=? ORDER BY created_at DESC LIMIT 100").bind(ownerId).all<Row>(),
    db.prepare('SELECT * FROM reservations WHERE owner_id=? ORDER BY created_at DESC LIMIT 500').bind(ownerId).all<Row>(),
  ]);
  if (!w) throw new ApiError(503, 'Workspace could not be loaded.');
  return { ownerId, cookie, workspace: { name: String(w.name), currency: w.currency as Workspace['currency'], sample: Boolean(w.sample), pickupInstructions: String(w.pickup_instructions),
    inventory: stock.results.map(itemFromRow), campaigns: campaignRows.results.map(campaignFromRow), reservations: reservationRows.results.map(reservationFromRow), user: user ? { displayName: user.displayName, email: user.email } : null } };
}
export async function saveAgentRun(ownerId: string, run: AgentRun) {
  await database().prepare('INSERT INTO agent_runs (id,owner_id,run_json,created_at) VALUES (?,?,?,?)').bind(run.id,ownerId,JSON.stringify(run),run.createdAt).run();
}
export const inventorySchema = z.object({ items: z.array(z.object({
  sku: z.string().trim().min(1).max(60).regex(/^[\w .-]+$/, 'Use letters, digits, spaces, dots, hyphens or underscores.'),
  artist: z.string().trim().min(1).max(160), title: z.string().trim().min(1).max(200),
  price: z.number().finite().min(0.01).max(10000).multipleOf(0.01), cost: z.number().finite().min(0).max(10000).multipleOf(0.01),
  quantity: z.number().int().min(0).max(10000), daysOnShelf: z.number().int().min(0).max(36500), genre: z.string().trim().max(80),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(), entityId: z.string().uuid().optional(),
  image: z.string().url().max(2000).refine(v => v.startsWith('https://'), 'Image must use HTTPS.').optional(),
}).strict()).min(1).max(50), sample: z.boolean().optional() }).strict().refine(v => new Set(v.items.map(i=>i.sku)).size === v.items.length, 'Each SKU must be unique.');

export async function publishCampaign(ownerId: string, input: { runId: string; title?: string; description?: string }) {
  const db = database();
  const workspace = await db.prepare('SELECT sample,pickup_instructions FROM workspaces WHERE owner_id=?').bind(ownerId).first<Row>();
  if (!workspace) throw new ApiError(404, 'Workspace not found.');
  if (!workspace.sample && (!String(workspace.pickup_instructions || '').trim() || workspace.pickup_instructions === SAMPLE_PICKUP)) throw new ApiError(409, 'Add your shop address and pickup instructions in workspace settings before publishing real inventory.');
  const stored = await db.prepare('SELECT run_json FROM agent_runs WHERE id=? AND owner_id=?').bind(input.runId,ownerId).first<Row>();
  if (!stored) throw new ApiError(404, 'Run not found. Generate a collection in this workspace first.');
  const run: AgentRun = JSON.parse(String(stored.run_json));
  if (!run.selected.length) throw new ApiError(409, 'A campaign needs at least one selected record.');
  const stock = (await db.prepare('SELECT * FROM inventory WHERE owner_id=?').bind(ownerId).all<Row>()).results.map(itemFromRow);
  if (run.selected.some(item => !stock.some(current => current.sku === item.sku && current.artist === item.artist && current.title === item.title && current.price === item.price && current.quantity > 0))) throw new ApiError(409, 'Selected stock has changed. Generate a fresh collection before publishing.');
  const campaign: Campaign = { id: crypto.randomUUID(), title: input.title || run.title, description: input.description || run.description, createdAt: new Date().toISOString(), published: true, run };
  await db.prepare('INSERT INTO campaigns (id,owner_id,run_id,title,description,run_json,published,created_at,sample) VALUES (?,?,?,?,?,?,1,?,?)').bind(campaign.id,ownerId,run.id,campaign.title,campaign.description,JSON.stringify(run),campaign.createdAt,workspace.sample).run();
  return campaign;
}

function redactItem(item: InventoryItem & Record<string, unknown>) {
  // Explicit allowlist: future owner-only fields cannot accidentally become public.
  return { sku: item.sku, artist: item.artist, title: item.title, price: item.price, quantity: item.quantity,
    genre: item.genre, color: item.color, entityId: item.entityId, image: item.image,
    fit: item.fit, evidence: item.evidence, selected: item.selected };
}
export async function publicCampaign(id: string) {
  const db = database();
  const row = await db.prepare('SELECT c.*, c.sample campaign_sample, w.name shop_name, w.currency, w.pickup_instructions FROM campaigns c JOIN workspaces w ON w.owner_id=c.owner_id WHERE c.id=? AND c.published=1').bind(id).first<Row>();
  if (!row) throw new ApiError(404, 'This collection is not available.');
  await expireHolds(String(row.owner_id));
  const campaign = campaignFromRow(row);
  const stock = (await db.prepare('SELECT * FROM inventory WHERE owner_id=?').bind(row.owner_id).all<Row>()).results.map(itemFromRow);
  const selected = campaign.run.selected.map(item => {
    const current = stock.find(v => v.sku === item.sku && v.artist === item.artist && v.title === item.title && v.price === item.price);
    return redactItem({ ...item, quantity: current?.quantity || 0 });
  });
  return { campaign: { id: campaign.id, title: campaign.title, description: campaign.description, createdAt: campaign.createdAt, published: true,
    run: { id: campaign.run.id, mode: campaign.run.mode, createdAt: campaign.run.createdAt, anchors: campaign.run.anchors, selected, items: selected } },
    shop: { name: String(row.shop_name), currency: String(row.currency), sample: Boolean(row.campaign_sample), pickupInstructions: row.campaign_sample ? SAMPLE_PICKUP : String(row.pickup_instructions) }, inventory: selected };
}

export async function reserveRecord(campaignId: string, input: { sku: string; customerName: string; quantity: number; idempotencyKey: string }, identity: string) {
  const db = database();
  const campaignOwner = await db.prepare('SELECT owner_id FROM campaigns WHERE id=? AND published=1').bind(campaignId).first<Row>();
  if (!campaignOwner) throw new ApiError(404, 'Collection not found.');
  await expireHolds(String(campaignOwner.owner_id));
  const existing = await db.prepare('SELECT * FROM reservations WHERE campaign_id=? AND idempotency_key=?').bind(campaignId,input.idempotencyKey).first<Row>();
  if (existing) {
    if (existing.sku !== input.sku || existing.customer_name !== input.customerName) throw new ApiError(409, 'This request key was already used.');
    if (existing.status === 'cancelled') throw new ApiError(409, 'This hold has expired or was cancelled. Refresh the collection and create a new hold.');
    return reservationFromRow(existing);
  }
  await quota(`reserve-hour:${identity}:${campaignId}`,10,3600);
  const row = await db.prepare('SELECT * FROM campaigns WHERE id=? AND published=1').bind(campaignId).first<Row>();
  if (!row) throw new ApiError(404, 'Collection not found.');
  const run: AgentRun = JSON.parse(String(row.run_json));
  const item = run.selected.find(v=>v.sku===input.sku);
  if (!item) throw new ApiError(400, 'This record is not in the collection.');
  const id = crypto.randomUUID(); const reference = `SB-${id.slice(0,8).toUpperCase()}`;
  // INSERT and stock trigger form one statement. NOT EXISTS excludes duplicate
  // requests before the BEFORE INSERT stock check, including a last-unit retry.
  await db.prepare("INSERT INTO reservations (id,owner_id,campaign_id,sku,item_title,customer_name,quantity,status,idempotency_key,created_at,reference) SELECT ?,?,?,?,?,?,1,'held',?,?,? WHERE EXISTS (SELECT 1 FROM inventory WHERE owner_id=? AND sku=? AND artist=? AND title=? AND price_cents=?) AND NOT EXISTS (SELECT 1 FROM reservations WHERE campaign_id=? AND idempotency_key=?) ON CONFLICT(campaign_id,idempotency_key) DO NOTHING")
    .bind(id,row.owner_id,campaignId,input.sku,item.title,input.customerName,input.idempotencyKey,new Date().toISOString(),reference,row.owner_id,input.sku,item.artist,item.title,Math.round(item.price*100),campaignId,input.idempotencyKey).run();
  const saved = await db.prepare('SELECT * FROM reservations WHERE campaign_id=? AND idempotency_key=?').bind(campaignId,input.idempotencyKey).first<Row>();
  if (!saved) throw new ApiError(409, 'This record changed or is unavailable.');
  if (saved.sku !== input.sku || saved.customer_name !== input.customerName) throw new ApiError(409, 'This request key was already used.');
  if (saved.status === 'cancelled') throw new ApiError(409, 'This hold has expired or was cancelled. Refresh the collection and create a new hold.');
  return reservationFromRow(saved);
}
export async function transitionReservation(ownerId: string, id: string, status: 'cancelled'|'collected') {
  const db = database();
  await db.prepare("UPDATE reservations SET status=? WHERE id=? AND owner_id=? AND status='held'").bind(status,id,ownerId).run();
  const row = await db.prepare('SELECT * FROM reservations WHERE id=? AND owner_id=?').bind(id,ownerId).first<Row>();
  if (!row) throw new ApiError(404, 'Reservation not found.');
  if (row.status !== status) throw new ApiError(409, 'This reservation has already been completed.');
  return reservationFromRow(row);
}
