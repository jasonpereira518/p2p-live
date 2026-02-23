/**
 * Route config for multimodal routing: ordered stops + metadata per route.
 * Geometry is fetched separately from /api/mapbox/route.
 */

import { P2P_EXPRESS_STOPS, BAITY_HILL_STOPS, type P2PStop, type RouteId } from './p2pStops';

export const ROUTE_COLORS: Record<RouteId, string> = {
  P2P_EXPRESS: '#418FC5',
  BAITY_HILL: '#C33934',
};

export interface RouteStopConfig {
  id: string;
  name: string;
  coord: [number, number]; // [lng, lat]
  index: number;
}

export interface RouteConfig {
  routeId: RouteId;
  routeName: string;
  routeColor: string;
  stops: RouteStopConfig[];
}

function toRouteConfig(stops: P2PStop[], routeId: RouteId, routeName: string): RouteConfig {
  return {
    routeId,
    routeName,
    routeColor: ROUTE_COLORS[routeId],
    stops: stops.map((s) => ({
      id: s.id,
      name: s.name,
      coord: [s.lon, s.lat] as [number, number],
      index: s.order,
    })),
  };
}

export const P2P_EXPRESS_CONFIG: RouteConfig = toRouteConfig(
  P2P_EXPRESS_STOPS,
  'P2P_EXPRESS',
  'P2P Express'
);

export const BAITY_HILL_CONFIG: RouteConfig = toRouteConfig(
  BAITY_HILL_STOPS,
  'BAITY_HILL',
  'Baity Hill'
);

export const ROUTE_CONFIGS: RouteConfig[] = [P2P_EXPRESS_CONFIG, BAITY_HILL_CONFIG];
