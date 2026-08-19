"use client";

import React, { useEffect, useCallback, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Loader2, X, AlertCircle } from 'lucide-react';

// ── Fix Leaflet default icon paths in Next.js ────────────────────────────────
// This MUST run before any L.Icon is created
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface Branch {
  id: string;
  name: string;
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
  phone?: string;
  openTime?: string;
  closeTime?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][]; // [lat, lng][]
}

interface Props {
  branches: Branch[];
  selectedBranch: Branch | null;
  onSelectBranch: (branch: Branch) => void;
  userLocation: [number, number] | null;
  onUserLocation: (loc: [number, number]) => void;
  routeInfo: RouteInfo | null;
  onRouteInfo: (info: RouteInfo | null) => void;
  onRequestRoute: (branch: Branch) => void;
}

// ── Custom icon factory ───────────────────────────────────────────────────────
function createBranchIcon(selected: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [42, 52],
    iconAnchor: [21, 52],
    popupAnchor: [0, -54],
    html: `
      <div style="
        position:relative;
        width:42px;
        height:52px;
        display:flex;
        flex-direction:column;
        align-items:center;
      ">
        <!-- Pin body -->
        <div style="
          width:42px; height:42px;
          background:${selected ? '#D32F2F' : '#ffffff'};
          border:2.5px solid ${selected ? '#B71C1C' : '#cbd5e1'};
          border-radius:50% 50% 50% 6px;
          transform:rotate(-45deg);
          box-shadow:0 4px 14px rgba(0,0,0,${selected ? '0.3' : '0.18'});
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0;
          overflow:hidden;
        ">
          <!-- Logo container (counter-rotated) -->
          <div style="
            transform:rotate(45deg);
            width:30px; height:30px;
            display:flex; align-items:center; justify-content:center;
            border-radius:50%;
            background:${selected ? 'rgba(255,255,255,0.15)' : 'transparent'};
          ">
            <img
              src="/avora_logo.png"
              alt="Avora"
              style="
                width:26px; height:26px;
                object-fit:contain;
                ${selected ? 'filter:brightness(0) invert(1);' : ''}
              "
            />
          </div>
        </div>
        <!-- Pin tip -->
        <div style="
          width:6px; height:10px;
          background:${selected ? '#D32F2F' : '#cbd5e1'};
          clip-path:polygon(50% 100%, 0% 0%, 100% 0%);
          margin-top:-1px;
          flex-shrink:0;
        "></div>
        <!-- Drop shadow -->
        <div style="
          width:12px; height:4px;
          background:rgba(0,0,0,0.18);
          border-radius:50%;
          margin-top:0px;
          flex-shrink:0;
        "></div>
      </div>`,
  });
}

const userIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="
    width:22px; height:22px;
    background:#2563eb;
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 0 0 5px rgba(37,99,235,0.25), 0 2px 8px rgba(0,0,0,0.2);
  "></div>`,
});

// ── MapUpdater: inner component that uses useMap() hook ──────────────────────
// This is the correct pattern for imperatively controlling the map in react-leaflet v4+
interface MapUpdaterProps {
  branches: Branch[];
  selectedBranch: Branch | null;
  userLocation: [number, number] | null;
  routeInfo: RouteInfo | null;
  locateTrigger: number;
}

