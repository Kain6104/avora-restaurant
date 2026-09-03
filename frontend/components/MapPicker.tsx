'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet icon path issue in Next.js
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapPickerProps {
  position?: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}

// Controller to auto-invalidate size and animate center changes
function MapController({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();

  useEffect(() => {
    const handleResize = () => {
      try {
        map.invalidateSize();
      } catch (e) {}
    };

    // Invalidate size immediately, after modal transition (150ms), and once fully settled (400ms)
    handleResize();
    const t1 = setTimeout(handleResize, 150);
    const t2 = setTimeout(handleResize, 400);
    const t3 = setTimeout(handleResize, 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [map]);

  useEffect(() => {
    if (center && center.lat && center.lng) {
      try {
        map.flyTo([center.lat, center.lng], Math.max(map.getZoom() || 15, 15), {
          animate: true,
          duration: 0.8
        });
        map.invalidateSize();
      } catch (e) {}
    }
  }, [center.lat, center.lng, map]);

  return null;
}

const LocationMarker = ({ position, onChange }: MapPickerProps) => {
  const [currentPosition, setCurrentPosition] = useState(position);

  // Update internal state if external position changes
  useEffect(() => {
    if (position) {
      setCurrentPosition(position);
    }
  }, [position?.lat, position?.lng]);

  useMapEvents({
    click(e) {
      setCurrentPosition(e.latlng);
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return currentPosition ? (
    <Marker
      position={currentPosition}
      icon={icon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          setCurrentPosition(pos);
          onChange(pos.lat, pos.lng);
        },
      }}
    />
  ) : null;
};

export default function MapPicker({ position, onChange }: MapPickerProps) {
  // Default to HCMC if no position provided
  const defaultCenter = { lat: 10.762622, lng: 106.660172 };
  const center = position || defaultCenter;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl min-h-[250px]" />;

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-inner border border-slate-200 relative min-h-[250px]">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', minHeight: '250px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c']}
          maxZoom={19}
        />
        <MapController center={center} />
        <LocationMarker position={position} onChange={onChange} />
      </MapContainer>
    </div>
  );
}
