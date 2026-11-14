"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { DeliveryAddressPickerCard, DeliveryAddressData } from './DeliveryAddressPickerCard';
import {
  MapPin,
  Navigation,
  Clock,
  Phone,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Loader2,
  Compass,
  Sparkles,
  Building2,
  ChevronRight,
} from 'lucide-react';

const ChatbotLeafletMap = dynamic(() => import('./ChatbotLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-48 sm:h-56 rounded-2xl bg-stone-100 border border-stone-200 flex flex-col items-center justify-center text-stone-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
      <span className="text-xs font-medium">Đang tải bản đồ AVORA...</span>
    </div>
  ),
});

export interface BranchMapItem {
  id: string;
  name: string;
  slug?: string;
  address: string;
  phone?: string;
  openingHours?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number;
  distanceNote?: string;
  googleMapsUrl?: string;
  embedMapUrl?: string;
  onlineOrderingEnabled?: boolean;
}

export interface BranchLocationMapCardProps {
  actionType?: string | null;
  actionPayload?: string | Record<string, any> | null;
  isHistorical?: boolean;
  compact?: boolean;
  selectedBranchId?: string;
  onLocationShared?: (lat: number, lng: number, reason: string) => void;
  onConfirmDeliveryAddress?: (data: DeliveryAddressData) => void;
  onSelectBranch?: (branchId: string, branchName: string) => void;
  onBookTable?: (branchName: string) => void;
}