function MapUpdater({ branches, selectedBranch, userLocation, routeInfo, locateTrigger }: MapUpdaterProps) {
  const map = useMap();

  // ── Auto-zoom to fit all valid branch markers on load / when branches change ──
  useEffect(() => {
    const validBranches = branches.filter(
      b => typeof b.latitude === 'number' && typeof b.longitude === 'number'
        && b.latitude !== null && b.longitude !== null
    );

    console.log('[RestaurantsMap] branches received:', branches.length, 'valid coords:', validBranches.length);
    if (validBranches.length === 0) {
      console.warn('[RestaurantsMap] No branches with valid latitude/longitude found. Check API response.');
      return;
    }

    const bounds = L.latLngBounds(
      validBranches.map(b => [b.latitude as number, b.longitude as number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [branches, map]);

  // ── Pan to selected branch when user picks one (only when no route active) ──
  useEffect(() => {
    if (!selectedBranch || routeInfo) return;
    const lat = selectedBranch.latitude;
    const lng = selectedBranch.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    map.flyTo([lat, lng], 15, { duration: 0.7 });
  }, [selectedBranch, routeInfo, map]);

  // ── Fly to user location when obtained — zoom to 15 for close-up view ──
  useEffect(() => {
    if (!userLocation) return;
    map.flyTo(userLocation, 15, { duration: 1.2 });
  }, [userLocation, locateTrigger, map]);

  // ── Fit route bounds when route is drawn ──
  useEffect(() => {
    if (!routeInfo || routeInfo.coordinates.length === 0) return;
    const bounds = L.latLngBounds(routeInfo.coordinates);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [routeInfo, map]);

  return null;
}

// ── Route info label ─────────────────────────────────────────────────────────
function RouteLabel({ routeInfo }: { routeInfo: RouteInfo }) {
  const midIdx = Math.floor(routeInfo.coordinates.length / 2);
  const midPt = routeInfo.coordinates[midIdx];
  if (!midPt) return null;

  const labelIcon = L.divIcon({
    className: '',
    iconAnchor: [80, 14],
    html: `<div style="
      background:rgba(255,255,255,0.97);
      border:1.5px solid #D32F2F;
      border-radius:8px;
      padding:5px 12px;
      font-size:12px;
      font-weight:700;
      color:#D32F2F;
      white-space:nowrap;
      box-shadow:0 2px 10px rgba(0,0,0,0.14);
    ">📍 ${routeInfo.distanceKm.toFixed(1)} km &nbsp;·&nbsp; ⏱ ${routeInfo.durationMin} phút</div>`,
  });

  return <Marker position={midPt} icon={labelIcon} interactive={false} />;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RestaurantsMap({
  branches,
  selectedBranch,
  onSelectBranch,
  userLocation,
  onUserLocation,
  routeInfo,
  onRouteInfo,
  onRequestRoute,
}: Props) {
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locateTrigger, setLocateTrigger] = useState(0);

  const handleLocate = useCallback(() => {
    setLocateError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        onUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocateTrigger(prev => prev + 1);
        setIsLocating(false);
      },
      () => {
        setLocateError('Không thể lấy vị trí. Vui lòng cấp quyền định vị.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onUserLocation]);

  // Valid branches only (for rendering Markers)
  const validBranches = branches.filter(
    b => typeof b.latitude === 'number' && b.latitude !== null
      && typeof b.longitude === 'number' && b.longitude !== null
  );

  return (
    <div className="relative w-full h-full z-0">
      <MapContainer
        center={[10.7769, 106.7009]} // default: HCMC — MapUpdater will override
        zoom={12}
        zoomControl={false}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
          maxZoom={19}
        />

        <ZoomControl position="bottomright" />

        {/* Inner controller: handles fitBounds, flyTo, etc. */}
        <MapUpdater
          branches={branches}
          selectedBranch={selectedBranch}
          userLocation={userLocation}
          routeInfo={routeInfo}
          locateTrigger={locateTrigger}
        />

        {/* Branch markers — only rendered if lat/lng exist */}
        {validBranches.map(branch => (
          <Marker
            key={branch.id}
            position={[branch.latitude as number, branch.longitude as number]}
            icon={createBranchIcon(selectedBranch?.id === branch.id)}
            eventHandlers={{ click: () => onSelectBranch(branch) }}
          />
        ))}

        {/* User location marker */}
        {userLocation && (
          <Marker position={userLocation} icon={userIcon} zIndexOffset={1000} />
        )}

        {/* Route polyline */}
        {routeInfo && routeInfo.coordinates.length > 0 && (
          <>
            <Polyline
              positions={routeInfo.coordinates}
              pathOptions={{
                color: '#D32F2F',
                weight: 4.5,
                opacity: 0.88,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <RouteLabel routeInfo={routeInfo} />
          </>
        )}
      </MapContainer>

      {/* ── Floating controls ────────────────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button
          onClick={handleLocate}
          disabled={isLocating}
          title="Tìm vị trí của tôi"
          className="w-10 h-10 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-red-300 hover:text-red-600 transition-all disabled:opacity-60"
        >
          {isLocating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <LocateFixed className="w-4 h-4" />}
        </button>

        {routeInfo && (
          <button
            onClick={() => onRouteInfo(null)}
            title="Xóa đường đi"
            className="w-10 h-10 bg-white rounded-lg border border-red-200 shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Error toast ──────────────────────────────────────────────────── */}
      {locateError && (
        <div className="absolute bottom-12 left-3 right-3 z-[1000] bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-start gap-2 text-xs text-red-700 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{locateError}</span>
          <button onClick={() => setLocateError(null)} className="ml-auto shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
