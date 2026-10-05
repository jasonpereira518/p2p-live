## Run locally

**Prerequisite:** Node.js

1. Install dependencies: `npm install`
2. Copy [.env.example](.env.example) to `.env.local` and set `VITE_MAPBOX_TOKEN`, `MAPBOX_TOKEN`, and `GMV_RTPI_API_KEY`. The Vite frontend and Node API both read `.env.local` in local development. Never commit real keys.
3. Start the public rider app and its API in separate terminals:
   - `npm run dev` starts Vite on <http://localhost:3000>.
   - `npm run server` starts the GMV and Mapbox API on port 3001.
4. Open <http://localhost:3000>.

There is no `dev:all` script. Use the two commands above so each process stays independently visible and easy to stop.

## Public rider features

P2P Live is a public rider app. It provides Mapbox-backed campus maps, GMV Syncromatics live routes and vehicle positions, stop arrivals, routing, walking directions, and GMV service-status notices. There are no login, account, operations, messaging, or AI-provider features.

## Verification

- `npm test`
- `npm run typecheck`
- `npm run build`
