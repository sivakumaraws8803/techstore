# TechStore Microservices

Eight independently runnable Node.js services in this repository. The existing monolith (port 3000) is intentionally preserved during migration.

| Service | Port | Responsibility |
|---|---:|---|
| auth-service | 3001 | Registration, login and identity |
| product-service | 3002 | Product catalogue |
| cart-service | 3003 | Shopping carts |
| order-service | 3004 | Order lifecycle |
| payment-service | 3005 | Payment orchestration (no live charge until a provider is configured) |
| inventory-service | 3006 | Stock levels and reservations |
| image-service | 3007 | Product image metadata/storage integration |
| notification-service | 3008 | Email/SMS notification dispatch |

## Run locally on the EC2 host

From the repository root:

```bash
for d in services/*-service; do (cd "$d" && npm install); done
```

Create each service's environment file from `.env.example`, then run each service in a separate terminal or with a process manager:

```bash
cd services/auth-service && cp .env.example .env && npm start
```

Repeat for the other service folders. Each service exposes `GET /health`.

## Important migration rules

- Keep the existing monolith on port 3000 until each feature has been migrated and tested.
- Do not expose service ports publicly; route traffic through Nginx on the EC2 host.
- Set a unique database schema/role per service before production cutover. Do not let services write to each other's tables.
- Secrets belong in environment variables or AWS Secrets Manager, never in Git.
- Payment service is only an orchestration boundary. Configure and verify a payment provider before accepting real payments.
- Image service currently exposes the service boundary; configure S3 and upload validation before production use.
- These are service foundations, not a completed migration of existing business logic. Existing data and routes remain in the monolith until migrated deliberately.
