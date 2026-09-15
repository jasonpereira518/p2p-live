/**
 * Multimodal routing: Walk → Bus → Walk using Mapbox walking directions and GMV pattern geometry.
 * Compares walk-only vs bus-assisted and returns the best journey with geometries and steps.
 */

import type {
  Coordinate,
  Destination,
  Journey,
  JourneySegment,
  LineStringGeometry,
  LiveSnapshot,
  RoutePattern,
  Stop,
  TransitNetwork,
  WalkingStep,
} from '../types';
import { findKNearestStops } from './geo';
import { sliceRouteByDistance } from './routeInterpolation';
import { getUpcomingRouteArrivals, isRouteOperatingNow } from './serviceSchedule';
import { ROUTE_IDS, ROUTE_NAMES } from '../data/routes';
import { getActivePattern } from './transitSelectors';
import { fallbackRideSec, rideDistanceMeters } from './tripPlanning';

const BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_OPS_API_URL) || '';
const K_NEAREST = 6;
const MAX_WALK_METERS = 1200;
const MAX_WALK_DURATION_SEC = 15 * 60;
const WALK_ONLY_MARGIN_SEC = 90;

export interface WalkDirectionsResult {
  durationSec: number;
  distanceMeters: number;
  geometry: { type: string; coordinates: [number, number][] };
  steps: { instruction: string; distanceMeters: number; durationSec: number }[];
}

