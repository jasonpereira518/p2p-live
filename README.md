## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. **Environment:** Copy [.env.example](.env.example) to `.env.local`. Set **`VITE_MAPBOX_TOKEN`** (Mapbox access token) for the student map view; get one at [mapbox.com](https://www.mapbox.com/). Optionally set **`GEMINI_API_KEY`** for the ops Complaints LLM feature. **Never commit real keys.**
3. Run the app:
   - **Terminal 1:** `npm run dev` (Vite frontend)
   - **Terminal 2:** `npm run server` (Ops API server for `/api/ops/complaints/summary`)
   - Or run both with `npm run dev:all` if you have `concurrently` installed.
4. Open http://localhost:3000. The Manager → Complaints tab will show an LLM summary when the API server is running and `GEMINI_API_KEY` is set.

## Ops dashboards (off by default)

The public site is the rider app only: no P2P Login and no admin, manager or driver pages. The ops code is still in the repo (`pages/ops`, `ops`, `components/ops`). To use it locally, set `VITE_ENABLE_OPS=true` for the frontend and `ENABLE_OPS_API=true` for the API server (see `.env.example`), then restart both. Without these, the ops pages are left out of the build, `/ops/*` redirects to the home page, and the server returns 404 for the ops endpoints.

## Live transit data

Bus positions, ETAs, stops, route lines and service messages come from the GMV Syncromatics RTPI API through the Node server (`/api/live/network`, `/api/live/snapshot`). Set `GMV_RTPI_API_KEY` in the server environment (local `.env`, Render dashboard). Never expose it to the client. GMV data is only cached in memory; the license forbids storing it for more than 24 hours.
