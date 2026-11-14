# TechStore Cart Service

Independent cart service. Binds to 127.0.0.1:3003 and shares the Auth Service's PostgreSQL session table and SESSION_SECRET. It owns public.cart_items and validates active products through Product Service at 127.0.0.1:3002.

Copy .env.example to .env, set DB_PASSWORD and the exact SESSION_SECRET from Auth Service. Keep COOKIE_SECURE=false over HTTP; set true after HTTPS is enabled.

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Database health |
| GET | /api/cart | Current customer's cart |
| POST | /api/cart/items | Add { "productId": 1, "quantity": 1 } |
| PATCH | /api/cart/items/:productId | Set { "quantity": 2 } |
| DELETE | /api/cart/items/:productId | Remove an item |
| DELETE | /api/cart | Clear cart |

All cart routes require a valid techstore.sid session. Quantities are 1-99. Cart records are scoped by authenticated user ID. Checkout must revalidate product price and stock. Do not expose port 3003 publicly; proxy it through Nginx after local testing.