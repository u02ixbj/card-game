# Bugger Bridge

A trick-taking card game with online multiplayer. 2–8 players, bid exactly the tricks you'll take each round.

## Play now

**[card-game-one-gray.vercel.app](https://card-game-one-gray.vercel.app)**

## How to play

- Each round, players are dealt a hand of cards and bid how many tricks they think they'll win
- You score points only if you hit your bid exactly: 10 + bid × (bid + 1) / 2
- The number of cards dealt goes up then back down across rounds (e.g. 1→2→...→peak→...→2→1)
- The dealer cannot bid a number that would let all players hit their bids (bust rule)
- A trump suit is revealed each round — trump cards beat all other suits
- No-trump rounds are mixed in where no suit is special

### Jokers (optional)
- Enable jokers when creating a game — adds a Big Joker and Small Joker to the deck
- Big Joker > Small Joker > all other cards
- Leading a joker sets the led suit to trump; in no-trump rounds you declare a suit and everyone must follow it
- If another player holds the other joker, they don't have to follow — they can play anything

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

## Public deployment

**Client → Vercel:** [card-game-one-gray.vercel.app](https://card-game-one-gray.vercel.app)
**Server → Railway:** [card-game-production-e29f.up.railway.app](https://card-game-production-e29f.up.railway.app)

### Environment variables

| Service | Key | Value |
|---------|-----|-------|
| Vercel | `VITE_SERVER_URL` | `https://card-game-production-e29f.up.railway.app` |
| Railway | `CLIENT_URL` | `https://card-game-one-gray.vercel.app` |

### Re-deploying

- **Vercel** auto-deploys on push to `main`. After changing env vars, manually redeploy with build cache cleared.
- **Railway** auto-deploys on push to `main`.

## Tech stack

- **Frontend:** React + Vite, deployed on Vercel
- **Backend:** Node.js + Express + Socket.IO, deployed on Railway
- **State:** In-memory (no database — restarting the server ends all active games)
