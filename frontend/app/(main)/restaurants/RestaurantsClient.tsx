"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin, Phone, Clock, Navigation,
  Utensils, LocateFixed, Loader2,
  Building2, Search
} from 'lucide-react';
import type { Branch, RouteInfo } from '@/src/components/RestaurantsMap';
import { useCart } from '@/context/CartContext';

// ── Dynamic import (no SSR for Leaflet) ─────────────────────────────────────
const RestaurantsMap = dynamic(
  () => import('@/src/components/RestaurantsMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-red-600" />
          <span className="text-sm text-slate-500">Đang tải bản đồ...</span>
        </div>
      </div>
    ),
  }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Haversine distance ───────────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function branchLat(b: Branch) { return b.latitude; }
function branchLng(b: Branch) { return b.longitude; }

// ── Vietnamese city alias map (handles abbreviations & typos) ─────────────────────
const CITY_ALIASES: Record<string, string[]> = {
  'h\u1ed3 ch\u00ed minh': ['hcm', 'hcmc', 'saigon', 's\u00e0i g\u00f2n', 'sg', 'tp hcm', 'tp.hcm'],
  'h\u00e0 n\u1ed9i': ['hn', 'hanoi', 'h\u00e0 n\u1ed9i'],
  '\u0111\u00e0 n\u1eb5ng': ['dn', '\u0111\u00e0 n\u1eb5ng'],
  'c\u1ea7n th\u01a1': ['ct', 'c\u1ea7n th\u01a1'],
  'h\u1ea3i ph\u00f2ng': ['hp'],
  'nha trang': ['nt'],
  'v\u0169ng t\u00e0u': ['vt'],
  'h\u1ed9i an': ['ha'],
  'hu\u1ebf': ['hue'],
  'b\u00ecnh d\u01b0\u01a1ng': ['bd'],
  '\u0111\u1ed3ng nai': ['dn2'],
};

function normalizeSearch(q: string): string {
  const lower = q.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.includes(lower)) return canonical;
  }
  return lower;
}

function branchMatchesSearch(b: Branch, q: string): boolean {
  const norm = normalizeSearch(q);
  const fields = [
    b.name, b.street, b.ward, b.district, b.province
  ].filter(Boolean).map(s => s!.toLowerCase());

  // Also check if norm matches any field, OR if any alias of the field matches q
  return fields.some(f =>
    f.includes(norm) || norm.split(' ').every(word => f.includes(word))
  );
}

