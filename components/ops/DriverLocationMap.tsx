/**
 * Mini map showing driver's current location. Uses Mapbox GL JS.
 */

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMapType } from 'mapbox-gl';
import { ROUTE_CONFIGS } from '../../data/routeConfig';

const DEFAULT_CENTER: [number, number] = [-79.0478, 35.9105];
const DRIVER_SOURCE = 'driver-location-source';
const DRIVER_LAYER = 'driver-location-layer';
const DRIVER_ROUTE_SOURCE = 'driver-route-source';
const DRIVER_ROUTE_LAYER = 'driver-route-layer';

const token = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MAPBOX_TOKEN;

interface DriverLocationMapProps {
  className?: string;
  height?: number;
  routeName?: string;
}

export function DriverLocationMap({ className = '', height = 240, routeName }: DriverLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMapType | null>(null);
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const matchedRoute = routeName
    ? ROUTE_CONFIGS.find((route) => route.routeName.toLowerCase() === routeName.toLowerCase())
    : null;
  const routeCoords = matchedRoute?.stops
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((stop) => stop.coord) ?? [];
  const routeGeometryKey = routeCoords.map(([lng, lat]) => `${lng},${lat}`).join('|');

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPosition({ lat: DEFAULT_CENTER[1], lon: DEFAULT_CENTER[0] });
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
        setLoading(false);
      },
      () => {
        setPosition({ lat: DEFAULT_CENTER[1], lon: DEFAULT_CENTER[0] });
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (!containerRef.current || !token || position === null) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: token,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [position.lon, position.lat],
      zoom: 15,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.on('load', () => {
      if (routeCoords.length > 1) {
        const routeLineCoords = [...routeCoords, routeCoords[0]];
        map.addSource(DRIVER_ROUTE_SOURCE, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: routeLineCoords },
                properties: {},
              },
            ],
          },
        });
        map.addLayer({
          id: DRIVER_ROUTE_LAYER,
          type: 'line',
          source: DRIVER_ROUTE_SOURCE,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': matchedRoute?.routeColor ?? '#418FC5',
            'line-width': 4,
            'line-opacity': 0.85,
          },
        });
      }

      map.addSource(DRIVER_SOURCE, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [position.lon, position.lat] },
              properties: {},
            },
          ],
        },
      });
      map.addLayer({
        id: DRIVER_LAYER,
        type: 'circle',
        source: DRIVER_SOURCE,
        paint: {
          'circle-radius': 14,
          'circle-color': '#418FC5',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#fff',
        },
      });

      if (routeCoords.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        routeCoords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
        bounds.extend([position.lon, position.lat]);
        map.fitBounds(bounds, { padding: 36, duration: 800, maxZoom: 15.5 });
      }
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, position?.lat, position?.lon, routeGeometryKey, matchedRoute?.routeColor]);

  if (!token) {
    return (
      <div
        className={`rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-gray-100 flex items-center justify-center text-gray-500 text-sm ${className}`}
        style={{ height: `${height}px` }}
      >
        Set VITE_MAPBOX_TOKEN for map
      </div>
    );
  }
  if (loading) {
    return (
      <div
        className={`rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-gray-100 flex items-center justify-center text-gray-500 text-sm ${className}`}
        style={{ height: `${height}px` }}
      >
        Getting location…
      </div>
    );
  }
  return (
    <div
      className={`rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-gray-100 ${className}`}
      style={{ height: `${height}px` }}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
