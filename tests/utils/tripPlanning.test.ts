import { describe, it, expect } from 'vitest';
import { busTripTimes, estimateBusLeg, fallbackRideSec, recommendedMode, rideDistanceMeters, tripComparison, type TripOptions } from '../../utils/tripPlanning';
import type { Journey, JourneySegment } from '../../types';
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

const start = new Date(2026, 8, 22, 21, 0, 0);
const place = { lat: 35.91, lon: -79.05 };
const walkLeg = (sec: number, meters: number): JourneySegment => ({ type: 'walk', fromName: 'A', toName: 'B', fromCoords: place, toCoords: place, durationMin: Math.ceil(sec / 60), durationSec: sec, distanceMeters: meters, instruction: 'Walk' });
const journey = (segments: JourneySegment[]): Journey => {
  const total = segments.reduce((t, s) => t + (s.durationSec ?? 0) + (s.waitSec ?? 0), 0);
  return { id: 'j', destination: { id: 'd', name: 'Davis Library', ...place }, totalDurationMin: Math.ceil(total / 60), segments, startTime: start, arrivalTime: new Date(start.getTime() + total * 1000) };
};
const busJourney = (walkIn: number, wait: number, ride: number, walkOut: number) => journey([
  walkLeg(walkIn, 250),
  { type: 'bus', fromName: 'Student Union', toName: 'Davis', fromCoords: place, toCoords: place, durationMin: Math.ceil(ride / 60), durationSec: ride, waitSec: wait, distanceMeters: 0, instruction: 'Ride P2P Express', routeId: 'P2P_EXPRESS', routeName: 'P2P Express' },
  walkLeg(walkOut, 250),
]);

describe('recommendedMode', () => {
  it('prefers walking unless the bus saves more than 90 seconds', () => {
    expect(recommendedMode(600, 540)).toBe('walk');
    expect(recommendedMode(600, 500)).toBe('bus');
    expect(recommendedMode(600, null)).toBe('walk');
    expect(recommendedMode(null, 900)).toBe('bus');
  });
});

describe('tripComparison', () => {
  const walk = journey([walkLeg(900, 1130)]);
  const options = (bus: Journey | null, busUnavailable: TripOptions['busUnavailable'] = null): TripOptions => ({ walk, bus, busUnavailable, recommended: 'walk' });
  it('says how much faster walking is and how much walking the bus saves', () => {
    expect(tripComparison(options(busJourney(180, 240, 420, 240)))).toBe('Walking is 3 min faster. The bus cuts your walk from 0.7 mi to 0.3 mi.');
  });
  it('says how much faster the bus is', () => {
    expect(tripComparison(options(busJourney(120, 60, 180, 120)))).toBe('The bus is 7 min faster and cuts your walk from 0.7 mi to 0.3 mi.');
  });
  it('calls near-equal times about the same', () => {
    expect(tripComparison(options(busJourney(180, 120, 420, 180)))).toBe('Both take about the same time. The bus cuts your walk from 0.7 mi to 0.3 mi.');
  });
  it('notes when the bus trip means more walking', () => {
    const shortWalk = { ...options(busJourney(240, 60, 60, 240)), walk: journey([walkLeg(180, 220)]) };
    expect(tripComparison(shortWalk)).toBe('Walking is 7 min faster. The bus trip has more walking (0.3 mi vs 720 ft).');
  });
  it('explains why there is no bus option', () => {
    expect(tripComparison(options(null, 'not-running'))).toBe("Buses aren't running right now. Service starts at 7:00 PM.");
    expect(tripComparison(options(null, 'no-stops'))).toMatch(/No bus stops/);
  });
});

describe('busTripTimes', () => {
  it('gives clock times, leaving a minute of slack at the stop', () => {
    const t = busTripTimes(busJourney(180, 300, 420, 240), start)!;
    expect(t.leaveInMin).toBe(4);
    expect(t.leaveAt.getMinutes()).toBe(4);
    expect(t.waitAtStopSec).toBe(60);
    expect(t.boardAt.getMinutes()).toBe(8);
    expect(t.alightAt.getMinutes()).toBe(15);
    expect(t.arriveAt.getMinutes()).toBe(19);
    expect(t.missed).toBe(false);
  });
  it('says go now when the bus is close, and flags a bus that already left', () => {
    expect(busTripTimes(busJourney(180, 30, 420, 240), start)!.leaveInMin).toBe(0);
    expect(busTripTimes(busJourney(180, 30, 420, 240), new Date(start.getTime() + 10 * 60000))!.missed).toBe(true);
    expect(busTripTimes(journey([walkLeg(600, 800)]), start)).toBeNull();
  });
});
