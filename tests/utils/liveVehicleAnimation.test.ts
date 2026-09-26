import { describe, it, expect } from 'vitest';
import { createRouteInterpolator } from '../../utils/routeInterpolation';
import { easeToward, extrapolateVehicle } from '../../utils/liveVehicleAnimation';
import { makeVehicle } from '../fixtures/transit';

const interp = createRouteInterpolator([[-79.05, 35.9], [-79.04, 35.9]])!;

describe('extrapolateVehicle', () => {
  it('moves the bus along its pattern at its reported speed', () => {
    const pos = extrapolateVehicle(makeVehicle({ distAlong: 0, speedMps: 10 }), interp, 3);
    expect(pos.lon).toBeCloseTo(interp.pointAt(30)[0], 9);
    expect(pos.lat).toBeCloseTo(interp.pointAt(30)[1], 9);
    expect(pos.bearing).toBeCloseTo(interp.bearingAt(30), 6);
  });

  it('caps extrapolation at maxSec', () => {
    const pos = extrapolateVehicle(makeVehicle({ distAlong: 0, speedMps: 10 }), interp, 60, 6);
    expect(pos.lon).toBeCloseTo(interp.pointAt(60)[0], 9);
  });

  it('treats a missing speed as stopped', () => {
    const pos = extrapolateVehicle(makeVehicle({ distAlong: 100, speedMps: null }), interp, 5);
    expect(pos.lon).toBeCloseTo(interp.pointAt(100)[0], 9);
  });

  it('uses the raw reported position for stale vehicles or without a pattern line', () => {
    const v = makeVehicle({ lat: 35.95, lon: -79.01, heading: 45 });
    expect(extrapolateVehicle({ ...v, stale: true }, interp, 3)).toMatchObject({ lat: 35.95, lon: -79.01, bearing: 45, stale: true });
    expect(extrapolateVehicle(v, null, 3)).toMatchObject({ lat: 35.95, lon: -79.01, bearing: 45 });
    expect(extrapolateVehicle({ ...v, distAlong: null }, interp, 3)).toMatchObject({ lat: 35.95, lon: -79.01 });
  });
});

describe('easeToward', () => {
  const prev = { id: 'v1', routeId: 'P2P_EXPRESS' as const, lon: 0, lat: 0, bearing: 0, stale: false };
  const target = { ...prev, lon: 10, lat: 20, bearing: 90 };

  it('covers the fraction dt / easeSec of the gap', () => {
    expect(easeToward(prev, target, 0.5, 1)).toMatchObject({ lon: 5, lat: 10, bearing: 90 });
  });
  it('snaps to the target once dt >= easeSec', () => {
    expect(easeToward(prev, target, 2, 1)).toMatchObject({ lon: 10, lat: 20 });
  });
});
