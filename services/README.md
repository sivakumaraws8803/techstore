# TechStore microservices

The target service boundaries and local ports are:

| Service | Port | Responsibilities |
|---|---:|---|
| Auth | 3001 | Registration, login and identity |
| Product | 3002 | Public catalogue and product administration |
| Cart | 3003 | Customer cart |
| Order | 3004 | Create orders, customer order history and order administration |
| Payment | 3005 | Payment simulation (no real money movement) |
| Inventory | 3006 | Stock records, reservations and release |
| Image | 3007 | Validated product image upload |
| Notification | 3008 | Email delivery through Amazon SES |

## Current migration phase

The new Order, Inventory, Image and Notification service implementations are added alongside Auth, Product, Cart and Payment. The Order service currently uses the existing TechStore PostgreSQL schema and the existing shared session cookie so the current application can be migrated incrementally. Inventory has its own service-owned inventory table, but product stock/order placement has not yet been switched to inventory reservations. Image storage is local disk; Notification requires a verified SES sender and AWS credentials/role.

**This is not yet the final independent-database architecture.** Before removing the legacy API, complete the database-per-service data migration, switch all API consumers and Nginx routes, integrate order/inventory/payment/notification workflows, and pass end-to-end tests. Do not delete the legacy `src/` application until the cutover checklist is complete.

## Ports

All Node services bind to `127.0.0.1`; expose them through Nginx only. Keep service environment files out of Git. Use each service's `.env.example` as a template and configure real secrets on the server.

## Internal service endpoints

Inventory and Notification endpoints require the `x-internal-api-key` header. Configure the same high-entropy key in trusted callers and the receiving service. Do not expose these endpoints directly to the public internet.
