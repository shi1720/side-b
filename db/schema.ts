import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', {
  ownerId: text('owner_id').primaryKey(), name: text('name').notNull(), currency: text('currency').notNull().default('USD'),
  sample: integer('sample').notNull().default(1), initialized: integer('initialized').notNull().default(0), createdAt: text('created_at').notNull(),
  pickupInstructions: text('pickup_instructions').notNull().default('Demo collection only — no real stock or pickup.'),
});
export const inventory = sqliteTable('inventory', {
  ownerId: text('owner_id').notNull().references(() => workspaces.ownerId, { onDelete: 'cascade' }),
  sku: text('sku').notNull(), artist: text('artist').notNull(), title: text('title').notNull(),
  priceCents: integer('price_cents').notNull(), costCents: integer('cost_cents').notNull(), quantity: integer('quantity').notNull(),
  daysOnShelf: integer('days_on_shelf').notNull(), genre: text('genre').notNull(), color: text('color'), entityId: text('entity_id'), image: text('image'),
}, (t) => [primaryKey({ columns: [t.ownerId, t.sku] })]);
export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => workspaces.ownerId, { onDelete: 'cascade' }),
  runJson: text('run_json').notNull(), createdAt: text('created_at').notNull(),
});
export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => workspaces.ownerId, { onDelete: 'cascade' }),
  runId: text('run_id').notNull(), title: text('title').notNull(), description: text('description').notNull(),
  runJson: text('run_json').notNull(), published: integer('published').notNull().default(1), createdAt: text('created_at').notNull(),
  sample: integer('sample').notNull().default(1),
});
export const reservations = sqliteTable('reservations', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => workspaces.ownerId, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull(), itemTitle: text('item_title').notNull(), customerName: text('customer_name').notNull(),
  quantity: integer('quantity').notNull().default(1), status: text('status').notNull().default('held'),
  idempotencyKey: text('idempotency_key').notNull(), createdAt: text('created_at').notNull(), reference: text('reference').notNull(),
}, (t) => [uniqueIndex('reservation_idempotency').on(t.campaignId, t.idempotencyKey)]);
export const apiCache = sqliteTable('api_cache', { key: text('key').primaryKey(), value: text('value').notNull(), expiresAt: integer('expires_at').notNull() });
export const rateLimits = sqliteTable('rate_limits', { key: text('key').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull() });
