"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Plus, Minus } from 'lucide-react';
import {
  MAP_TILE_URL,
  MAP_TILE_SUBDOMAINS,
  MAP_TILE_ATTRIBUTION,
  MAP_DEFAULT_CENTER,
  setupLeafletDefaultIcons,
} from '@/lib/map-config';

setupLeafletDefaultIcons(L);

export interface MapBranchTarget {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string;
}

interface ChatbotLeafletMapProps {
  branches: MapBranchTarget[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  userLocation: [number, number] | null;
  height?: string;
  className?: string;
}

function createBranchPin(selected: boolean) {
  const pinBg = selected ? '#DC2626' : '#FFFFFF';
  const borderCol = selected ? '#991B1B' : '#E2E8F0';
  const shadow = selected
    ? '0 6px 18px rgba(220,38,38,0.45)'
    : '0 3px 10px rgba(0,0,0,0.18)';
  const logoFilter = selected ? 'brightness(0) invert(1)' : 'none';

  return L.divIcon({
    className: '',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -46],
    html: `
      <div style="position:relative; width:36px; height:44px; display:flex; flex-direction:column; align-items:center;">
        <div style="
          width:36px; height:36px;
          background:${pinBg};
          border:2.5px solid ${borderCol};
          border-radius:50% 50% 50% 4px;
          transform:rotate(-45deg);
          box-shadow:${shadow};
          display:flex; align-items:center; justify-content:center;
          overflow:hidden;
        ">
          <div style="transform:rotate(45deg); width:24px; height:24px; display:flex; align-items:center; justify-content:center;">
            <img src="/avora_logo.png" alt="AVORA" style="width:20px; height:20px; object-fit:contain; filter:${logoFilter};" />
          </div>
        </div>
      </div>
    `,
  });
}

function createUserLocationPin() {
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `
      <div style="position:relative; width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:22px; height:22px; border-radius:50%; background:rgba(37,99,235,0.25); animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="width:14px; height:14px; border-radius:50%; background:#2563EB; border:2.5px solid #FFFFFF; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
      </div>
    `,
  });
}

function MapController({
  targetCoords,
  userLocation,
  selectedIndex,
}: {
  targetCoords: [number, number] | null;
  userLocation: [number, number] | null;
  selectedIndex: number;
}) {
  const map = useMap();
  const hasMountedRef = useRef(false);

  // Invalidate size immediately, with progressive delays, and on resize
  useEffect(() => {
    const invalidate = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch (err) {
        // ignore
      }
    };

    invalidate();
    const timeouts = [50, 150, 300, 600, 1200, 2000].map((ms) => setTimeout(invalidate, ms));

    // Observe container size mutations (e.g. chat container expand/flex reflow)
    const container = map.getContainer();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      ro = new ResizeObserver(() => {
        invalidate();
      });
      ro.observe(container);
      if (container.parentElement) {
        ro.observe(container.parentElement);
      }
    }

    const onWinResize = () => invalidate();
    window.addEventListener('resize', onWinResize);

    return () => {
      timeouts.forEach(clearTimeout);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onWinResize);
    };
  }, [map]);

  // When selected target coordinates change
  useEffect(() => {
    if (!targetCoords) return;
    try {
      map.invalidateSize({ animate: false });
      if (!hasMountedRef.current) {
        map.setView(targetCoords, 15, { animate: false });
        hasMountedRef.current = true;
      } else {
        map.flyTo(targetCoords, 15, { duration: 0.8 });
      }
    } catch (err) {
      // ignore
    }
  }, [targetCoords, selectedIndex, map]);

  return null;
}

function CustomMapControls({
  onCenterBranch,
  onCenterUser,
  hasUserLocation,
}: {
  onCenterBranch: () => void;
  onCenterUser?: () => void;
  hasUserLocation: boolean;
}) {
  const map = useMap();

  return (
    <div className="absolute right-2 top-2 z-[400] flex flex-col gap-1.5">
      <div className="flex flex-col rounded-lg bg-white/95 backdrop-blur-xs border border-stone-200/80 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          aria-label="Phóng to"
          className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors border-b border-stone-100 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          aria-label="Thu nhỏ"
          className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={hasUserLocation ? onCenterUser : onCenterBranch}
        title={hasUserLocation ? 'Về vị trí của bạn' : 'Về chi nhánh đang chọn'}
        aria-label="Định tâm bản đồ"
        className="w-7 h-7 rounded-lg bg-white/95 backdrop-blur-xs border border-stone-200/80 shadow-xs flex items-center justify-center text-stone-700 hover:text-rose-600 hover:bg-stone-50 transition-colors cursor-pointer"
      >
        <LocateFixed className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ChatbotLeafletMap({
  branches,
  selectedIndex,
  onSelectIndex,
  userLocation,
  height = '210px',
  className = '',
}: ChatbotLeafletMapProps) {
  const validBranches = useMemo(() => {
    return (branches || []).filter(
      (b) =>
        typeof b.latitude === 'number' &&
        !isNaN(b.latitude) &&
        typeof b.longitude === 'number' &&
        !isNaN(b.longitude),
    );
  }, [branches]);

  const activeBranch = validBranches[selectedIndex] || validBranches[0];

  const centerCoords: [number, number] = useMemo(() => {
    if (activeBranch && typeof activeBranch.latitude === 'number' && typeof activeBranch.longitude === 'number') {
      return [activeBranch.latitude, activeBranch.longitude];
    }
    if (userLocation) return userLocation;
    return MAP_DEFAULT_CENTER;
  }, [activeBranch, userLocation]);

  return (
    <div
      style={{ height, width: '100%' }}
      className={`relative w-full overflow-hidden bg-stone-100 ${className}`}
    >
      <MapContainer
        center={centerCoords}
        zoom={15}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full z-0 leaflet-full-width"
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url={MAP_TILE_URL}
          subdomains={MAP_TILE_SUBDOMAINS}
          attribution={MAP_TILE_ATTRIBUTION}
          maxZoom={20}
        />

        <MapController
          targetCoords={centerCoords}
          userLocation={userLocation}
          selectedIndex={selectedIndex}
        />

        <CustomMapControls
          onCenterBranch={() => {
            // center to active branch
          }}
          onCenterUser={() => {
            // handled via centerCoords
          }}
          hasUserLocation={Boolean(userLocation)}
        />

        {/* User GPS Pin */}
        {userLocation && (
          <Marker position={userLocation} icon={createUserLocationPin()} />
        )}

        {/* Branch Markers */}
        {validBranches.map((branch, idx) => {
          const isSelected = idx === selectedIndex;
          const pos: [number, number] = [branch.latitude!, branch.longitude!];
          return (
            <Marker
              key={branch.id || idx}
              position={pos}
              icon={createBranchPin(isSelected)}
              eventHandlers={{
                click: () => onSelectIndex(idx),
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
