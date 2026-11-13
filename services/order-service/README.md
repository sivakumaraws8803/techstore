# order-service

- Local port: 3004
- Start: `npm install && npm start`
- Health check: `curl http://127.0.0.1:3004/health`
- Environment: copy `.env.example` to `.env`

This is the independently deployable service entry point. Domain routes and data access are migrated from the legacy backend in separate, tested steps. Do not add credentials to this repository.
