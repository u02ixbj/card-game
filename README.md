# Bugger Bridge

A trick-taking card game with online multiplayer. 2–8 players, bid exactly the tricks you'll take.

## Running locally

```bash
# Terminal 1 — server (port 3001)
cd server && npm run dev

# Terminal 2 — client (port 3000)
cd client && npm run dev
```

Open `http://localhost:3000`. You need at least 2 browser tabs to start a game.

## Local network (same Wi-Fi)

1. Find your IP: run `ipconfig` and look for **IPv4 Address** (e.g. `192.168.1.50`)
2. In `client/vite.config.js` add `host: true` to the `server` block
3. Other devices on the network open `http://192.168.1.50:3000`

## TODO — Public deployment (Railway + Vercel)

The app is set up and ready for deployment but needs the repo owner (`u02ixbj`) to authorise the Railway GitHub app. Steps when ready:

**Server → Railway**
- Root directory: `server`
- Start command: `npm start`
- Environment variable: `CLIENT_URL=<vercel-url>`

**Client → Vercel**
- Root directory: `client`
- Framework: Vite
- Environment variable: `VITE_SERVER_URL=<railway-url>`

Alternative if GitHub auth is still an issue: deploy via CLI (`railway up` / `vercel`) directly from local folders — no GitHub connection needed.

## Tech stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express + Socket.IO
- **State:** In-memory (no database)
