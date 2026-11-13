# payment-service

Port 3005. Start with `npm install && npm start`; health check: `curl http://127.0.0.1:3005/health`.

This is the independent service boundary. Payment provider integration and idempotent payment workflows must be implemented and tested before processing real payments. Never store card data or commit provider secrets.
