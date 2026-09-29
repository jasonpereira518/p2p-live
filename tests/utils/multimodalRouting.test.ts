import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeTripOptions, getWalkDirections } from '../../utils/multimodalRouting';
import { getDistanceMeters } from '../../utils/geo';
import { makeNetwork, makeSnapshot, makeVehicle } from '../fixtures/transit';

/** Straight-line walking at 1.4 m/s in place of Mapbox directions. */
function mockWalking() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const [from, to] = ['from', 'to'].map(k => params.get(k)!.split(',').map(Number));
    const meters = getDistanceMeters({ lon: from[0], lat: from[1] }, { lon: to[0], lat: to[1] });
    return Response.json({ durationSec: meters / 1.4, distanceMeters: meters, geometry: { type: 'LineString', coordinates: [from, to] }, steps: [] });
  }));
}

const network = makeNetwork();
const stop = (id: string) => network.stops.find(s => s.id === id)!;
// Afternoon: outside scheduled hours, so only live buses count.
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 14, 14, 0)); mockWalking(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('computeTripOptions', () => {
  const trip = (snapshot = makeSnapshot(), origin = stop('b')) =>
    computeTripOptions({ origin, destination: { id: 'dest', name: 'Stop C area', lat: stop('c').lat, lon: stop('c').lon }, network, snapshot });

  it('offers the bus even when walking is faster', async () => {
    const slowBus = makeVehicle({ upcomingStops: [{ stopId: 'b', etaSec: 900 }, { stopId: 'c', etaSec: 1110 }] });
    const options = await trip(makeSnapshot({ vehicles: [slowBus], arrivalsByStop: {} }));
    expect(options.walk).not.toBeNull();
    expect(options.bus?.segments.map(s => s.type)).toEqual(['walk', 'bus', 'walk']);
    expect(options.recommended).toBe('walk');
    expect(options.bus!.segments[1]).toMatchObject({ routeId: 'P2P_EXPRESS', fromName: 'Stop B', toName: 'Stop C', waitSec: 900, durationSec: 210 });
  });
  it('recommends the bus when it is clearly faster', async () => {
    const options = await trip();
    expect(options.recommended).toBe('bus');
    expect(options.bus!.arrivalTime.getTime() - options.bus!.startTime.getTime()).toBe(300_000);
  });
  it('explains a missing bus option', async () => {
    expect(await trip(makeSnapshot({ vehicles: [], arrivalsByStop: {} }))).toMatchObject({ bus: null, busUnavailable: 'not-running' });
    expect(await trip(makeSnapshot(), { id: 'far', name: 'Far', lat: 35.95, lon: -79.1 })).toMatchObject({ bus: null, busUnavailable: 'no-stops' });
  });
});

describe('getWalkDirections', () => {
  // Coordinates no other test uses, so the shared cache starts empty for them.
  const a = { lat: 35.9001, lon: -79.0301 }, b = { lat: 35.9002, lon: -79.0302 };
  it('reuses a recent walk between the same points', async () => {
    const fetchMock = vi.mocked(fetch);
    const first = await getWalkDirections(a, b);
    const second = await getWalkDirections({ lat: a.lat + 1e-7, lon: a.lon }, b);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
    await getWalkDirections(a, b);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('asks again after a failed walk instead of caching the failure', async () => {
    const c = { lat: 35.9003, lon: -79.0303 };
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    expect(await getWalkDirections(a, c)).toBeNull();
    await getWalkDirections(a, c);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
