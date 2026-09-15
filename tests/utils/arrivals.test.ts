import { describe, it, expect } from 'vitest';
import { getStopArrivals } from '../../utils/arrivals';
import { makeNetwork, makeSnapshot } from '../fixtures/transit';

const network = makeNetwork();
const NINE_PM_MONDAY = new Date(2026, 8, 14, 21, 0);
const NOON = new Date(2026, 8, 14, 12, 0);

describe('getStopArrivals', () => {
  it('returns live arrivals with route names', () => {
    const out = getStopArrivals({ stopId: 'b', snapshot: makeSnapshot(), status: 'live', network, now: NINE_PM_MONDAY });
    expect(out).toEqual([{ routeId: 'P2P_EXPRESS', routeName: 'P2P Express', etaSec: 90, source: 'live', vehicleId: 'v1' }]);
  });

  it('labels GMV schedule predictions as scheduled', () => {
    const snapshot = makeSnapshot({
      arrivalsByStop: { b: [{ routeId: 'P2P_EXPRESS', vehicleId: null, etaSec: 600, scheduled: true }] },
    });
    const out = getStopArrivals({ stopId: 'b', snapshot, status: 'live', network, now: NINE_PM_MONDAY });
    expect(out[0]).toMatchObject({ source: 'scheduled', vehicleId: null, etaSec: 600 });
  });

  it('falls back to the timetable when the stop has no live arrivals', () => {
    const out = getStopArrivals({ stopId: 'e', snapshot: makeSnapshot(), status: 'live', network, now: NINE_PM_MONDAY });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((a) => a.routeId === 'BAITY_HILL' && a.source === 'scheduled' && a.etaSec % 60 === 0)).toBe(true);
  });

  it('ignores live data when the client status is unavailable', () => {
    const out = getStopArrivals({ stopId: 'b', snapshot: makeSnapshot(), status: 'unavailable', network, now: NINE_PM_MONDAY });
    expect(out.every((a) => a.source === 'scheduled' && a.routeId === 'P2P_EXPRESS')).toBe(true);
  });

  it('returns nothing outside service hours without live data', () => {
    expect(getStopArrivals({ stopId: 'b', snapshot: null, status: 'no-service', network, now: NOON })).toEqual([]);
  });

  it('respects the limit', () => {
    const out = getStopArrivals({ stopId: 'e', snapshot: null, status: 'unavailable', network, now: NINE_PM_MONDAY, limit: 2 });
    expect(out).toHaveLength(2);
  });
});
