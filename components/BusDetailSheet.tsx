import React, { useEffect, useMemo } from 'react';
import type { Coordinate, LiveVehicle, Stop } from '../types';
import { X, Navigation } from 'lucide-react';
import { getDistanceMeters, getWalkTimeMinutes } from '../utils/geo';
import { formatEta } from '../utils/format';
import { getLoadInfo } from '../utils/vehicleDisplay';
import { getPattern } from '../utils/transitSelectors';
import { useTransit } from '../context/TransitProvider';

function getFullnessMeta(percent: number): { label: string; textClass: string; barClass: string } {
  if (percent <= 30) return { label: 'Low', textClass: 'text-emerald-600', barClass: 'bg-emerald-500' };
  if (percent <= 70) return { label: 'Moderate', textClass: 'text-yellow-600', barClass: 'bg-yellow-400' };
  if (percent <= 90) return { label: 'High', textClass: 'text-orange-600', barClass: 'bg-orange-500' };
  return { label: 'Near Capacity', textClass: 'text-red-600', barClass: 'bg-red-500' };
}

interface BusDetailSheetProps {
  vehicle: LiveVehicle;
  stops: Stop[];
  userLocation: Coordinate;
  onClose: () => void;
}

export const BusDetailSheet: React.FC<BusDetailSheetProps> = ({ vehicle, stops, userLocation, onClose }) => {
  const { network } = useTransit();
  const stopsById = useMemo(() => new Map(stops.map((s) => [s.id, s])), [stops]);
  const orderedStopIds = useMemo(
    () => getPattern(network, vehicle.patternId)?.stops.map((s) => s.stopId) ?? [],
    [network, vehicle.patternId]
  );

  const nextStop = vehicle.nextStopId ? stopsById.get(vehicle.nextStopId) ?? null : null;
  const walkToNextStop = useMemo(
    () => (nextStop ? getWalkTimeMinutes(getDistanceMeters(userLocation, nextStop)) : null),
    [nextStop, userLocation]
  );

  const loadInfo = getLoadInfo(vehicle);
  const fullnessMeta = loadInfo ? getFullnessMeta(loadInfo.percent) : null;

  const upcoming = useMemo(() => {
    const nameOf = (id: string) => stopsById.get(id)?.name ?? 'Unknown stop';
    return vehicle.upcomingStops.map((stop, idx) => {
      let previousStopId: string | null = null;
      if (idx > 0) {
        previousStopId = vehicle.upcomingStops[idx - 1].stopId;
      } else {
        const i = orderedStopIds.indexOf(stop.stopId);
        if (i !== -1 && orderedStopIds.length > 1) {
          previousStopId = orderedStopIds[(i - 1 + orderedStopIds.length) % orderedStopIds.length];
        }
      }
      const minutesFromPrevious =
        idx > 0 ? Math.max(1, Math.round((stop.etaSec - vehicle.upcomingStops[idx - 1].etaSec) / 60)) : null;
      return {
        ...stop,
        name: nameOf(stop.stopId),
        previousStopName: previousStopId ? nameOf(previousStopId) : null,
        minutesFromPrevious,
      };
    });
  }, [vehicle.upcomingStops, orderedStopIds, stopsById]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center pointer-events-none">
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl z-50 pointer-events-auto max-h-[85vh] flex flex-col animate-slide-up sm:m-4"
        style={{ minHeight: 0 }}
      >
        <div className="shrink-0">
          <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
          </div>
          <div className="p-5 pb-0 flex justify-between items-start">
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-2 text-white ${
                  vehicle.routeId === 'P2P_EXPRESS' ? 'bg-p2p-blue' : 'bg-p2p-red'
                }`}
              >
                {vehicle.routeName.toUpperCase()}
              </span>
              <h2 className="text-2xl font-bold text-gray-900">{vehicle.routeName}</h2>
              <p className="text-gray-500 text-sm">{vehicle.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 pt-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-2 h-2 rounded-full ${vehicle.stale ? 'bg-gray-400' : 'bg-green-500 animate-pulse'}`} />
              <span className="text-sm font-semibold text-gray-700">
                {vehicle.stale ? (
                  'Location not updating'
                ) : nextStop ? (
                  <>
                    En route to <span className="text-gray-900">{nextStop.name}</span>
                  </>
                ) : (
                  'Next stop unknown'
                )}
              </span>
            </div>

            <div className="flex justify-between items-center pl-5 mb-3">
              <div>
                <div className="text-3xl font-bold text-gray-900">{formatEta(vehicle.nextStopEtaSec)}</div>
                <div className="text-xs text-gray-400">Estimated Arrival</div>
              </div>
              {walkToNextStop !== null && (
                <div className="text-right">
                  <div className="flex items-center justify-end text-p2p-blue gap-1">
                    <Navigation size={14} />
                    <span className="font-bold">{walkToNextStop} min</span>
                  </div>
                  <div className="text-xs text-gray-400">Walk to stop</div>
                </div>
              )}
            </div>

            {loadInfo && fullnessMeta && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Fullness</span>
                  <span className={`font-semibold ${fullnessMeta.textClass}`}>
                    {loadInfo.riders != null && loadInfo.capacity != null
                      ? `${loadInfo.riders} / ${loadInfo.capacity} riders`
                      : `${loadInfo.percent}%`}{' '}
                    ({fullnessMeta.label})
                  </span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200/70">
                  <div
                    className={`h-full rounded-full ${fullnessMeta.barClass}`}
                    style={{ width: `${Math.min(100, loadInfo.percent)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Upcoming Stops</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming stop predictions for this bus.</p>
            ) : (
              <div className="relative pl-2 space-y-6 before:content-[''] before:absolute before:left-[19px] before:top-2 before:bottom-4 before:w-0.5 before:bg-gray-200">
                {upcoming.map((stop, idx) => (
                  <div key={`${stop.stopId}-${idx}`} className="relative flex items-center justify-between pl-8 group">
                    <div
                      className={`absolute left-3 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${
                        idx === 0 ? 'bg-p2p-blue' : 'bg-gray-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1 pr-2">
                      <span className={`block text-sm font-medium truncate ${idx === 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                        {stop.name}
                      </span>
                      {stop.previousStopName && (
                        <span className="block text-xs text-gray-400 truncate">
                          {stop.minutesFromPrevious == null
                            ? `Previous stop: ${stop.previousStopName}`
                            : `${stop.minutesFromPrevious} min after ${stop.previousStopName}`}
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-bold whitespace-nowrap ${idx === 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formatEta(stop.etaSec)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
