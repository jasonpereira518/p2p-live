/**
 * Bus-leg math for Plan Trip.
 */

import type { LiveVehicle, RouteId } from '../types';

export const BUS_SPEED_MPS = 6;
export const DWELL_SEC_PER_STOP = 20;

/** Meters from the board stop to the alight stop along a loop pattern, wrapping past the end. */
export function rideDistanceMeters(boardDist: number, alightDist: number, lengthMeters: number): number {
  const d = alightDist - boardDist;
  return d > 0 ? d : d + lengthMeters;
}

/** Estimated ride time when no live prediction covers both stops. */
export function fallbackRideSec(distanceMeters: number, intermediateStops: number): number {
  return Math.ceil(distanceMeters / BUS_SPEED_MPS + Math.max(0, intermediateStops) * DWELL_SEC_PER_STOP);
}

export interface BusLegEstimate {
  /** Seconds waiting at the board stop after walking there. */
  waitSec: number;
  rideSec: number;
  source: 'live' | 'scheduled';
  vehicleId: string | null;
}

export interface BusLegInput {
  vehicles: LiveVehicle[];
  routeId: RouteId;
  boardStopId: string;
  alightStopId: string;
  /** Seconds until the rider reaches the board stop. */
  walkToBoardSec: number;
  /** Non-live arrivals at the board stop (seconds from now), used when no live bus fits. */
  scheduledArrivalsSec: number[];
  fallbackRideSec: number;
}

/** Earliest live bus the rider can catch (ride time from its own predictions), else the next scheduled arrival. */
export function estimateBusLeg(input: BusLegInput): BusLegEstimate | null {
  const { vehicles, routeId, boardStopId, alightStopId, walkToBoardSec, scheduledArrivalsSec } = input;
  let best: BusLegEstimate | null = null;
  let bestBoardEta = Infinity;

  for (const v of vehicles) {
    if (v.routeId !== routeId || v.stale) continue;
    const board = v.upcomingStops.find((s) => s.stopId === boardStopId && s.etaSec >= walkToBoardSec);
    if (!board) continue;
    const alight = v.upcomingStops.find((s) => s.stopId === alightStopId && s.etaSec > board.etaSec);
    if (board.etaSec < bestBoardEta || (board.etaSec === bestBoardEta && alight)) {
      bestBoardEta = board.etaSec;
      best = {
        waitSec: board.etaSec - walkToBoardSec,
        rideSec: alight ? alight.etaSec - board.etaSec : input.fallbackRideSec,
        source: 'live',
        vehicleId: v.id,
      };
    }
  }
  if (best) return best;

  const next = [...scheduledArrivalsSec].sort((a, b) => a - b).find((s) => s >= walkToBoardSec);
  if (next == null) return null;
  return { waitSec: next - walkToBoardSec, rideSec: input.fallbackRideSec, source: 'scheduled', vehicleId: null };
}
