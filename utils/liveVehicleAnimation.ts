/**
 * Map bus motion between live snapshots: move each bus along its pattern at its reported speed
 * for at most one poll interval, and ease the drawn position into each new report.
 */

import type { LiveVehicle, RouteId } from '../types';
import type { RouteInterpolator } from './routeInterpolation';

export const MAX_EXTRAPOLATE_SEC = 6;
export const EASE_SEC = 1;

export interface BusPosition {
  id: string;
  routeId: RouteId;
  lon: number;
  lat: number;
  bearing: number;
  stale: boolean;
}

export function extrapolateVehicle(
  v: LiveVehicle,
  interp: RouteInterpolator | null,
  elapsedSec: number,
  maxSec: number = MAX_EXTRAPOLATE_SEC
): BusPosition {
  const base = { id: v.id, routeId: v.routeId, stale: v.stale };
  if (!interp || v.stale || v.distAlong == null) {
    return { ...base, lon: v.lon, lat: v.lat, bearing: v.heading };
  }
  const t = Math.min(Math.max(elapsedSec, 0), maxSec);
  const d = v.distAlong + Math.max(v.speedMps ?? 0, 0) * t;
  const [lon, lat] = interp.pointAt(d);
  return { ...base, lon, lat, bearing: interp.bearingAt(d) };
}

export function easeToward(prev: BusPosition, target: BusPosition, dtSec: number, easeSec: number = EASE_SEC): BusPosition {
  const alpha = easeSec <= 0 ? 1 : Math.min(1, Math.max(0, dtSec / easeSec));
  return {
    ...target,
    lon: prev.lon + (target.lon - prev.lon) * alpha,
    lat: prev.lat + (target.lat - prev.lat) * alpha,
  };
}
