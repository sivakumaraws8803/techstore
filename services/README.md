# TechStore Microservices

Eight independently runnable Node.js service folders in this repository. The existing monolith (port 3000) is intentionally preserved during migration.

| Service | Port | Responsibility | Current status |
|---|---:|---|---|
| auth-service | 3001 | Registration, login and identity | Implemented first migration slice; see service README |
| product-service | 3002 | Product catalogue | Health-check scaffold |
| cart-service | 3003 | Shopping carts | Health-check scaffold |
| order-service | 3004 | Order lifecycle | Health-check scaffold |
| payment-service | 3005 | Payment orchestration | Health-check scaffold; no live charging |
| inventory-service | 3006 | Stock levels and reservations | Health-check scaffold |
| image-service | 3007 | Product image upload/storage | Health-check scaffold |
| notification-service | 3008 | Email/SMS dispatch | Health-check scaffold |

## Run auth-service on EC2

From the repository root:

```bash
cd services/auth-service
cp .env.example .env
# Edit .env: set DB_PASSWORD and a unique SESSION_SECRET (32+ characters).
npm install
npm start
```

The service binds to `127.0.0.1:3001`. In another SSH session, test:

```bash
curl -i http://127.0.0.1:3001/health
```

See [auth-service README](./auth-service/README.md) for endpoint and registration/login tests.

## Important migration rules

- Keep the existing monolith on port 3000 until each feature has been migrated and tested.
- Do not expose service ports publicly; route traffic through Nginx on the EC2 host.
- The auth service temporarily reuses the existing `users` and `user_sessions` tables to preserve customer accounts and session compatibility during migration.
- Before production cutover, establish clear service data ownership and least-privilege PostgreSQL roles. Do not let services write to each other's tables.
- Secrets belong in environment variables or AWS Secrets Manager, never in Git.
- Payment service must use a configured and verified payment provider before accepting real payments.
- Configure S3 and upload validation before using image-service in production.
- The remaining seven service folders are not yet complete business services. Their business logic, database migrations, integration tests and frontend/admin integration will be delivered in later phases.
