/**
 * Bus-leg math for Plan Trip.
 */

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
