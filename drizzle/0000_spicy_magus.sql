CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`run_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `workspaces`(`owner_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`run_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`run_json` text NOT NULL,
	`published` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `workspaces`(`owner_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`owner_id` text NOT NULL,
	`sku` text NOT NULL,
	`artist` text NOT NULL,
	`title` text NOT NULL,
	`price_cents` integer NOT NULL,
	`cost_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`days_on_shelf` integer NOT NULL,
	`genre` text NOT NULL,
	`color` text,
	`entity_id` text,
	`image` text,
	PRIMARY KEY(`owner_id`, `sku`),
	FOREIGN KEY (`owner_id`) REFERENCES `workspaces`(`owner_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`sku` text NOT NULL,
	`item_title` text NOT NULL,
	`customer_name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'held' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	`reference` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `workspaces`(`owner_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservation_idempotency` ON `reservations` (`campaign_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`sample` integer DEFAULT 1 NOT NULL,
	`initialized` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER inventory_insert_valid BEFORE INSERT ON inventory
WHEN NEW.quantity < 0 OR NEW.price_cents <= 0 OR NEW.cost_cents < 0 OR NEW.days_on_shelf < 0
BEGIN SELECT RAISE(ABORT, 'invalid stock'); END;
--> statement-breakpoint
CREATE TRIGGER inventory_update_valid BEFORE UPDATE ON inventory
WHEN NEW.quantity < 0 OR NEW.price_cents <= 0 OR NEW.cost_cents < 0 OR NEW.days_on_shelf < 0
BEGIN SELECT RAISE(ABORT, 'invalid stock'); END;
--> statement-breakpoint
CREATE TRIGGER inventory_active_hold BEFORE DELETE ON inventory
WHEN EXISTS (SELECT 1 FROM reservations WHERE owner_id=OLD.owner_id AND sku=OLD.sku AND status='held')
BEGIN SELECT RAISE(ABORT, 'active holds'); END;
--> statement-breakpoint
CREATE TRIGGER reservation_validate BEFORE INSERT ON reservations
BEGIN
  SELECT CASE WHEN NEW.status <> 'held' OR NEW.quantity <> 1 THEN RAISE(ABORT, 'invalid reservation') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id=NEW.campaign_id AND c.owner_id=NEW.owner_id AND c.published=1 AND EXISTS (SELECT 1 FROM json_each(c.run_json, '$.selected') j WHERE json_extract(j.value, '$.sku')=NEW.sku)) THEN RAISE(ABORT, 'campaign unavailable') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM inventory WHERE owner_id=NEW.owner_id AND sku=NEW.sku AND quantity >= NEW.quantity) THEN RAISE(ABORT, 'stock unavailable') END;
  SELECT CASE WHEN (SELECT count(*) FROM reservations WHERE campaign_id=NEW.campaign_id AND status='held') >= 100 THEN RAISE(ABORT, 'campaign hold limit') END;
END;
--> statement-breakpoint
CREATE TRIGGER reservation_take_stock AFTER INSERT ON reservations
BEGIN UPDATE inventory SET quantity=quantity-NEW.quantity WHERE owner_id=NEW.owner_id AND sku=NEW.sku; END;
--> statement-breakpoint
CREATE TRIGGER reservation_transition BEFORE UPDATE ON reservations
WHEN NEW.owner_id <> OLD.owner_id OR NEW.sku <> OLD.sku OR NEW.quantity <> OLD.quantity OR NEW.campaign_id <> OLD.campaign_id OR NEW.status NOT IN ('held','collected','cancelled') OR (OLD.status <> 'held' AND NEW.status <> OLD.status)
BEGIN SELECT RAISE(ABORT, 'reservation transition'); END;
--> statement-breakpoint
CREATE TRIGGER reservation_restore_stock AFTER UPDATE OF status ON reservations
WHEN OLD.status='held' AND NEW.status='cancelled'
BEGIN UPDATE inventory SET quantity=quantity+OLD.quantity WHERE owner_id=OLD.owner_id AND sku=OLD.sku; END;
