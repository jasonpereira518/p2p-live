/**
 * Mini map showing driver's current location. Uses Leaflet (same as student map).
 * TODO: Replace with live bus position from API when available.
 */

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const DEFAULT_CENTER = { lat: 35.9105, lon: -79.0478 }; // UNC Student Union

const driverIcon = L.divIcon({
  className: 'driver-location-icon',
  html: `<div style="background-color: #418FC5; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function Recenter({ center, zoom }: { center: { lat: number; lon: number }; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon], zoom ?? map.getZoom());
  }, [center.lat, center.lon, zoom, map]);
  return null;
}

interface DriverLocationMapProps {
  className?: string;
  height?: number;
}

export function DriverLocationMap({ className = '', height = 240 }: DriverLocationMapProps) {
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPosition(DEFAULT_CENTER);
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
        setLoading(false);
      },
      () => {
        setPosition(DEFAULT_CENTER);
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const center = position ?? DEFAULT_CENTER;

  return (
    <div className={`rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-gray-100 ${className}`} style={{ height: `${height}px` }}>
      {loading ? (
        <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">Getting location…</div>
      ) : (
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={15}
          className="w-full h-full rounded-2xl"
          style={{ height: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[center.lat, center.lon]} icon={driverIcon} />
          <Recenter center={center} zoom={15} />
        </MapContainer>
      )}
    </div>
  );
}
