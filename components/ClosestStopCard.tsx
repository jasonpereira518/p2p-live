import React, { useMemo } from 'react';
import { Stop, Vehicle, Coordinate } from '../types';
import { getDistanceMeters, getWalkTimeMinutes } from '../utils/geo';
import { ROUTE_CONFIGS } from '../data/routeConfig';
import { Navigation, Clock } from 'lucide-react';
import { getServiceResumeLabel, getUpcomingRouteArrivals, isRouteOperatingNow } from '../utils/serviceSchedule';

interface ClosestStopCardProps {
  stop: Stop;
  userLocation: Coordinate;
  vehicles: Vehicle[];
}

export const ClosestStopCard: React.FC<ClosestStopCardProps> = ({ stop, userLocation, vehicles }) => {
  const walkTime = useMemo(() => {
    const dist = getDistanceMeters(userLocation, stop);
    return getWalkTimeMinutes(dist);
  }, [userLocation, stop]);

  const bestBus = useMemo(() => {
    let bestVehicle: Vehicle | null = null;
    let minEta = Infinity;

    vehicles.forEach(v => {
      const upcoming = v.upcomingStops.find(s => s.stopId === stop.id);
      if (upcoming && upcoming.etaMin < minEta) {
        minEta = upcoming.etaMin;
        bestVehicle = v;
      }
    });

    return { vehicle: bestVehicle, eta: minEta };
  }, [stop, vehicles]);

  const mockArrivals = useMemo(() => {
    const servingRoutes = ROUTE_CONFIGS.filter((route) =>
      route.stops.some((rs) => rs.id === stop.id)
    );
    const activeServingRoutes = servingRoutes.filter((route) => isRouteOperatingNow(route.routeId));
    if (activeServingRoutes.length === 0) {
      return [] as { routeName: string; minutes: number; color: string }[];
    }

    const arrivals = activeServingRoutes
      .flatMap((route) =>
        getUpcomingRouteArrivals(route.routeId, new Date(), 2).map((minutes) => ({
          routeName: route.routeName,
          minutes,
          color: route.routeColor,
        }))
      )
      .sort((a, b) => a.minutes - b.minutes)
      .slice(0, 3)
      .map(({ routeName, minutes, color }) => ({ routeName, minutes, color }));

    return arrivals;
  }, [stop.id]);

  return (
    <div className="mt-3 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Closest Stop</h2>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{stop.name}</h3>
        </div>
        <div className="flex items-center text-p2p-blue bg-p2p-light-blue/20 px-2 py-1 rounded-lg">
          <Navigation size={14} className="mr-1" />
          <span className="text-sm font-bold">{walkTime} min walk</span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3">
        {bestBus.vehicle ? (
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">
                {bestBus.vehicle.routeName}
              </span>
              <span className="text-xs text-gray-500">Approaching</span>
            </div>
            <div className="flex items-center text-p2p-red">
              <Clock size={16} className="mr-1.5" />
              <span className="font-bold text-lg">{bestBus.eta} min</span>
            </div>
          </div>
        ) : mockArrivals.length > 0 ? (
          <div className="space-y-2">
            {mockArrivals.map((arr, idx) => {
              const label =
                arr.minutes < 2 ? 'Arriving now' : `Arriving in ${arr.minutes} min`;
              return (
                <div
                  key={`${arr.routeName}-${idx}`}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: arr.color }}
                    >
                      {arr.routeName}
                    </span>
                    <span className="text-xs text-gray-500">Scheduled</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-sm text-gray-500 italic">Service resumes at {getServiceResumeLabel()}</span>
        )}
      </div>
    </div>
  );
};
