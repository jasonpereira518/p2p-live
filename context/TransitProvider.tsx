/**
 * Shared live-transit state: loads the network once and polls the snapshot every 6 s
 * while the tab is visible (backing off on errors). Mounted once in RouterApp.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ClientLiveStatus, LiveSnapshot, LiveVehicle, StopArrival, TransitNetwork } from '../types';
import { fetchNetwork, fetchSnapshot } from '../utils/transitApi';
import { deriveClientStatus, nextPollDelayMs, visibleVehicles } from '../utils/livePolling';
import { getStopArrivals } from '../utils/arrivals';

const NETWORK_RETRY_MS = 30000;

export interface TransitContextValue {
  network: TransitNetwork | null;
  snapshot: LiveSnapshot | null;
  status: ClientLiveStatus;
  /** Empty unless status is 'live' or 'degraded'. */
  vehicles: LiveVehicle[];
  /** Client clock (ms) when the current snapshot arrived. */
  snapshotReceivedAt: number | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const TransitContext = createContext<TransitContextValue | null>(null);

export function TransitProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<TransitNetwork | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await fetchNetwork();
        if (!cancelled) setNetwork(next);
      } catch {
        if (!cancelled) timer = setTimeout(load, NETWORK_RETRY_MS);
      }
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  /** Fetch one snapshot. Resolves true on success (or when a fetch is already running). */
  const pollOnce = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) return true;
    inFlightRef.current = true;
    try {
      const next = await fetchSnapshot();
      setSnapshot(next);
      setReceivedAt(Date.now());
      return true;
    } catch {
      return false;
    } finally {
      inFlightRef.current = false;
      setAttempted(true);
      setClock(Date.now());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const tick = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const ok = await pollOnce();
      failures = ok ? 0 : failures + 1;
      if (!cancelled) timer = setTimeout(tick, nextPollDelayMs(failures));
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (timer) clearTimeout(timer);
      tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollOnce]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await pollOnce();
    } finally {
      setRefreshing(false);
    }
  }, [pollOnce]);

  const status = deriveClientStatus(snapshot, receivedAt, clock, attempted);
  const value = useMemo<TransitContextValue>(
    () => ({
      network,
      snapshot,
      status,
      vehicles: visibleVehicles(snapshot, status),
      snapshotReceivedAt: receivedAt,
      refreshing,
      refresh,
    }),
    [network, snapshot, status, receivedAt, refreshing, refresh]
  );

  return <TransitContext.Provider value={value}>{children}</TransitContext.Provider>;
}

export function useTransit(): TransitContextValue {
  const value = useContext(TransitContext);
  if (!value) throw new Error('useTransit must be used inside <TransitProvider>');
  return value;
}

export function useStopArrivals(stopId: string | null, limit = 5): StopArrival[] {
  const { network, snapshot, status } = useTransit();
  return useMemo(
    () => (stopId ? getStopArrivals({ stopId, snapshot, status, network, now: new Date(), limit }) : []),
    [stopId, snapshot, status, network, limit]
  );
}
