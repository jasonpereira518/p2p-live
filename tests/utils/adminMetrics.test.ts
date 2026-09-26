import { describe, it, expect } from 'vitest';
import { buildRouteMetrics } from '../../utils/adminMetrics';
import { makeNetwork, makeSnapshot, makeVehicle } from '../fixtures/transit';

describe('buildRouteMetrics', () => {
  const network = makeNetwork();
  const vehicles = [makeVehicle({ id: 'v1', load: 0.5 }), makeVehicle({ id: 'v2', load: 0.25 })];
  const snapshot = makeSnapshot({
    vehicles,
    arrivalsByStop: {
      b: [
        { routeId: 'P2P_EXPRESS', vehicleId: 'v1', etaSec: 60, scheduled: false },
        { routeId: 'P2P_EXPRESS', vehicleId: 'v2', etaSec: 660, scheduled: false },
      ],
    },
  });

  it('derives route length, loop estimate, buses, fullness and headway from live data', () => {
    const m = buildRouteMetrics('P2P_EXPRESS', network, snapshot, vehicles, { gps: 1, freeze: 0 });
    expect(m.distanceMeters).toBe(3000);
    expect(m.durationSec).toBe(560); // 3000 m / 6 m/s + 3 stops × 20 s
    expect(m.activeBuses).toBe(2);
    expect(m.averageFullnessPercent).toBe(38); // (50 + 25) / 2 rounded
    expect(m.headwayMin).toBe(10);
    expect(m.averageWaitMin).toBe(5);
    expect(m.gpsDropoutsToday).toBe(1);
  });

  it('reports nulls for a route with no buses', () => {
    const m = buildRouteMetrics('BAITY_HILL', network, snapshot, vehicles, { gps: 0, freeze: 0 });
    expect(m).toMatchObject({ activeBuses: 0, averageFullnessPercent: null, headwayMin: null, averageWaitMin: null });
  });
});