export async function getWalkDirections(from: Coordinate, to: Coordinate): Promise<WalkDirectionsResult | null> {
  const fromStr = `${from.lon},${from.lat}`;
  const toStr = `${to.lon},${to.lat}`;
  try {
    const res = await fetch(`${BASE}/api/mapbox/directions/walk?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.geometry || !data.geometry.coordinates) return null;
    return {
      durationSec: data.durationSec ?? 0,
      distanceMeters: data.distanceMeters ?? 0,
      geometry: data.geometry,
      steps: Array.isArray(data.steps) ? data.steps : [],
    };
  } catch {
    return null;
  }
}

/** A stop on a pattern, in pattern order (first occurrence only). */
interface PatternStopRef {
  stop: Stop;
  distAlong: number;
  index: number;
}

function patternStopRefs(pattern: RoutePattern, stopsById: Map<string, Stop>): PatternStopRef[] {
  const seen = new Set<string>();
  const refs: PatternStopRef[] = [];
  for (const ps of pattern.stops) {
    const stop = stopsById.get(ps.stopId);
    if (!stop || seen.has(ps.stopId)) continue;
    seen.add(ps.stopId);
    refs.push({ stop, distAlong: ps.distAlong, index: refs.length });
  }
  return refs;
}

/** Ordered stops from board index to alight index (forward, with wrap). */
function orderedStopsBetween(stops: PatternStopRef[], boardIndex: number, alightIndex: number): PatternStopRef[] {
  const n = stops.length;
  if (n === 0) return [];
  if (boardIndex === alightIndex) return [stops[boardIndex]];
  const out: PatternStopRef[] = [];
  let i = boardIndex;
  while (true) {
    out.push(stops[i]);
    if (i === alightIndex) break;
    i = (i + 1) % n;
    if (out.length > n) break;
  }
  return out;
}

function walkSegment(
  fromName: string,
  toName: string,
  fromCoords: Coordinate,
  toCoords: Coordinate,
  walk: WalkDirectionsResult
): JourneySegment {
  return {
    type: 'walk',
    fromName,
    toName,
    fromCoords,
    toCoords,
    distanceMeters: walk.distanceMeters,
    durationMin: Math.ceil(walk.durationSec / 60),
    instruction: `Walk to ${toName}`,
    geometry: walk.geometry as LineStringGeometry,
    steps: walk.steps as WalkingStep[],
  };
}

interface StopCandidate {
  ref: PatternStopRef;
  walk: WalkDirectionsResult;
}

export interface MultimodalInput {
  origin: Coordinate;
  destination: Destination;
  network: TransitNetwork | null;
  snapshot: LiveSnapshot | null;
}

export async function computeMultimodalRoute(input: MultimodalInput): Promise<Journey> {
  const { origin, destination, network, snapshot } = input;
  const destCoord: Coordinate = { lat: destination.lat, lon: destination.lon };
  const now = new Date();

  const walkOnly = await getWalkDirections(origin, destCoord);
  const walkOnlyDurationSec = walkOnly ? walkOnly.durationSec : Infinity;

  let bestTotalSec = walkOnlyDurationSec;
  let bestSegments: JourneySegment[] =
    walkOnly && walkOnly.geometry ? [walkSegment('Current Location', destination.name, origin, destCoord, walkOnly)] : [];

  const stopsById = new Map((network?.stops ?? []).map((s) => [s.id, s]));

  for (const routeId of ROUTE_IDS) {
    if (!isRouteOperatingNow(routeId, now)) continue;
    const pattern = getActivePattern(network, snapshot, routeId);
    if (!pattern || pattern.geometry.coordinates.length < 2) continue;
    const refs = patternStopRefs(pattern, stopsById);
    if (refs.length < 2) continue;
    const refByStopId = new Map(refs.map((r) => [r.stop.id, r]));
    const routeStops = refs.map((r) => r.stop);
    const routeName = ROUTE_NAMES[routeId];
    const waitSec = (getUpcomingRouteArrivals(routeId, now, 1)[0] ?? 0) * 60;

    const boardCandidates: StopCandidate[] = [];
    for (const { stop, distanceMeters } of findKNearestStops(origin, routeStops, K_NEAREST)) {
      if (distanceMeters > MAX_WALK_METERS) continue;
      const walk = await getWalkDirections(origin, { lat: stop.lat, lon: stop.lon });
      if (!walk || walk.durationSec > MAX_WALK_DURATION_SEC) continue;
      boardCandidates.push({ ref: refByStopId.get(stop.id)!, walk });
    }

    const alightCandidates: StopCandidate[] = [];
    for (const { stop, distanceMeters } of findKNearestStops(destCoord, routeStops, K_NEAREST)) {
      if (distanceMeters > MAX_WALK_METERS) continue;
      const walk = await getWalkDirections({ lat: stop.lat, lon: stop.lon }, destCoord);
      if (!walk || walk.durationSec > MAX_WALK_DURATION_SEC) continue;
      alightCandidates.push({ ref: refByStopId.get(stop.id)!, walk });
    }

    for (const board of boardCandidates) {
      for (const alight of alightCandidates) {
        if (board.ref.stop.id === alight.ref.stop.id) continue;
        const forwardStops = orderedStopsBetween(refs, board.ref.index, alight.ref.index);
        const distance = rideDistanceMeters(board.ref.distAlong, alight.ref.distAlong, pattern.lengthMeters);
        const busDurationSec = fallbackRideSec(distance, forwardStops.length - 2);
        const totalSec = board.walk.durationSec + waitSec + busDurationSec + alight.walk.durationSec;
        if (totalSec >= bestTotalSec) continue;

        const busGeometry = sliceRouteByDistance(pattern.geometry.coordinates, board.ref.distAlong, alight.ref.distAlong);
        if (busGeometry.length < 2) continue;

        const boardCoords: Coordinate = { lat: board.ref.stop.lat, lon: board.ref.stop.lon };
        const alightCoords: Coordinate = { lat: alight.ref.stop.lat, lon: alight.ref.stop.lon };
        bestTotalSec = totalSec;
        bestSegments = [
          walkSegment('Current Location', board.ref.stop.name, origin, boardCoords, board.walk),
          {
            type: 'bus',
            fromName: board.ref.stop.name,
            toName: alight.ref.stop.name,
            fromCoords: boardCoords,
            toCoords: alightCoords,
            distanceMeters: 0,
            durationMin: Math.ceil(busDurationSec / 60),
            instruction: `Ride ${routeName}`,
            routeId,
            routeName,
            stopsCount: forwardStops.length,
            waitTimeMin: Math.ceil(waitSec / 60),
            busSegmentGeometry: { type: 'LineString', coordinates: busGeometry },
            busOrderedStopIds: forwardStops.map((s) => s.stop.id),
          },
          walkSegment(alight.ref.stop.name, destination.name, alightCoords, destCoord, alight.walk),
        ];
      }
    }
  }

  if (walkOnly && walkOnly.geometry && walkOnlyDurationSec <= bestTotalSec + WALK_ONLY_MARGIN_SEC) {
    bestTotalSec = walkOnlyDurationSec;
    bestSegments = [walkSegment('Current Location', destination.name, origin, destCoord, walkOnly)];
  }

  const totalDurationMin = Math.ceil(bestTotalSec / 60);
  const arrivalTime = new Date(now.getTime() + bestTotalSec * 1000);

  return {
    id: `journey-${Date.now()}`,
    destination,
    totalDurationMin,
    segments: bestSegments,
    startTime: now,
    arrivalTime,
  };
}
