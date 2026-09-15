import type { Coordinate, LiveSnapshot, LiveVehicle, RouteId, Stop, TransitNetwork } from '../types';
import { getDistanceMeters } from './geo';
import { getActivePattern, getActiveStops } from './transitSelectors';
import { fallbackRideSec } from './tripPlanning';
import { medianHeadwayMin } from './fleet';
import { getLoadInfo } from './vehicleDisplay';

const CAMPUS_BBOX = { west: -79.08, south: 35.89, east: -79.03, north: 35.93 };
const CACHE_KEY = 'p2p-admin-metrics-v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (under the 24 h GMV storage limit)

export interface RouteMetrics {
  distanceMeters: number | null;
  durationSec: number | null;
  loopDurationMin: number | null;
  efficiencyScore: number | null; // 0–100, 100 = optimal
  activeBuses: number;
  headwayMin: number | null;
  averageWaitMin: number | null; // half headway
  averageFullnessPercent: number | null;
  etaAccuracyPercent: number | null;
  gpsDropoutsToday: number | null;
  trackerFreezesToday: number | null;
}

export interface AdminMetrics {
  generatedAt: number;
  system: {
    apiLatencyAvgMs: number | null;
    apiLatencyP95Ms: number | null;
    liveApiLatencyAvgMs: number | null;
    liveApiLatencyP95Ms: number | null;
  };
  routes: Record<RouteId, RouteMetrics>;
  optimization: {
    averageWalkTimeMin: number | null;
    averageWaitTimeMin: number | null;
    mostCongestedStopName: string | null;
    mostUnderutilizedStopName: string | null;
  };
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

async function timeFetch(url: string, init?: RequestInit, samples = 3): Promise<{ avg: number | null; p95: number | null }> {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const res = await fetch(url, init);
    try {
      await res.text();
    } catch {
      /* ignore */
    }
    const end = performance.now();
    if (res.ok) times.push(end - start);
  }
  const avg = times.length ? times.reduce((s, v) => s + v, 0) / times.length : null;
  const p95 = percentile(times, 0.95);
  return { avg: avg != null ? Math.round(avg) : null, p95: p95 != null ? Math.round(p95) : null };
}

