import { describe, it, expect } from 'vitest';
import { withDisplayNames } from '../../utils/transitApi';
import { displayStopName } from '../../data/stopDisplayNames';
import { routeIdFromName } from '../../data/routes';
import { makeNetwork } from '../fixtures/transit';

describe('stop display names', () => {
  it('uses the friendly name when one is defined', () => {
    expect(displayStopName('10044083', 'Williamson Lot')).toBe('Smith Center Stadium (Williamson Lot)');
  });
  it('falls back to the trimmed GMV name', () => {
    expect(displayStopName('12494424', 'Frat Court ')).toBe('Frat Court');
  });
  it('applies names to every network stop', () => {
    const network = makeNetwork();
    network.stops.push({ id: '10044065', name: 'Ehringhaus', lat: 0, lon: 0 });
    const named = withDisplayNames(network);
    expect(named.stops.find((s) => s.id === '10044065')?.name).toBe('Ehringhaus Hall');
    expect(named.stops.find((s) => s.id === 'a')?.name).toBe('Stop A');
  });
});

describe('routeIdFromName', () => {
  it('matches display names case-insensitively', () => {
    expect(routeIdFromName('p2p express')).toBe('P2P_EXPRESS');
    expect(routeIdFromName('Baity Hill')).toBe('BAITY_HILL');
    expect(routeIdFromName('Unknown')).toBeNull();
  });
});
