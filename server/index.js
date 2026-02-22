/**
 * Small API server for ops features that require server-side only (e.g. Gemini).
 * GEMINI_API_KEY must be set in environment; never exposed to client.
 */

const http = require('http');

const PORT = process.env.OPS_API_PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

let summaryCache = null;
let cacheKey = null;

function hashComplaints(complaints) {
  const str = JSON.stringify(complaints.map((c) => ({ id: c.id, category: c.category, notes: c.notes })));
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

async function generateSummaryWithGemini(complaints) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const prompt = `You are an operations analyst. Summarize the following transit complaints in a concise, actionable way (150-250 words).

Requirements:
- Group by category (e.g. GPS issues, overcrowding, off-route, maintenance).
- Mention counts per category and any top recurring issues.
- Suggest 2-4 next actions (operational and/or technical).
- Use short bullets where appropriate.

Complaints (JSON):
${JSON.stringify(complaints, null, 0)}

Respond with only the summary text (no preamble).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty or invalid Gemini response');
  return text;
}

async function handleComplaintsSummary(req, body, res) {
  const complaints = body?.complaints ?? [];
  const key = hashComplaints(complaints);
  if (summaryCache && cacheKey === key && Date.now() - summaryCache.generatedAt < CACHE_TTL_MS) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(summaryCache));
    return;
  }
  try {
    const summaryMarkdown = await generateSummaryWithGemini(complaints);
    const payload = {
      summaryMarkdown,
      generatedAtISO: new Date().toISOString(),
      model: GEMINI_MODEL,
    };
    summaryCache = { ...payload, generatedAt: Date.now() };
    cacheKey = key;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  } catch (err) {
    console.error('Complaints summary error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message, generatedAtISO: null, model: null }));
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === '/api/ops/complaints/summary' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        handleComplaintsSummary(req, parsed, res);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  if (!GEMINI_API_KEY) {
    console.warn('Warning: GEMINI_API_KEY not set. /api/ops/complaints/summary will return 500.');
  }
  console.log(`Ops API server listening on http://localhost:${PORT}`);
});
