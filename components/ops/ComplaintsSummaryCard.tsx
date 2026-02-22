/**
 * LLM Summary card for Manager → Complaints: fetches from server (Gemini server-side only).
 * Shows last updated, Regenerate, loading, error fallback.
 */

import React, { useState, useCallback } from 'react';
import type { MockComplaint } from '../../data/mockOps';

interface SummaryResponse {
  summaryMarkdown?: string;
  generatedAtISO?: string | null;
  model?: string | null;
  error?: string;
}

interface ComplaintsSummaryCardProps {
  complaints: MockComplaint[];
}

function parseMarkdownSimple(text: string): React.ReactNode {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return <li key={i} className="ml-4">{trimmed.slice(2)}</li>;
        }
        if (trimmed.startsWith('##')) return <h4 key={i} className="font-bold mt-2 text-gray-900">{trimmed.replace(/^#+\s*/, '')}</h4>;
        if (trimmed) return <p key={i} className="mt-1">{trimmed}</p>;
        return <br key={i} />;
      })}
    </>
  );
}

export function ComplaintsSummaryCard({ complaints }: ComplaintsSummaryCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/complaints/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaints }),
      });
      const json: SummaryResponse = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Request failed');
        return;
      }
      if (json.error) {
        setError(json.error);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [complaints]);

  const hasCached = data?.summaryMarkdown && data?.generatedAtISO;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">LLM Summary</h2>
        <div className="flex items-center gap-2">
          {data?.generatedAtISO && (
            <span className="text-xs text-gray-500">
              Last updated: {new Date(data.generatedAtISO).toLocaleString()}
              {data.model && ` · ${data.model}`}
            </span>
          )}
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-p2p-blue text-white hover:bg-p2p-blue/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-p2p-blue"
          >
            {loading ? 'Generating…' : 'Regenerate'}
          </button>
        </div>
      </div>
      <div className="p-4 min-h-[80px]">
        {loading && !hasCached && (
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-5/6" />
            <div className="h-3 bg-gray-200 rounded w-4/6" />
          </div>
        )}
        {error && !hasCached && (
          <>
            <p className="text-sm text-p2p-red">
              Couldn&apos;t generate summary. {error}
            </p>
            <button type="button" onClick={fetchSummary} className="mt-2 text-sm font-medium text-p2p-blue hover:underline">
              Retry
            </button>
          </>
        )}
        {error && hasCached && (
          <p className="text-xs text-amber-700 mb-2">Couldn&apos;t generate summary. Showing latest available summary.</p>
        )}
        {data?.summaryMarkdown && (
          <div className="text-sm text-gray-700 prose prose-sm max-w-none">
            {parseMarkdownSimple(data.summaryMarkdown)}
          </div>
        )}
        {!loading && !error && !hasCached && (
          <p className="text-sm text-gray-500">Click Regenerate to generate an LLM summary of current complaints.</p>
        )}
      </div>
    </div>
  );
}
