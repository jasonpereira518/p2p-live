import { describe, it, expect } from 'vitest';
import { estimateBusLeg, fallbackRideSec, rideDistanceMeters } from '../../utils/tripPlanning';
import { makeVehicle } from '../fixtures/transit';

describe('rideDistanceMeters', () => {
  it('measures forward along the pattern', () => {
    expect(rideDistanceMeters(900, 2000, 3000)).toBe(1100);
  });
  it('wraps past the end of a loop', () => {
    expect(rideDistanceMeters(2000, 900, 3000)).toBe(1900);
  });
});

describe('fallbackRideSec', () => {
  it('uses 6 m/s plus 20 s per intermediate stop, rounded up', () => {
    expect(fallbackRideSec(600, 2)).toBe(140);
    expect(fallbackRideSec(601, 0)).toBe(101);
  });
});

describe('estimateBusLeg', () => {
  const base = {
    routeId: 'P2P_EXPRESS' as const,
    boardStopId: 'b',
    alightStopId: 'c',
    walkToBoardSec: 60,
    scheduledArrivalsSec: [] as number[],
    fallbackRideSec: 500,
  };
  const v1 = makeVehicle({ id: 'v1', upcomingStops: [{ stopId: 'b', etaSec: 90 }, { stopId: 'c', etaSec: 300 }] });
  const v2 = makeVehicle({ id: 'v2', upcomingStops: [{ stopId: 'b', etaSec: 400 }, { stopId: 'c', etaSec: 700 }] });

  it('picks the earliest live bus the rider can reach, with ride time from its predictions', () => {
    expect(estimateBusLeg({ ...base, vehicles: [v2, v1] })).toEqual({ waitSec: 30, rideSec: 210, source: 'live', vehicleId: 'v1' });
  });

  it('skips a bus that arrives before the rider can reach the stop', () => {
    expect(estimateBusLeg({ ...base, walkToBoardSec: 120, vehicles: [v1, v2] })).toEqual({ waitSec: 280, rideSec: 300, source: 'live', vehicleId: 'v2' });
  });

  it('uses the fallback ride time when the alight stop is not predicted', () => {
    const v = makeVehicle({ upcomingStops: [{ stopId: 'b', etaSec: 90 }] });
    expect(estimateBusLeg({ ...base, vehicles: [v] })).toMatchObject({ rideSec: 500, source: 'live' });
  });

  it('ignores stale buses and other routes, then falls back to the first reachable scheduled arrival', () => {
    const stale = { ...v1, stale: true };
    const baity = { ...v1, id: 'v3', routeId: 'BAITY_HILL' as const };
    expect(estimateBusLeg({ ...base, vehicles: [stale, baity], scheduledArrivalsSec: [30, 600] })).toEqual({
      waitSec: 540, rideSec: 500, source: 'scheduled', vehicleId: null,
    });
  });

  it('returns null when no bus fits', () => {
    expect(estimateBusLeg({ ...base, vehicles: [] })).toBeNull();
  });
});
