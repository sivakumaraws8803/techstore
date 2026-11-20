BEGIN;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id BIGINT REFERENCES product_variants(id) ON DELETE RESTRICT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_sku VARCHAR(80);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_name VARCHAR(120);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);
GRANT SELECT, INSERT, UPDATE ON TABLE order_items TO techstore_app;
COMMIT;
