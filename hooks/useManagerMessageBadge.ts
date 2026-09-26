/**
 * Lightweight hook used by the manager dashboard tab badge.
 * Polls /api/messages/conversations every 10s to surface unread count even when the
 * Messages tab is not yet rendered (so the realtime hook isn't mounted).
 */

import { useEffect, useState } from 'react';
import { fetchConversations } from '../utils/messagesApi';
import { getSession } from '../ops/auth';

const POLL_INTERVAL_MS = 10_000;

export function useManagerMessageBadge(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== 'manager') {
      setCount(0);
      return;
    }
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const data = await fetchConversations();
        if (!cancelled) setCount(data.totalUnread || 0);
      } catch (_) {
        /* ignore */
      }
    };

    tick();
    timer = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return count;
}
