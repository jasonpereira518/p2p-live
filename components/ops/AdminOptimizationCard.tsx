import React, { useState, useCallback, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

interface OptimizationSuggestion {
  title: string;
  impactPercent?: number;
  category?: string;
  detail?: string;
}

interface OptimizationResponse {
  suggestions?: OptimizationSuggestion[];
  generatedAtISO?: string;
  model?: string | null;
  error?: string;
}

async function safeJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text(); // read once

  if (!res.ok) {
    // Prefer JSON error messages if present
    let msg = `Request failed (${res.status} ${res.statusText})`;
    if (text?.trim()) {
      // Show a snippet to help debug (often this is HTML from a 404/proxy miss)
      msg += `: ${text.trim().slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  if (!text || !text.trim()) {
    throw new Error("Empty response from server");
  }

  // If it claims JSON, try to parse; if it doesn't, still try but give a clearer error
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const hint =
      contentType.includes("application/json")
        ? "Invalid JSON from server"
        : `Expected JSON but got "${contentType || "unknown content-type"}"`;
    throw new Error(`${hint}: ${text.trim().slice(0, 200)}`);
  }
}

export function AdminOptimizationCard({ metrics }: { metrics: Record<string, unknown> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OptimizationResponse | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-optimization-summary", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics }),
      });
      console.log("admin-opt", res.status, res.headers.get("content-type"));
      const json = await safeJson<OptimizationResponse>(res);
      if (!res.ok) {
        setError(json.error ?? 'Request failed');
        return;
      }
      if (json.error) {
        setError(json.error);
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [metrics]);

  useEffect(() => {
    if (!data && !loading && !error) {
      fetchSuggestions();
    }
  }, [data, loading, error, fetchSuggestions]);

  const hasSuggestions = (data?.suggestions?.length ?? 0) > 0;

  const categoryColor = (category?: string) => {
    const c = (category || '').toLowerCase();
    if (c.includes('walk')) return 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20';
    if (c.includes('congestion')) return 'bg-amber-500/10 text-amber-800 border border-amber-500/20';
    if (c.includes('reliability')) return 'bg-p2p-light-blue/40 text-p2p-blue border border-p2p-blue/20';
    if (c.includes('efficiency')) return 'bg-violet-500/10 text-violet-700 border border-violet-500/20';
    return 'bg-gray-100 text-gray-700 border border-gray-200';
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-p2p-light-blue/50 text-p2p-blue shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">AI Route Optimization Suggestions</h2>
            <p className="text-xs text-gray-500 truncate">Generated using Gemini Pro</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data?.generatedAtISO && (
            <span className="text-xs text-gray-500">
              Last generated: {new Date(data.generatedAtISO).toLocaleString()}
            </span>
          )}
          <button
            type="button"
            onClick={fetchSuggestions}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-p2p-blue text-white hover:bg-p2p-blue/90 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-p2p-blue"
          >
            {loading ? 'Generating AI Optimization Suggestions…' : hasSuggestions ? 'Regenerate Suggestions' : 'Generate Suggestions'}
          </button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {error && !hasSuggestions && (
          <p className="text-sm text-amber-700">AI summary temporarily unavailable. {error}</p>
        )}
        {error && hasSuggestions && (
          <p className="text-xs text-amber-700">
            AI call failed; showing the latest available suggestions.
          </p>
        )}
        {!loading && !hasSuggestions && !error && (
          <p className="text-sm text-gray-500">
            Click “Generate Suggestions” to see route and stop improvements with estimated impact.
          </p>
        )}
        {loading && !hasSuggestions && (
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-5/6" />
            <div className="h-3 bg-gray-200 rounded w-4/6" />
          </div>
        )}
        {hasSuggestions && (
          <div className="grid gap-3 md:grid-cols-2">
            {data!.suggestions!.map((s, idx) => (
              <article
                key={`${s.title ?? 'sugg'}-${idx}`}
                className="rounded-xl bg-white border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">{s.title ?? 'Optimization suggestion'}</h3>
                  {typeof s.impactPercent === 'number' && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-500/15 rounded-full px-2 py-0.5 shrink-0">
                      ~{Math.round(s.impactPercent)}%
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {s.category && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryColor(s.category)}`}>
                      {s.category}
                    </span>
                  )}
                  {data?.model && (
                    <span className="text-[11px] text-gray-400">
                      {data.model === 'fallback' ? 'Fallback rules' : data.model}
                    </span>
                  )}
                </div>
                {s.detail && (
                  <p className="text-sm text-gray-700 leading-relaxed mt-2">{s.detail}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

