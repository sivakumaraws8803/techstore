# Payment Service

Port 3005; binds to 127.0.0.1.

This is a development-only dummy payment simulator. It does not collect card details and does not transfer money.

Apply `database/migrations/004_add_dummy_payments.sql` before starting the service.

Use the same database credentials and exact SESSION_SECRET as Auth Service. Set PORT=3005 and COOKIE_SECURE=false for the current HTTP test environment.

Endpoint: `POST /api/payments/orders/:orderId/simulate`

Requires the customer's authenticated session and JSON body `{"outcome":"success"}`, `{"outcome":"failed"}`, or `{"outcome":"cancelled"}`.

The service checks order ownership, locks the order row, records the payment attempt, and updates orders.payment_status in one transaction. Never use this simulator for real payments.
