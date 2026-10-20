-- Stock invariants now live in explicit D1.batch transactions, so deployments
-- that apply declarative schema only behave identically to local migrations.
DROP TRIGGER IF EXISTS inventory_insert_valid;
--> statement-breakpoint
DROP TRIGGER IF EXISTS inventory_update_valid;
--> statement-breakpoint
DROP TRIGGER IF EXISTS inventory_active_hold;
--> statement-breakpoint
DROP TRIGGER IF EXISTS reservation_validate;
--> statement-breakpoint
DROP TRIGGER IF EXISTS reservation_take_stock;
--> statement-breakpoint
DROP TRIGGER IF EXISTS reservation_transition;
--> statement-breakpoint
DROP TRIGGER IF EXISTS reservation_restore_stock;
