import type { LiveSnapshot, TransitNetwork } from '../types';
import { API } from './api';
import { displayStopName } from '../data/stopDisplayNames';

export function withDisplayNames(network: TransitNetwork): TransitNetwork {
  return { ...network, stops: network.stops.map((s) => ({ ...s, name: displayStopName(s.id, s.name) })) };
}

export async function fetchNetwork(signal?: AbortSignal): Promise<TransitNetwork> {
  const res = await fetch(`${API}/api/live/network`, { signal });
  if (!res.ok) throw new Error(`Transit network request failed (${res.status})`);
  return withDisplayNames((await res.json()) as TransitNetwork);
}

export async function fetchSnapshot(signal?: AbortSignal): Promise<LiveSnapshot> {
  const res = await fetch(`${API}/api/live/snapshot`, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`Live snapshot request failed (${res.status})`);
  return (await res.json()) as LiveSnapshot;
}
