import { describe, it, expect } from 'vitest';
import { fallbackRideSec, rideDistanceMeters } from '../../utils/tripPlanning';

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
