# inventory-service

Port: 3006

Run `npm install && npm start`. Health check: `curl http://127.0.0.1:3006/health`.

This is the independent service foundation. Migrate domain routes and persistence from the legacy backend in a tested follow-up before production cutover. Never commit secrets.
