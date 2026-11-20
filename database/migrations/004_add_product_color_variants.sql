ALTER TABLE products
    ADD COLUMN IF NOT EXISTS color_variants JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products
    ADD CONSTRAINT products_color_variants_is_array
    CHECK (jsonb_typeof(color_variants) = 'array');
