import { describe, it, expect } from 'vitest';
import { buildFleetRows, distanceFromLineMeters, isOffRoute, medianHeadwayMin } from '../../utils/fleet';
import { LINE, makeNetwork, makeSnapshot, makeVehicle } from '../fixtures/transit';

const network = makeNetwork();

describe('distanceFromLineMeters', () => {
  it('measures the perpendicular distance to the nearest segment', () => {
    expect(distanceFromLineMeters(LINE, [-79.045, 35.901])).toBeCloseTo(111.2, 0);
  });
});

describe('isOffRoute', () => {
  it('is false on the pattern line and true far from it', () => {
    expect(isOffRoute(makeVehicle({ lat: 35.9, lon: -79.045 }), network)).toBe(false);
    expect(isOffRoute(makeVehicle({ lat: 35.95, lon: -79.045 }), network)).toBe(true);
  });
  it('is false when stale or the pattern is unknown', () => {
    expect(isOffRoute(makeVehicle({ lat: 35.95, lon: -79.045, stale: true }), network)).toBe(false);
    expect(isOffRoute(makeVehicle({ lat: 35.95, lon: -79.045, patternId: 404 }), network)).toBe(false);
  });
});

describe('buildFleetRows', () => {
  it('maps live vehicles to fleet rows', () => {
    const [row] = buildFleetRows([makeVehicle({ lat: 35.9, lon: -79.045 })], network);
    expect(row).toEqual({
      busId: 'v1', busLabel: 'Bus 1', routeName: 'P2P Express', runLabel: 'P2P Express',
      capacityCurrent: 20, capacityMax: 40, isOffRoute: false, lastUpdated: '2026-09-14T23:00:00.000Z',
    });
  });
});

describe('medianHeadwayMin', () => {
  it('takes the median gap between consecutive live vehicles at each stop', () => {
    const snapshot = makeSnapshot({
      arrivalsByStop: {
        b: [
          { routeId: 'P2P_EXPRESS', vehicleId: 'v1', etaSec: 90, scheduled: false },
          { routeId: 'P2P_EXPRESS', vehicleId: 'v2', etaSec: 690, scheduled: false },
          { routeId: 'P2P_EXPRESS', vehicleId: null, etaSec: 700, scheduled: true },
        ],
        c: [
          { routeId: 'P2P_EXPRESS', vehicleId: 'v1', etaSec: 300, scheduled: false },
          { routeId: 'P2P_EXPRESS', vehicleId: 'v2', etaSec: 1500, scheduled: false },
          { routeId: 'BAITY_HILL', vehicleId: 'v9', etaSec: 310, scheduled: false },
        ],
      },
    });
    expect(medianHeadwayMin(snapshot, 'P2P_EXPRESS')).toBe(15);
  });
  it('returns null with fewer than two vehicles', () => {
    expect(medianHeadwayMin(makeSnapshot(), 'P2P_EXPRESS')).toBeNull();
    expect(medianHeadwayMin(null, 'P2P_EXPRESS')).toBeNull();
  });
});
