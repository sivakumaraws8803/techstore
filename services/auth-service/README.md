# TechStore Auth Service

Standalone Express authentication service. It migrates the existing TechStore customer registration/login behavior while keeping the existing PostgreSQL `users` table and PostgreSQL-backed session format during the transition.

## Requirements

- Node.js 18 or later
- Access to the existing TechStore PostgreSQL database
- Existing `users` table and `user_sessions` table (the monolith already uses `connect-pg-simple` for sessions)

## Configure and run

Run from this directory:

```bash
cp .env.example .env
# Edit .env and set DB_PASSWORD and a unique SESSION_SECRET (at least 32 characters).
npm install
npm start
```

The service binds to `127.0.0.1:3001`. Do not expose port 3001 publicly; route requests through Nginx.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service and database health |
| POST | `/api/auth/register` | Register customer |
| POST | `/api/auth/login` | Login with email or username |
| GET | `/api/auth/me` | Current session user |
| POST | `/api/auth/logout` | Destroy session |

Registration expects JSON with `fullName`, `email`, and `password`. Passwords must be at least 12 characters and no more than 72 UTF-8 bytes.

## Smoke tests

```bash
curl -i http://127.0.0.1:3001/health

curl -i -X POST http://127.0.0.1:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Test Customer","email":"test-customer@example.com","password":"ChangeThis123!"}'

curl -i -c /tmp/techstore-auth.cookies -X POST http://127.0.0.1:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-customer@example.com","password":"ChangeThis123!"}'

curl -i -b /tmp/techstore-auth.cookies http://127.0.0.1:3001/api/auth/me

curl -i -b /tmp/techstore-auth.cookies -X POST http://127.0.0.1:3001/api/auth/logout
```

Use a test email and a unique password in your own environment. Do not run the sample registration repeatedly against production data.

## Migration note

The existing monolith remains active on port 3000. This service is not yet wired into the public Nginx routes or frontend. After local EC2 smoke tests pass, route only `/api/auth/` to port 3001 and verify session-cookie behavior before changing the frontend. Do not stop the monolith during this migration.
