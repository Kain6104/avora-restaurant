'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Modern Custom SVG Restaurant/Customer Marker Icon
const customIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `
    <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 36px; height: 36px; background-color: rgba(239, 68, 68, 0.25); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: 2.5px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <div style="transform: rotate(45deg); color: white; font-size: 14px; font-weight: bold;">📍</div>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

interface MapPickerProps {
  position?: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}

// Controller to auto-invalidate size and animate center changes in Modals
function MapResizerAndController({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    // Invalidate size multiple times to ensure full render through modal animations
    const timeouts = [50, 150, 300, 500, 800].map((delay) =>
      setTimeout(() => {
        map.invalidateSize();
      }, delay)
    );

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      timeouts.forEach(clearTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (center && center.lat && center.lng && !isNaN(center.lat) && !isNaN(center.lng)) {
      try {
        map.flyTo([center.lat, center.lng], Math.max(map.getZoom() || 15, 15), {
          animate: true,
          duration: 0.8,
        });
        map.invalidateSize();
      } catch (e) {}
    }
  }, [center.lat, center.lng, map]);

  return null;
}

const LocationMarker = ({ position, onChange }: MapPickerProps) => {
  const map = useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, map.getZoom(), { duration: 0.4 });
    },
  });

  if (!position || isNaN(position.lat) || isNaN(position.lng)) return null;

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={customIcon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          onChange(pos.lat, pos.lng);
        },
      }}
    />
  );
};

export default function MapPicker({ position, onChange }: MapPickerProps) {
  // Default to HCMC if no position provided
  const defaultCenter = { lat: 10.762622, lng: 106.660172 };
  const center = position && !isNaN(position.lat) && !isNaN(position.lng) ? position : defaultCenter;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl min-h-[250px]" />;
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative min-h-[250px] bg-slate-100">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', minHeight: '250px' }}
      >
        {/* CARTO Voyager: Fast, crisp, beautiful vector-styled tiles with no rate limiting */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <MapResizerAndController center={center} />
        <LocationMarker position={position} onChange={onChange} />
      </MapContainer>

      {/* Instruction badge */}
      <div className="absolute bottom-2.5 left-2.5 z-[1000] bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs text-[11px] font-medium text-slate-700 pointer-events-none">
        💡 Click hoặc kéo ghim để chọn vị trí giao hàng
      </div>
    </div>
  );
}
