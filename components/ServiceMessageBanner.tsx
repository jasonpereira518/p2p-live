import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTransit } from '../context/TransitProvider';
import { getBannerMessages } from '../utils/serviceMessages';
import { ROUTE_NAMES } from '../data/routes';

const DISMISSED_KEY = 'p2p-dismissed-service-messages';

function readDismissed(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function ServiceMessageBanner() {
  const { snapshot } = useTransit();
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const messages = getBannerMessages(snapshot?.messages ?? [], dismissed);
  if (messages.length === 0) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    } catch {
      // ignore storage errors
    }
  };

  return (
    <>
      {messages.map((m) => (
        <div
          key={m.id}
          role="status"
          className="pointer-events-auto w-full max-w-md rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm relative"
        >
          <button
            type="button"
            onClick={() => dismiss(m.id)}
            className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full p-1.5 text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            aria-label="Dismiss service message"
          >
            <X size={14} />
          </button>
          <p className="text-sm font-semibold text-sky-900 pr-6">{m.title}</p>
          {m.body && <p className="text-xs text-sky-800/90 mt-1 pr-6">{m.body}</p>}
          {m.routeIds.length > 0 && (
            <p className="text-[11px] font-medium text-sky-700 mt-1">{m.routeIds.map((r) => ROUTE_NAMES[r]).join(' • ')}</p>
          )}
        </div>
      ))}
    </>
  );
}
