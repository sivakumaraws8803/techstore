# TechStore Admin Web Service

A separate Node.js web application for the admin hostname. It runs independently from the customer storefront and existing Auth/Product services.

## Runtime

- Default bind: 127.0.0.1:3010
- Health check: GET /health
- Login page: /
- Dashboard: /dashboard
- Requires Node.js 18+ and Express 5 (declared in package.json).

## API routing required at the reverse proxy

On the admin virtual host, proxy these paths to the existing services while preserving the request URI and browser cookie:

- /api/auth/ -> http://127.0.0.1:3001
- /api/products/ -> http://127.0.0.1:3002

The Auth and Product services must share the same SESSION_SECRET, PostgreSQL session table and cookie configuration. Keep the session cookie host-only; do not set a broad Domain attribute. The admin hostname is the browser origin for login and product requests.

## Features in this first release

- Separate owner-only sign-in using the existing Auth Service and existing owner account.
- Owner session verification on dashboard load.
- Product listing, product creation, and product deactivation through Product Service.
- New products use the existing product database and appear in the customer catalogue when active.
- Sign out through Auth Service.

Product creation currently accepts an image URL. It does not upload image files. Order and customer management are not included in this first independent-service release; the existing customer app and original admin page are not modified.

## Install and run on EC2

From the backend repository root:

```bash
cd /usr/share/nginx/techstore/backend
cd admin-service
npm install
PORT=3010 HOST=127.0.0.1 npm start
```

For PM2, from the backend repository root:

```bash
pm2 start admin-service/server.js --name admin-web --cwd /usr/share/nginx/techstore/backend/admin-service
pm2 save
```

Do not stop the existing monolith or replace the existing frontend admin.html during this migration.
