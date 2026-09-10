'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Modern Custom SVG Restaurant Marker Icon
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

interface BranchMapProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  onReverseGeocode?: (data: {
    displayName: string;
    street: string;
    ward: string;
    district: string;
    province: string;
  }) => void;
}

const DEFAULT_CENTER: L.LatLngTuple = [10.762622, 106.660172]; // Ho Chi Minh City

// Auto-invalidation component to guarantee tiles render inside modals and responsive layout
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    // Trigger multiple resizes to account for modal open transitions
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

  return null;
}

// Controller to smoothly pan & zoom when coordinates change from search/edit
function MapController({ position }: { position: L.LatLng | null }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 15), {
        duration: 0.8,
      });
      map.invalidateSize();
    }
  }, [position, map]);

  return null;
}

// Location Marker with Drag & Click listeners
function LocationMarker({
  position,
  setPosition,
  onReverseGeocode,
}: {
  position: L.LatLng | null;
  setPosition: (p: L.LatLng) => void;
  onReverseGeocode?: BranchMapProps['onReverseGeocode'];
}) {
  const reverseGeocode = async (lat: number, lon: number) => {
    if (!onReverseGeocode) return;
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const item = await res.json();
        if (item && !item.error) {
          const addr = item.address || {};
          const province = addr.city || addr.state || addr.province || '';
          const district = addr.city_district || addr.district || addr.suburb || addr.county || '';
          const ward = addr.quarter || addr.neighbourhood || addr.ward || '';
          const houseNumber = addr.house_number || '';
          const road = addr.road || addr.street || '';
          const street = [houseNumber, road].filter(Boolean).join(' ') || item.name || (item.display_name ? item.display_name.split(',')[0] : '');

          onReverseGeocode({
            displayName: item.display_name || street,
            street,
            ward,
            district,
            province,
          });
        }
      }
    } catch (e) {
      console.error('Reverse geocode error:', e);
    }
  };

  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom(), { duration: 0.4 });
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    },
  });

  if (!position) return null;

  return (
    <Marker
      position={position}
      draggable={true}
      icon={customIcon}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const newPos = marker.getLatLng();
          setPosition(newPos);
          reverseGeocode(newPos.lat, newPos.lng);
        },
      }}
    />
  );
}

export default function BranchMap({
  latitude,
  longitude,
  onChange,
  onReverseGeocode,
}: BranchMapProps) {
  const [position, setPosition] = useState<L.LatLng | null>(
    latitude && longitude ? new L.LatLng(latitude, longitude) : null
  );

  // Synchronize when incoming latitude/longitude change (e.g. from address search or selecting a branch)
  useEffect(() => {
    if (latitude !== null && longitude !== null && !isNaN(latitude) && !isNaN(longitude)) {
      setPosition(new L.LatLng(latitude, longitude));
    }
  }, [latitude, longitude]);

  const handleSetPosition = (p: L.LatLng) => {
    setPosition(p);
    onChange(p.lat, p.lng);
  };

  const initialCenter = position ? [position.lat, position.lng] as L.LatLngTuple : DEFAULT_CENTER;

  return (
    <div className="relative w-full h-[360px] sm:h-[400px] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner">
      <MapContainer
        center={initialCenter}
        zoom={position ? 15 : 13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        {/* CARTO Voyager: Fast, crisp, beautiful vector-styled tiles with no rate limiting */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        <MapResizer />
        <MapController position={position} />
        <LocationMarker
          position={position}
          setPosition={handleSetPosition}
          onReverseGeocode={onReverseGeocode}
        />
      </MapContainer>

      {/* Helper instruction overlay */}
      <div className="absolute bottom-2.5 left-2.5 z-10 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs text-[11px] font-medium text-slate-700 pointer-events-none">
        💡 Click hoặc kéo ghim để chọn tọa độ chính xác
      </div>
    </div>
  );
}
