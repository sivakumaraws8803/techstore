BEGIN;

-- Keep the current products.category text field for storefront compatibility.
-- Add the fields already queried by the Product Service for older databases.
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(60) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_name_unique UNIQUE (name)
);

-- Preserve every category already assigned to a product.
INSERT INTO categories (name, slug)
SELECT DISTINCT TRIM(category),
       LOWER(REGEXP_REPLACE(TRIM(category), '[^a-zA-Z0-9]+', '-', 'g'))
FROM products
WHERE TRIM(COALESCE(category, '')) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, slug) VALUES
 ('Phones', 'phones'),
 ('Laptops', 'laptops'),
 ('Tablets', 'tablets'),
 ('Audio', 'audio'),
 ('Watches', 'watches'),
 ('Accessories', 'accessories')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_categories_active_name ON categories(is_active, name);
COMMIT;
