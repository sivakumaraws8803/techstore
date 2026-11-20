BEGIN;

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_active
  ON product_variants(product_id, is_active);

-- Preserve current catalogue pricing and inventory as a default variant.
INSERT INTO product_variants (product_id, sku, name, attributes, price, stock, image_url)
SELECT p.id, 'TS-' || p.id || '-DEFAULT', 'Standard', '{}'::jsonb,
       p.price, p.stock, p.image_url
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants v WHERE v.product_id = p.id
);

GRANT SELECT, INSERT, UPDATE ON TABLE product_variants TO techstore_app;
GRANT USAGE, SELECT ON SEQUENCE product_variants_id_seq TO techstore_app;

COMMIT;
