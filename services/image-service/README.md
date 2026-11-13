# image-service

Port: 3007

Run `npm install && npm start`. Health check: `curl http://127.0.0.1:3007/health`.

This is the independent service foundation. Migrate domain routes and persistence from the legacy backend in a tested follow-up before production cutover. Never commit secrets.