const DEFAULT_FALLBACK_BRANCHES: BranchMapItem[] = [
  {
    id: 'avora-landmark-81',
    name: 'Avora Landmark 81',
    slug: 'avora-landmark-81',
    address: 'Tầng B1, Vincom Center Landmark 81, 720A Điện Biên Phủ, Bình Thạnh, TP.HCM',
    phone: '1900 6868',
    openingHours: '10:00 - 22:00 (Thứ 2 - Chủ Nhật)',
    latitude: 10.795,
    longitude: 106.7218,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=10.795,106.7218',
  },
  {
    id: 'avora-hoan-kiem',
    name: 'Avora Hoàn Kiếm',
    slug: 'avora-hoan-kiem',
    address: '15 Lý Thái Tổ, Hoàn Kiếm, Hà Nội',
    phone: '1900 6868',
    openingHours: '10:00 - 22:00 (Thứ 2 - Chủ Nhật)',
    latitude: 21.0285,
    longitude: 105.8542,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.0285,105.8542',
  },
  {
    id: 'avora-signature-quan-1',
    name: 'Avora Signature Quận 1',
    slug: 'avora-signature-quan-1',
    address: '123 Lê Lợi, Bến Thành, Quận 1, TP.HCM',
    phone: '1900 6868',
    openingHours: '10:00 - 23:00 (Thứ 2 - Chủ Nhật)',
    latitude: 10.7719,
    longitude: 106.6983,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=10.7719,106.6983',
  },
  {
    id: 'avora-premium-thao-dien',
    name: 'Avora Premium Thảo Điền',
    slug: 'avora-premium-thao-dien',
    address: '45 Xuân Thủy, Thảo Điền, TP. Thủ Đức, TP.HCM',
    phone: '1900 6868',
    openingHours: '10:00 - 22:30 (Thứ 2 - Chủ Nhật)',
    latitude: 10.8042,
    longitude: 106.7365,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=10.8042,106.7365',
  },
];

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function BranchLocationMapCard({
  actionType,
  actionPayload,
  isHistorical = false,
  compact = false,
  selectedBranchId,
  onLocationShared,
  onConfirmDeliveryAddress,
  onSelectBranch,
  onBookTable,
}: BranchLocationMapCardProps) {
  const parsedPayload = useMemo(() => {
    if (!actionPayload) return {};
    if (typeof actionPayload === 'object') return actionPayload;
    try {
      return JSON.parse(actionPayload);
    } catch {
      return {};
    }
  }, [actionPayload]);

  const reason: string = parsedPayload.reason || (actionType === 'SHOW_MAP_LINK' ? 'FIND_NEAREST_BRANCH' : 'FIND_NEAREST_BRANCH');
  const isDeliveryAddressRequest =
    reason === 'DELIVERY_ADDRESS' ||
    reason === 'CHANGE_ADDRESS' ||
    reason === 'NEW_ADDRESS' ||
    parsedPayload.isDeliveryAddress === true;

  // Yêu cầu: Tự động dự phòng sau 10 giây nếu khách không cho vị trí
  const fallbackSecondsConfig = Number(parsedPayload.autoFallbackSeconds) > 0 ? Number(parsedPayload.autoFallbackSeconds) : 10;

  // Normalize branches from payload
  const initialBranches: BranchMapItem[] = useMemo(() => {
    if (Array.isArray(parsedPayload.nearestBranches) && parsedPayload.nearestBranches.length > 0) {
      return parsedPayload.nearestBranches;
    }
    if (Array.isArray(parsedPayload.allBranches) && parsedPayload.allBranches.length > 0) {
      return parsedPayload.allBranches;
    }
    if (parsedPayload.branch && typeof parsedPayload.branch === 'object') {
      return [parsedPayload.branch];
    }
    return DEFAULT_FALLBACK_BRANCHES;
  }, [parsedPayload]);

  const initialMode: 'AWAITING_GPS' | 'NEAREST_FOUND' | 'STATIC_BRANCHES' = useMemo(() => {
    if (parsedPayload.mode === 'NEAREST_FOUND') return 'NEAREST_FOUND';
    if (parsedPayload.mode === 'STATIC_BRANCHES' || actionType === 'SHOW_MAP_LINK') return 'STATIC_BRANCHES';
    if (isHistorical) return 'STATIC_BRANCHES';
    return 'AWAITING_GPS';
  }, [parsedPayload.mode, actionType, isHistorical]);

  const [viewMode, setViewMode] = useState<'AWAITING_GPS' | 'NEAREST_FOUND' | 'STATIC_BRANCHES'>(initialMode);
  const [countdown, setCountdown] = useState<number>(fallbackSecondsConfig);
  const [isLocating, setIsLocating] = useState(false);
  const [autoFallbackTriggered, setAutoFallbackTriggered] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchMapItem[]>(initialBranches);
  const [activeMapBranchIndex, setActiveMapBranchIndex] = useState(0);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const timerPausedRef = useRef(false);

  useEffect(() => {
    setBranches(initialBranches);
    setActiveMapBranchIndex(0);
  }, [initialBranches]);

  useEffect(() => {
    setViewMode(initialMode);
  }, [initialMode]);

  // User-driven permission: Do not force auto-open map without user interaction
  useEffect(() => {
    // Keep countdown updated if needed but do not force switch automatically
  }, []);

  const handleRequestGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsErrorMsg('Thiết bị không hỗ trợ định vị GPS. Đã hiển thị danh sách chi nhánh.');
      setViewMode('STATIC_BRANCHES');
      return;
    }

    timerPausedRef.current = true;
    setIsLocating(true);
    setGpsErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setIsLocating(false);
        setUserCoords([lat, lng]);

        if (isDeliveryAddressRequest) {
          onLocationShared?.(lat, lng, 'DELIVERY_ADDRESS');
          return;
        }

        // Instant zero-latency client-side Haversine sort on preloaded branches
        const sourceList: BranchMapItem[] =
          Array.isArray(parsedPayload.allBranches) && parsedPayload.allBranches.length > 0
            ? parsedPayload.allBranches
            : branches;

        const computed = sourceList
          .map((b) => {
            if (b.latitude != null && b.longitude != null) {
              const dist = calculateHaversineKm(lat, lng, Number(b.latitude), Number(b.longitude));
              const roundedDist = Number(dist.toFixed(1));
              return {
                ...b,
                distanceKm: roundedDist,
                distanceNote: 'Khoảng cách chim bay',
              };
            }
            return b;
          })
          .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

        setBranches(computed);
        setActiveMapBranchIndex(0);
        setAutoFallbackTriggered(false);
        setViewMode('NEAREST_FOUND');
      },
      (err) => {
        setIsLocating(false);
        timerPausedRef.current = false;
        const code = err?.code;
        if (isDeliveryAddressRequest) {
          if (code === 1) {
            setGpsErrorMsg('Quý khách đã từ chối quyền vị trí GPS. Vui lòng gõ địa chỉ nhận hàng vào khung chat nhé!');
          } else if (code === 3) {
            setGpsErrorMsg('Hết thời gian chờ tín hiệu GPS. Quý khách vui lòng gõ địa chỉ nhận hàng vào khung chat nhé!');
          } else {
            setGpsErrorMsg('Không thể lấy GPS tự động. Quý khách vui lòng gõ địa chỉ nhận hàng vào khung chat nhé!');
          }
        } else {
          if (code === 1) {
            setGpsErrorMsg('Đã từ chối quyền vị trí GPS — Đã hiển thị danh sách chi nhánh & bản đồ AVORA:');
          } else if (code === 3) {
            setGpsErrorMsg('Quá thời gian chờ tín hiệu GPS — Đã hiển thị danh sách chi nhánh & bản đồ AVORA:');
          } else {
            setGpsErrorMsg('Không lấy được tín hiệu GPS — Hiển thị danh sách tất cả chi nhánh AVORA:');
          }
          setViewMode('STATIC_BRANCHES');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // ── Render Delivery Address Mode (Interactive Map + Search + Recipient Info) ──
  if (isDeliveryAddressRequest) {
    return (
      <DeliveryAddressPickerCard
        initialLat={userCoords?.[0] || parsedPayload.latitude}
        initialLng={userCoords?.[1] || parsedPayload.longitude}
        initialAddress={parsedPayload.currentAddress}
        isHistorical={isHistorical}
        onConfirmAddress={(data) => {
          onLocationShared?.(data.latitude, data.longitude, 'DELIVERY_ADDRESS');
          onConfirmDeliveryAddress?.(data);
        }}
      />
    );
  }

  // ── Requirement 2: Gửi nút xin vị trí trước rồi mới hiển thị bản đồ danh sách chi nhánh ──
  if (viewMode === 'AWAITING_GPS' && !isHistorical) {
    return (
      <div className="mt-3 w-full bg-gradient-to-br from-rose-50/90 via-white to-stone-50 border border-rose-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <span>Tìm chi nhánh AVORA gần bạn nhất</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </h4>
            <p className="text-[11px] sm:text-xs text-stone-600 mt-1 leading-relaxed">
              Cho phép AVORA truy cập vị trí hiện tại để hệ thống tự động đo khoảng cách và chọn cơ sở gần bạn nhất kèm bản đồ chỉ đường:
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={handleRequestGps}
            disabled={isLocating}
            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            {isLocating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xác định tọa độ GPS...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>📍 Cho phép định vị tìm chi nhánh gần nhất</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setViewMode('STATIC_BRANCHES')}
            className="py-2.5 px-3 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs sm:text-sm rounded-xl border border-stone-200 shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Xem danh sách toàn bộ chi nhánh</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {gpsErrorMsg && (
          <p className="text-[10.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 font-medium">
            {gpsErrorMsg}
          </p>
        )}
      </div>
    );
  }

  const activeBranch = branches[activeMapBranchIndex] || branches[0] || DEFAULT_FALLBACK_BRANCHES[0];
  const countdownPercentage = Math.max(0, Math.min(100, (countdown / fallbackSecondsConfig) * 100));

  return (
    <div className="mt-3 w-full bg-white border border-stone-200/90 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_6px_24px_-4px_rgba(0,0,0,0.08)] transition-all">
      {/* 1. Top Soft Luxury Bar */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-rose-950 text-white px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            {viewMode === 'NEAREST_FOUND' ? (
              <Sparkles className="w-3.5 h-3.5" />
            ) : (
              <Building2 className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-[11.5px] sm:text-xs font-bold tracking-tight truncate">
              {viewMode === 'NEAREST_FOUND'
                ? `Chi nhánh gần nhất: ${branches[0]?.name} (${branches[0]?.distanceKm ?? '?'} km)`
                : `Hệ thống Chi nhánh AVORA (${branches.length} cơ sở)`}
            </h4>
            <p className="text-[10px] text-stone-300 truncate">
              {viewMode === 'AWAITING_GPS'
                ? `Tự động mở danh sách sau ${countdown} giây`
                : autoFallbackTriggered
                ? 'Đã mở danh sách chi nhánh tĩnh & bản đồ sau 10 giây'
                : gpsErrorMsg || 'Bấm chọn từng chi nhánh để xem ghim trực tiếp'}
            </p>
          </div>
        </div>

        {viewMode === 'AWAITING_GPS' && (
          <div className="shrink-0 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-[11px] font-mono font-bold text-amber-300">{countdown}s</span>
          </div>
        )}
      </div>

      {/* 2. Branch Switcher Pills directly above Map */}
      {branches.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2.5 py-1.5 bg-stone-50 border-b border-stone-200/70">
          {branches.map((b, idx) => {
            const isSelectedTab = idx === activeMapBranchIndex;
            return (
              <button
                key={b.id || idx}
                type="button"
                onClick={() => setActiveMapBranchIndex(idx)}
                className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold whitespace-nowrap flex items-center gap-1 transition-all shrink-0 ${
                  isSelectedTab
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-white text-stone-700 border border-stone-200 hover:border-rose-300 hover:text-rose-600'
                }`}
              >
                <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                <span>{b.name.replace(/^Avora\s+/i, '')}</span>
                {b.distanceKm !== undefined && (
                  <span className={isSelectedTab ? 'text-rose-200' : 'text-rose-600'}>
                    • {b.distanceKm}km
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. LEAFLET INTERACTIVE MAP with Avora Logo Pins & User Location */}
      <div className="relative w-full bg-stone-100 border-b border-stone-200">
        <ChatbotLeafletMap
          branches={branches}
          selectedIndex={activeMapBranchIndex}
          onSelectIndex={(idx) => setActiveMapBranchIndex(idx)}
          userLocation={userCoords}
          height={compact ? '200px' : '230px'}
        />

        {activeBranch?.googleMapsUrl && (
          <a
            href={activeBranch.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 z-[400] bg-white/95 hover:bg-white text-stone-800 border border-stone-200 shadow-sm px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
          >
            <span>Google Maps</span>
            <ExternalLink className="w-2.5 h-2.5 text-rose-600" />
          </a>
        )}
      </div>

      {/* 4. GPS REQUEST BUTTON PLACED BELOW THE MAP (Requirement) */}
      {viewMode === 'AWAITING_GPS' ? (
        <div className="p-2.5 sm:p-3 bg-gradient-to-b from-rose-50/70 to-white border-b border-rose-100 space-y-2">
          {/* 10s Countdown Progress Line */}
          <div className="w-full h-1 bg-rose-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${countdownPercentage}%` }}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-1.5">
            <button
              type="button"
              onClick={handleRequestGps}
              disabled={isLocating}
              className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11.5px] sm:text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              {isLocating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xác định tọa độ GPS...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Cho phép định vị tìm chi nhánh gần nhất</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('STATIC_BRANCHES')}
              className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-[10.5px] sm:text-[11px] rounded-xl transition-all shrink-0"
            >
              Xem tất cả ({branches.length})
            </button>
          </div>
        </div>
      ) : (
        viewMode === 'STATIC_BRANCHES' && (
          <div className="p-2 sm:p-2.5 bg-stone-50 border-b border-stone-200/60 flex items-center justify-between gap-2">
            <span className="text-[10.5px] text-stone-600 truncate">
              {gpsErrorMsg || 'Đang hiển thị toàn bộ chi nhánh AVORA'}
            </span>
            <button
              type="button"
              onClick={handleRequestGps}
              disabled={isLocating}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] sm:text-[10.5px] flex items-center gap-1 shadow-2xs transition-all shrink-0"
            >
              {isLocating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Navigation className="w-3 h-3" />
              )}
              <span>Định vị gần tôi</span>
            </button>
          </div>
        )
      )}

      {/* 5. Compact, High-Density Active Branch Card */}
      <div className="p-2.5 sm:p-3 bg-white">
        <div className="rounded-xl p-2.5 border border-rose-200/80 bg-stone-50/40 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h5 className="text-xs sm:text-[13px] font-bold text-stone-900 truncate">
                  {activeBranch.name}
                </h5>
                {viewMode === 'NEAREST_FOUND' && activeMapBranchIndex === 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase">
                    Gần nhất
                  </span>
                )}
                {selectedBranchId && activeBranch.id === selectedBranchId && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-bold">
                    Đang chọn
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">
                {activeBranch.address}
              </p>
            </div>

            {activeBranch.distanceKm !== undefined && (
              <div className="shrink-0 text-right bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                <div className="text-xs font-bold text-rose-600 leading-tight">
                  ~{activeBranch.distanceKm} km
                </div>
                <div className="text-[9px] text-stone-500">
                  {activeBranch.distanceNote || 'Chim bay'}
                </div>
              </div>
            )}
          </div>

          {/* Meta Info: Hours & Phone */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-stone-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{activeBranch.openingHours || '10:00 - 22:00'}</span>
            </span>
            {activeBranch.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3 text-rose-600 shrink-0" />
                <span>{activeBranch.phone}</span>
              </span>
            )}
          </div>

          {/* Actions: Select, Book Table, Direction */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-stone-200/60">
            {onSelectBranch && (
              <button
                type="button"
                onClick={() => onSelectBranch(activeBranch.id, activeBranch.name)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold flex items-center gap-1 transition-all ${
                  selectedBranchId && activeBranch.id === selectedBranchId
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>
                  {selectedBranchId && activeBranch.id === selectedBranchId
                    ? 'Đã chọn cơ sở này'
                    : 'Chọn chi nhánh này'}
                </span>
              </button>
            )}

            {onBookTable && (
              <button
                type="button"
                onClick={() => onBookTable(activeBranch.name)}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10.5px] sm:text-[11px] font-bold flex items-center gap-1 transition-all"
              >
                <Calendar className="w-3 h-3 text-amber-600" />
                <span>Đặt bàn</span>
              </button>
            )}

            {activeBranch.googleMapsUrl && (
              <a
                href={activeBranch.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10.5px] sm:text-[11px] font-bold flex items-center gap-1 transition-all ml-auto"
              >
                <Navigation className="w-3 h-3 text-rose-600" />
                <span>Chỉ đường</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