async function fetchWalkDurationSec(from: Coordinate, to: Coordinate): Promise<number | null> {
  const fromStr = `${from.lon},${from.lat}`;
  const toStr = `${to.lon},${to.lat}`;
  const res = await fetch(`/api/mapbox/directions/walk?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.durationSec === 'number' ? data.durationSec : null;
}

function randomCampusPoints(count: number, seed: number): Coordinate[] {
  const rand = mulberry32(seed);
  const pts: Coordinate[] = [];
  for (let i = 0; i < count; i++) {
    const lon = CAMPUS_BBOX.west + rand() * (CAMPUS_BBOX.east - CAMPUS_BBOX.west);
    const lat = CAMPUS_BBOX.south + rand() * (CAMPUS_BBOX.north - CAMPUS_BBOX.south);
    pts.push({ lat, lon });
  }
  return pts;
}

export function getCachedAdminMetrics(): AdminMetrics | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminMetrics;
    if (!parsed?.generatedAt) return null;
    if (Date.now() - parsed.generatedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedAdminMetrics(metrics: AdminMetrics) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(metrics));
  } catch {
    /* ignore */
  }
}

export function buildRouteMetrics(
  routeId: RouteId,
  network: TransitNetwork,
  snapshot: LiveSnapshot | null,
  vehicles: LiveVehicle[],
  issues: { gps: number; freeze: number }
): RouteMetrics {
  const pattern = getActivePattern(network, snapshot, routeId);
  const distanceMeters = pattern ? pattern.lengthMeters : null;
  // Estimated loop time: length at the average bus speed plus dwell at every stop.
  const durationSec = pattern ? fallbackRideSec(pattern.lengthMeters, pattern.stops.length) : null;
  const routeVehicles = vehicles.filter((v) => v.routeId === routeId);
  const loads = routeVehicles
    .map((v) => getLoadInfo(v)?.percent)
    .filter((p): p is number => typeof p === 'number');
  const headwayMin = medianHeadwayMin(snapshot, routeId);

  return {
    distanceMeters,
    durationSec,
    loopDurationMin: durationSec != null ? durationSec / 60 : null,
    efficiencyScore:
      distanceMeters != null && durationSec
        ? Math.min(100, Math.round(((distanceMeters / 8.9408) / durationSec) * 100))
        : null,
    activeBuses: routeVehicles.length,
    headwayMin,
    averageWaitMin: headwayMin != null ? headwayMin / 2 : null,
    averageFullnessPercent: loads.length ? Math.round(loads.reduce((s, v) => s + v, 0) / loads.length) : null,
    etaAccuracyPercent: null,
    gpsDropoutsToday: issues.gps,
    trackerFreezesToday: issues.freeze,
  };
}

export async function computeAdminMetrics(input: {
  network: TransitNetwork;
  snapshot: LiveSnapshot | null;
  vehicles: LiveVehicle[];
  complaints?: Array<{ route?: string; category?: string; notes?: string }>;
}): Promise<AdminMetrics> {
  const { network, snapshot, vehicles, complaints = [] } = input;
  const stops: Stop[] = getActiveStops(network, snapshot);

  const [apiLatency, liveLatency] = await Promise.all([
    timeFetch('/healthz', undefined, 3),
    timeFetch('/api/live/snapshot', undefined, 2),
  ]);

  const countIssues = (routeLabel: string) => {
    const subset = complaints.filter((c) => (c.route || '').toLowerCase().includes(routeLabel.toLowerCase()));
    const gps = subset.filter((c) => `${c.category ?? ''} ${c.notes ?? ''}`.toLowerCase().includes('gps')).length;
    const freeze = subset.filter((c) => `${c.category ?? ''} ${c.notes ?? ''}`.toLowerCase().includes('freeze')).length;
    return { gps, freeze };
  };

  // Walk-time sampling: random campus points → nearest stop → Mapbox walking.
  const samplePoints = randomCampusPoints(8, 1337);
  const nearestCounts: Record<string, number> = {};
  const walkDurationsMin: number[] = [];

  for (const p of samplePoints) {
    let nearest: Stop | null = null;
    let best = Infinity;
    for (const s of stops) {
      const d = getDistanceMeters(p, s);
      if (d < best) {
        best = d;
        nearest = s;
      }
    }
    if (!nearest) continue;
    nearestCounts[nearest.id] = (nearestCounts[nearest.id] || 0) + 1;
    const durSec = await fetchWalkDurationSec(p, { lat: nearest.lat, lon: nearest.lon });
    walkDurationsMin.push(durSec != null && durSec > 0 ? durSec / 60 : best / 1.4 / 60);
  }

  let mostCongestedStopName: string | null = null;
  let mostUnderutilizedStopName: string | null = null;
  const nearestEntries = Object.entries(nearestCounts);
  if (nearestEntries.length) {
    nearestEntries.sort((a, b) => b[1] - a[1]);
    mostCongestedStopName = stops.find((s) => s.id === nearestEntries[0][0])?.name ?? null;
    mostUnderutilizedStopName = stops.find((s) => s.id === nearestEntries[nearestEntries.length - 1][0])?.name ?? null;
  }

  const avgWalk = walkDurationsMin.length ? walkDurationsMin.reduce((s, v) => s + v, 0) / walkDurationsMin.length : null;

  const routes: Record<RouteId, RouteMetrics> = {
    P2P_EXPRESS: buildRouteMetrics('P2P_EXPRESS', network, snapshot, vehicles, countIssues('P2P Express')),
    BAITY_HILL: buildRouteMetrics('BAITY_HILL', network, snapshot, vehicles, countIssues('Baity Hill')),
  };

  const waitVals = [routes.P2P_EXPRESS.averageWaitMin, routes.BAITY_HILL.averageWaitMin].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );
  const avgWait = waitVals.length ? waitVals.reduce((s, v) => s + v, 0) / waitVals.length : null;

  return {
    generatedAt: Date.now(),
    system: {
      apiLatencyAvgMs: apiLatency.avg,
      apiLatencyP95Ms: apiLatency.p95,
      liveApiLatencyAvgMs: liveLatency.avg,
      liveApiLatencyP95Ms: liveLatency.p95,
    },
    routes,
    optimization: {
      averageWalkTimeMin: avgWalk != null ? Math.round(avgWalk * 10) / 10 : null,
      averageWaitTimeMin: avgWait != null ? Math.round(avgWait * 10) / 10 : null,
      mostCongestedStopName,
      mostUnderutilizedStopName,
    },
  };
}