function isOpenNow(openTime?: string, closeTime?: string): boolean {
  if (!openTime || !closeTime) return true;
  const now = new Date();
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= oh * 60 + om && nowMin <= ch * 60 + cm;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RestaurantsPageClient({ initialBranches }: { initialBranches: Branch[] }) {
  const router = useRouter();
  const { changeBranch } = useCart();
  const listRef = useRef<HTMLDivElement>(null);

  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [distances, setDistances] = useState<Record<string, number>>({});
  const [isRouting, setIsRouting] = useState(false);
  const [routingBranchId, setRoutingBranchId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── Sort branches by distance when user location is known ─────────────────
  useEffect(() => {
    if (!userLocation) return;
    const [uLat, uLng] = userLocation;
    const dists: Record<string, number> = {};
    branches.forEach(b => {
      const lat = branchLat(b);
      const lng = branchLng(b);
      if (lat && lng) dists[b.id] = haversine(uLat, uLng, lat, lng);
    });
    setDistances(dists);

    setBranches(prev =>
      [...prev].sort((a, b) => {
        const da = dists[a.id] ?? Infinity;
        const db = dists[b.id] ?? Infinity;
        return da - db;
      })
    );
  }, [userLocation]);

  // ── Filter by search ──────────────────────────────────────────────────────
  const filtered = branches.filter(b => {
    if (!search.trim()) return true;
    return branchMatchesSearch(b, search);
  });

  // ── Select a branch and scroll to it ─────────────────────────────────────
  const handleSelectBranch = useCallback((branch: Branch) => {
    setSelectedBranch(branch);
    setRouteInfo(null);

    // Scroll card into view on mobile list
    setTimeout(() => {
      const el = document.getElementById(`branch-card-${branch.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, 100);
  }, []);

  // ── Get OSRM route ────────────────────────────────────────────────────────
  const handleRequestRoute = useCallback(async (branch: Branch, currentUserLoc?: [number, number]) => {
    const loc = currentUserLoc ?? userLocation;
    if (!loc) return;
    const destLat = branchLat(branch);
    const destLng = branchLng(branch);
    if (!destLat || !destLng) return;

    setIsRouting(true);
    setRoutingBranchId(branch.id);
    setSelectedBranch(branch);
    try {
      const [uLat, uLng] = loc;
      const url = `https://router.project-osrm.org/route/v1/driving/${uLng},${uLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes[0]) {
        const route = data.routes[0];
        const coords: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );
        setRouteInfo({
          distanceKm: route.distance / 1000,
          durationMin: Math.round(route.duration / 60),
          coordinates: coords,
        });
      }
    } catch { } finally {
      setIsRouting(false);
      setRoutingBranchId(null);
    }
  }, [userLocation]);

  // ── Locate + then route ───────────────────────────────────────────────────
  const handleLocateAndRoute = useCallback((branch: Branch) => {
    if (userLocation) {
      handleRequestRoute(branch, userLocation);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        handleRequestRoute(branch, loc);
      },
      () => { },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [userLocation, handleRequestRoute]);

  // ── Order at branch ───────────────────────────────────────────────────────
  const handleOrderAt = useCallback((branch: Branch) => {
    changeBranch(branch.id);
    localStorage.setItem('selectedBranchId', branch.id);
    router.push('/');
  }, [changeBranch, router]);

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-128px)] md:h-[calc(100vh-80px)] md:overflow-hidden bg-slate-50">

      {/* ── LEFT COLUMN: Branch List ─────────────────────────────────────── */}
      <div className="
        w-full md:w-[380px] lg:w-[420px] shrink-0
        flex flex-col
        md:border-r border-slate-200
        bg-white
        order-2 md:order-1
        md:h-full
        md:overflow-hidden
      ">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-red-600" />
                Hệ thống Cửa hàng
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">{branches.length} chi nhánh trên toàn quốc</p>
            </div>
            {userLocation && (
              <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold bg-green-50 border border-green-200 rounded-md px-2 py-1">
                <LocateFixed className="w-3 h-3" />
                Đã định vị
              </span>
            )}
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm chi nhánh..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all placeholder-slate-400"
            />
          </div>
        </div>

        {/* List */}
        <div
          ref={listRef}
          className="flex-1 md:overflow-y-auto px-3 py-2 space-y-2 pb-6"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }}
        >
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <MapPin className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Không tìm thấy chi nhánh</p>
            </div>
          )}

          {filtered.map(branch => {
            const isSelected = selectedBranch?.id === branch.id;
            const dist = distances[branch.id];
            const open = isOpenNow(branch.openTime, branch.closeTime);
            const isRoutingThis = routingBranchId === branch.id && isRouting;
            const hasRouteForThis = routeInfo && isSelected;

            return (
              <div
                id={`branch-card-${branch.id}`}
                key={branch.id}
                onClick={() => handleSelectBranch(branch)}
                className={`
                  relative rounded-xl border cursor-pointer transition-all duration-200
                  ${isSelected
                    ? 'border-red-400 bg-red-50/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }
                `}
              >
                {/* Distance badge */}
                {dist !== undefined && (
                  <span className="absolute top-2.5 right-2.5 flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-md px-1.5 py-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                  </span>
                )}

                {/* Route info badge if routed */}
                {hasRouteForThis && routeInfo && (
                  <span className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-md px-1.5 py-0.5">
                    🗺 {routeInfo.distanceKm.toFixed(1)}km · {routeInfo.durationMin}ph
                  </span>
                )}

                {/* Main content */}
                <div className="px-3 pt-2.5 pb-2">
                  <div className="flex items-start gap-2">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-red-100' : 'bg-slate-100'}`}>
                      <Building2 className={`w-4 h-4 ${isSelected ? 'text-red-600' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className={`text-sm font-semibold truncate ${isSelected ? 'text-red-700' : 'text-slate-800'}`}>
                        {branch.name}
                      </h3>
                      {(branch.street || branch.district || branch.province) && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {[branch.street, branch.ward, branch.district, branch.province].filter(Boolean).join(', ')}
                        </p>
                      )}
                      <div className="flex items-center gap-2.5 mt-1">
                        {branch.phone && (
                          <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                            <Phone className="w-3 h-3" />
                            {branch.phone}
                          </span>
                        )}
                        {(branch.openTime || branch.closeTime) && (
                          <span className={`flex items-center gap-0.5 text-[11px] font-medium ${open ? 'text-green-600' : 'text-red-400'}`}>
                            <Clock className="w-3 h-3" />
                            {branch.openTime || '?'}–{branch.closeTime || '?'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className={`border-t flex items-stretch ${isSelected ? 'border-red-100' : 'border-slate-100'}`}>
                  {/* Xem trên bản đồ */}
                  <button
                    onClick={e => { e.stopPropagation(); handleSelectBranch(branch); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-slate-500 hover:text-red-600 hover:bg-red-50/50 transition-colors"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Vị trí</span>
                  </button>

                  <div className={`w-px ${isSelected ? 'bg-red-100' : 'bg-slate-100'}`} />

                  {/* Chỉ đường */}
                  <button
                    onClick={e => { e.stopPropagation(); handleLocateAndRoute(branch); }}
                    disabled={isRoutingThis}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 transition-colors disabled:opacity-60"
                  >
                    {isRoutingThis
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Navigation className="w-3 h-3" />}
                    <span>Chỉ đường</span>
                  </button>

                  <div className={`w-px ${isSelected ? 'bg-red-100' : 'bg-slate-100'}`} />

                  {/* Google Maps */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${branch.name} ${branch.street || ''} ${branch.district || ''}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-slate-500 hover:text-green-600 hover:bg-green-50/50 transition-colors"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span>Google</span>
                  </a>

                  <div className={`w-px ${isSelected ? 'bg-red-100' : 'bg-slate-100'}`} />

                  {/* Đặt món */}
                  <button
                    onClick={e => { e.stopPropagation(); handleOrderAt(branch); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-600 hover:text-white transition-all rounded-br-xl"
                  >
                    <Utensils className="w-3 h-3" />
                    <span>Đặt món</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT COLUMN: Map ────────────────────────────────────────────── */}
      <div className="w-full md:flex-1 relative order-1 md:order-2 h-[45vh] md:h-full shrink-0 z-10">
        {/* Map header overlay (desktop) */}
        <div className="hidden md:flex absolute top-3 left-3 z-[1000] gap-2 items-center">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm px-3 py-1.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700">
              {branches.length} Chi nhánh Avora
            </span>
          </div>
          {routeInfo && (
            <div className="bg-red-600 text-white rounded-lg shadow-sm px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Navigation className="w-3 h-3" />
              {routeInfo.distanceKm.toFixed(1)} km · {routeInfo.durationMin} phút
            </div>
          )}
        </div>

        <RestaurantsMap
          branches={branches}
          selectedBranch={selectedBranch}
          onSelectBranch={handleSelectBranch}
          userLocation={userLocation}
          onUserLocation={setUserLocation}
          routeInfo={routeInfo}
          onRouteInfo={setRouteInfo}
          onRequestRoute={handleLocateAndRoute}
        />
      </div>
    </div>
  );
}
