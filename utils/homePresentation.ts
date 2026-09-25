import type { ClientLiveStatus, Coordinate, Stop, StopArrival } from '../types';
import { ROUTE_IDS } from '../data/routes';
import { getServiceResumeLabel, isRouteOperatingNow } from './serviceSchedule';
import { eligibleCampusLocation } from './mapPresentation';
import { findNearestStop } from './geo';

export type HomeTone = 'active' | 'neutral' | 'warning' | 'inactive';

export function homeServiceSummary(status: ClientLiveStatus, now = new Date()): { label: string; tone: HomeTone; value?: string } {
  switch (status) {
    case 'loading': return { label: 'Checking service…', tone: 'neutral' };
    case 'unavailable': return { label: 'Live tracking unavailable', tone: 'warning' };
    case 'degraded': return { label: 'Live tracking delayed', tone: 'warning' };
    case 'live': return { label: 'Service running', tone: 'active' };
    case 'no-service': return ROUTE_IDS.some(id => isRouteOperatingNow(id, now))
      ? { label: 'No buses reporting', tone: 'neutral' }
      : { label: `Service starts at ${getServiceResumeLabel()}`, tone: 'inactive', value: getServiceResumeLabel() };
  }
}

export function nearestHomeStop(location: Coordinate | null, resolved: boolean, stops: Stop[]) {
  const eligible = eligibleCampusLocation(location, resolved);
  return eligible ? findNearestStop(eligible, stops) : null;
}

export interface HomeDeparture { arrival: StopArrival; busInMin: number; walkMin: number; leaveInMin: number }

/** The next bus the rider can walk to in time, and when to leave for it. Falls back to
 * the earliest arrival (leave now) when none is reachable. The walk is rounded up, so
 * a shown leave time plus the shown walk equals the shown bus time. */
export function homeDeparture(arrivals: StopArrival[], walkSec: number): HomeDeparture | null {
  const valid = arrivals.filter(a => Number.isFinite(a.etaSec) && a.etaSec >= 0).sort((a, b) => a.etaSec - b.etaSec);
  const arrival = valid.find(a => a.etaSec >= walkSec) ?? valid[0];
  if (!arrival) return null;
  const busInMin = Math.floor(arrival.etaSec / 60);
  const walkMin = Math.ceil(walkSec / 60);
  return { arrival, busInMin, walkMin, leaveInMin: Math.max(0, busInMin - walkMin) };
}

export function homeEta(seconds: number | null, stale = false) {
  if (stale || seconds == null || !Number.isFinite(seconds) || seconds < 0) return { value: '—', unit: '' };
  return seconds < 60 ? { value: 'Now', unit: '' } : { value: String(Math.floor(seconds / 60)), unit: 'min' };
}
