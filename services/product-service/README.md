# Product Service

Independent Product Service for TechStore.

- Local bind: `127.0.0.1:3002`
- Health: `GET /health`
- Public: `GET /api/products`, `GET /api/products/:id`
- Owner/product_manager: `POST /api/products`, `PUT /api/products/:id`
- Owner only: `PATCH /api/products/:id/deactivate`

During migration this service reads/writes the existing `public.products` table in the `techstore` database. It does not create or migrate tables.

Authentication shares the Auth Service's PostgreSQL session table, cookie name, and session secret. Set the same `SESSION_SECRET` in both services. Set `COOKIE_SECURE=true` after HTTPS is configured.

Start with `npm install && npm start`. Run under PM2 as `product-service`.
