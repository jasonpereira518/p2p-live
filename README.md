## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. **API key (server-side only):** Set `GEMINI_API_KEY` in `.env.local` for the Complaints LLM summary feature. Copy [.env.example](.env.example) to `.env.local` and add your key. **Never commit API keys**—keys are used only by the ops API server (`server/index.js`), never in the client bundle.
3. Run the app:
   - **Terminal 1:** `npm run dev` (Vite frontend)
   - **Terminal 2:** `npm run server` (Ops API server for `/api/ops/complaints/summary`)
   - Or run both with `npm run dev:all` if you have `concurrently` installed.
4. Open http://localhost:3000. The Manager → Complaints tab will show an LLM summary when the API server is running and `GEMINI_API_KEY` is set.
