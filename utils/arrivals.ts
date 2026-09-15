/**
 * Arrivals for a stop: live GMV predictions when available, otherwise the timetable.
 * Single source for the closest-stop card, stop pop-up and Plan Trip.
 */

import type { ClientLiveStatus, LiveSnapshot, StopArrival, TransitNetwork } from '../types';
import { ROUTE_NAMES } from '../data/routes';
import { getRoutesServingStop } from './transitSelectors';
import { getUpcomingRouteArrivals, isRouteOperatingNow } from './serviceSchedule';

export interface StopArrivalsInput {
  stopId: string;
  snapshot: LiveSnapshot | null;
  status: ClientLiveStatus;
  network: TransitNetwork | null;
  now?: Date;
  limit?: number;
}

export function getStopArrivals({
  stopId,
  snapshot,
  status,
  network,
  now = new Date(),
  limit = 5,
}: StopArrivalsInput): StopArrival[] {
  const liveUsable = status === 'live' || status === 'degraded';
  const live = liveUsable && snapshot ? snapshot.arrivalsByStop[stopId] ?? [] : [];
  if (live.length > 0) {
    return live.slice(0, limit).map((a) => ({
      routeId: a.routeId,
      routeName: ROUTE_NAMES[a.routeId],
      etaSec: a.etaSec,
      source: a.scheduled ? 'scheduled' : 'live',
      vehicleId: a.vehicleId,
    }));
  }

  return getRoutesServingStop(network, snapshot, stopId)
    .filter((routeId) => isRouteOperatingNow(routeId, now))
    .flatMap((routeId) =>
      getUpcomingRouteArrivals(routeId, now, 3).map(
        (minutes): StopArrival => ({
          routeId,
          routeName: ROUTE_NAMES[routeId],
          etaSec: minutes * 60,
          source: 'scheduled',
          vehicleId: null,
        })
      )
    )
    .sort((a, b) => a.etaSec - b.etaSec)
    .slice(0, limit);
}
