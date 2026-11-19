# TechStore Admin Web Service

Separate owner-facing admin application for `admin.cloudlearning.online`.

## Runtime and routes
- Admin Web: `127.0.0.1:3010`
- Auth API: `127.0.0.1:3001`
- Product API: `127.0.0.1:3002`
- Health check: `GET /health`

## Admin capabilities
- Responsive Apple-inspired operations dashboard with sidebar navigation.
- Product catalogue with search, category/status filters, image thumbnails and stock status.
- Create and edit products using a real multipart image upload (JPG, PNG, WEBP, AVIF; 5 MB maximum).
- Inventory quantity updates, low-stock and out-of-stock indicators.
- Product activation/deactivation using the existing Product Service.
- Existing owner authentication and PostgreSQL-backed session are retained.

## Image storage
Product Service stores uploads under `/usr/share/nginx/techstore/uploads/products` by default and writes the public path into the existing `products.image_url` column. The customer Nginx configuration already serves `/uploads/products/` from that directory. Add the same static alias to the admin virtual host so image previews load on the admin hostname:

```nginx
location ^~ /uploads/products/ {
    alias /usr/share/nginx/techstore/uploads/products/;
    autoindex off;
    add_header X-Content-Type-Options nosniff always;
}
```

Ensure the Linux account running Product Service can write to the upload directory. Do not change the database schema or replace the customer frontend.

## Install and deploy
From the backend repository root:
```bash
git pull origin microservices-refactor
cd services/product-service && npm install
cd ../../admin-service && npm install
``

Restart only the services whose code changed:
```bash
pm2 restart product-service
pm2 restart admin-web
pm2 save
``

Before production use, verify owner login, image upload, product create/edit, stock updates and customer storefront image rendering. Keep a backup of the upload directory and database.
