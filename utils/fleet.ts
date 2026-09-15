/**
 * Fleet views for ops: rows for the Fleet tab, off-route detection, live headways.
 */

import type { LiveSnapshot, LiveVehicle, RouteId, TransitNetwork } from '../types';
import type { FleetStatusRow } from '../data/mockOps';
import { haversineMeters, projectPointToRoute, type LngLat } from './routeInterpolation';
import { getPattern } from './transitSelectors';
import { getLoadInfo } from './vehicleDisplay';

export const OFF_ROUTE_METERS = 60;

export function distanceFromLineMeters(line: LngLat[], point: LngLat): number {
  if (line.length < 2) return Infinity;
  const { nearestPoint } = projectPointToRoute(line, point);
  return haversineMeters(point, nearestPoint);
}

/** A bus is off route when it is more than `thresholdMeters` from its own pattern line. */
export function isOffRoute(
  vehicle: LiveVehicle,
  network: TransitNetwork | null,
  thresholdMeters: number = OFF_ROUTE_METERS
): boolean {
  if (vehicle.stale) return false;
  const pattern = getPattern(network, vehicle.patternId);
  if (!pattern) return false;
  return distanceFromLineMeters(pattern.geometry.coordinates, [vehicle.lon, vehicle.lat]) > thresholdMeters;
}

export function buildFleetRows(vehicles: LiveVehicle[], network: TransitNetwork | null): FleetStatusRow[] {
  return vehicles.map((v) => {
    const load = getLoadInfo(v);
    return {
      busId: v.id,
      busLabel: v.name,
      routeName: v.routeName,
      runLabel: getPattern(network, v.patternId)?.name ?? '—',
      capacityCurrent: load?.riders ?? 0,
      capacityMax: v.capacity ?? 0,
      isOffRoute: isOffRoute(v, network),
      lastUpdated: v.lastUpdated ?? '',
    };
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median gap (minutes) between consecutive live buses arriving at the same stop. */
export function medianHeadwayMin(snapshot: LiveSnapshot | null, routeId: RouteId): number | null {
  if (!snapshot) return null;
  const gaps: number[] = [];
  for (const arrivals of Object.values(snapshot.arrivalsByStop)) {
    const firstEtaByVehicle = new Map<string, number>();
    for (const a of arrivals) {
      if (a.routeId !== routeId || a.scheduled || !a.vehicleId) continue;
      const prev = firstEtaByVehicle.get(a.vehicleId);
      if (prev == null || a.etaSec < prev) firstEtaByVehicle.set(a.vehicleId, a.etaSec);
    }
    const etas = [...firstEtaByVehicle.values()].sort((x, y) => x - y);
    for (let i = 1; i < etas.length; i++) gaps.push(etas[i] - etas[i - 1]);
  }
  const m = median(gaps);
  return m == null ? null : m / 60;
}
