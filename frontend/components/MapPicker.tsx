'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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

const LocationMarker = ({ position, onChange }: MapPickerProps) => {
  const [currentPosition, setCurrentPosition] = useState(position);

  // Update internal state if external position changes
  useEffect(() => {
    if (position) {
      setCurrentPosition(position);
    }
  }, [position]);

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

  if (!isMounted) return <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl" />;

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-inner border border-slate-200">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} onChange={onChange} />
      </MapContainer>
    </div>
  );
}
