/**
 * Stop popup for Map page: stop name, routes served, next arrivals, Walk to this stop.
 * Dismissible via X, Escape, or click-outside (handled by parent).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { X, Navigation, List } from 'lucide-react';
import type { Stop, Coordinate, Journey } from '../types';
import { getRoutesServedForStop } from '../data/p2pStops';
import { getWalkDirections } from '../utils/multimodalRouting';
import { getDistanceMeters, getWalkTimeMinutes } from '../utils/geo';
import { getUpcomingRouteArrivals, isRouteOperatingNow } from '../utils/serviceSchedule';

export interface ArrivalItem {
  routeName: string;
  etaMin: number;
}

interface StopPopupProps {
  stop: Stop;
  userLocation: Coordinate | null;
  userLocationResolved: boolean;
  onClose: () => void;
  onWalkToStop: (journey: Journey) => void;
  onViewOnList?: () => void;
}

export function StopPopup({
  stop,
  userLocation,
  userLocationResolved,
  onClose,
  onWalkToStop,
  onViewOnList,
}: StopPopupProps) {
  const [arrivals, setArrivals] = useState<ArrivalItem[] | null>(null);
  const [arrivalsLoading, setArrivalsLoading] = useState(true);
  const [arrivalsError, setArrivalsError] = useState(false);
  const [walkLoading, setWalkLoading] = useState(false);
  const [walkError, setWalkError] = useState<string | null>(null);

  const routesServed = getRoutesServedForStop(stop);

  useEffect(() => {
    setArrivalsLoading(true);
    setArrivalsError(false);
    const next = routesServed
      .filter((name) => isRouteOperatingNow(name))
      .flatMap((routeName) =>
        getUpcomingRouteArrivals(routeName, new Date(), 3).map((etaMin) => ({ routeName, etaMin }))
      )
      .sort((a, b) => a.etaMin - b.etaMin)
      .slice(0, 5);
    setArrivals(next);
    setArrivalsLoading(false);
  }, [routesServed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleWalkToThisStop = useCallback(async () => {
    if (!userLocation) {
      setWalkError('Your location is not available. Enable location access and try again.');
      return;
    }
    setWalkLoading(true);
    setWalkError(null);
    try {
      const result = await getWalkDirections(userLocation, { lat: stop.lat, lon: stop.lon });
      if (!result || !result.geometry) {
        setWalkError('Could not get walking route. Try again.');
        return;
      }
      const durationMin = Math.ceil(result.durationSec / 60);
      const arrivalTime = new Date(Date.now() + result.durationSec * 1000);
      const journey: Journey = {
        id: `walk-to-stop-${Date.now()}`,
        destination: { id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon },
        totalDurationMin: durationMin,
        segments: [
          {
            type: 'walk',
            fromName: 'Current Location',
            toName: stop.name,
            fromCoords: userLocation,
            toCoords: { lat: stop.lat, lon: stop.lon },
            distanceMeters: result.distanceMeters,
            durationMin,
            instruction: `Walk to ${stop.name}`,
            geometry: result.geometry,
            steps: result.steps ?? [],
          },
        ],
        startTime: new Date(),
        arrivalTime,
      };
      onWalkToStop(journey);
      onClose();
    } catch {
      setWalkError('Could not load route. Try again.');
    } finally {
      setWalkLoading(false);
    }
  }, [stop, userLocation, onWalkToStop, onClose]);

  const walkTimeMin = userLocation ? getWalkTimeMinutes(getDistanceMeters(userLocation, stop)) : null;
  const distanceFeet = userLocation ? Math.round(getDistanceMeters(userLocation, stop) * 3.28084) : null;

  return (
    <div
      className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-md w-full mx-4 animate-in fade-in slide-in-from-top-4 duration-200"
      role="dialog"
      aria-labelledby="stop-popup-title"
      aria-modal="true"
    >
      <div className="p-4">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 id="stop-popup-title" className="font-bold text-gray-900 text-lg truncate">
              {stop.name}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {routesServed.length > 0 ? routesServed.join(' • ') : 'P2P routes'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 shrink-0"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <section className="mt-4" aria-labelledby="arrivals-heading">
          <h3 id="arrivals-heading" className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            Next arrivals
          </h3>
          {arrivalsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : arrivalsError ? (
            <p className="text-sm text-amber-700">Could not load arrivals.</p>
          ) : arrivals && arrivals.length > 0 ? (
            <ul className="space-y-1">
              {arrivals.slice(0, 5).map((a, i) => (
                <li key={i} className="text-sm text-gray-700 flex justify-between">
                  <span>{a.routeName}</span>
                  <span>{a.etaMin} min</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No buses currently running</p>
          )}
        </section>

        {userLocation && (
          <p className="text-xs text-gray-500 mt-2">
            {walkTimeMin != null && distanceFeet != null && (
              <>~{walkTimeMin} min walk • {distanceFeet.toLocaleString()} ft</>
            )}
          </p>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleWalkToThisStop}
            disabled={!userLocationResolved || walkLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-p2p-blue text-white font-semibold hover:bg-p2p-blue/90 disabled:opacity-60 disabled:pointer-events-none"
          >
            <Navigation size={18} />
            {walkLoading ? 'Loading…' : 'Walk to this stop'}
          </button>
          {onViewOnList && (
            <button
              type="button"
              onClick={onViewOnList}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
            >
              <List size={18} />
              View on list
            </button>
          )}
          {!onViewOnList && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
            >
              Close
            </button>
          )}
        </div>
        {walkError && (
          <p className="text-sm text-red-600 mt-2" role="alert">
            {walkError}
          </p>
        )}
      </div>
    </div>
  );
}
