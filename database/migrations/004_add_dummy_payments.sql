BEGIN;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
    ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled'));

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'dummy',
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
    transaction_reference VARCHAR(80) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_created
    ON payments(order_id, created_at DESC);

COMMIT;
