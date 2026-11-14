"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin,
  Navigation,
  Search,
  Loader2,
  LocateFixed,
  User,
  Phone,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-48 sm:h-56 rounded-2xl bg-stone-100 border border-stone-200 flex flex-col items-center justify-center text-stone-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
      <span className="text-xs font-medium">Đang tải bản đồ tương tác...</span>
    </div>
  ),
});

export interface DeliveryAddressData {
  recipientName: string;
  phone: string;
  streetDetail: string;
  ward: string;
  province: string;
  latitude: number;
  longitude: number;
  deliveryNote?: string;
}

export interface DeliveryAddressPickerCardProps {
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string | null;
  onConfirmAddress: (data: DeliveryAddressData) => void;
  isHistorical?: boolean;
}

export function DeliveryAddressPickerCard({
  initialLat,
  initialLng,
  initialAddress = '',
  onConfirmAddress,
  isHistorical = false,
}: DeliveryAddressPickerCardProps) {
  // Steps: 'PROMPT_PERMISSION' -> 'MAP_PICKER' -> 'RECIPIENT_INFO' -> 'CONFIRMED'
  const [step, setStep] = useState<'PROMPT_PERMISSION' | 'MAP_PICKER' | 'RECIPIENT_INFO' | 'CONFIRMED'>(
    isHistorical ? 'CONFIRMED' : 'PROMPT_PERMISSION'
  );

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat || 10.795,
    lng: initialLng || 106.7218,
  });

  const [streetDetail, setStreetDetail] = useState('');
  const [ward, setWard] = useState('');
  const [province, setProvince] = useState('Thành phố Hồ Chí Minh');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<{ fullName?: string; name?: string; phone?: string } | null>(null);

  // Check stored user profile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const u = JSON.parse(stored);
          setUserProfile(u);
          if (u.fullName || u.name) setRecipientName(u.fullName || u.name);
          if (u.phone) setPhone(u.phone);
        }
      } catch (err) {
        // ignore
      }
    }
  }, []);

  // Reverse geocoding helper
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const p = addr.province || addr.city || addr.state || 'Thành phố Hồ Chí Minh';
        const w = addr.ward || addr.quarter || addr.suburb || addr.district || '';
        const road = addr.road || '';
        const houseNum = addr.house_number || '';
        const street = [houseNum, road].filter(Boolean).join(' ') || data.display_name?.split(',')[0] || '';

        setProvince(p);
        if (w) setWard(w);
        if (street) setStreetDetail(street);
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
  };

  // Request browser GPS
  const handleRequestGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      toast.error('Trình duyệt không hỗ trợ định vị GPS. Vui lòng chọn trên bản đồ.');
      setStep('MAP_PICKER');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setIsLocating(false);
        setCoords({ lat, lng });
        await reverseGeocode(lat, lng);
        setStep('MAP_PICKER');
        toast.success('Đã định vị thành công vị trí hiện tại!');
      },
      (err) => {
        setIsLocating(false);
        toast.error('Chưa thể lấy vị trí tự động. Quý khách vui lòng chọn trên bản đồ hoặc tìm kiếm nhé!');
        setStep('MAP_PICKER');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Debounced address search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!val.trim() || val.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(val.trim())}&biasLat=${coords.lat}&biasLon=${coords.lng}`);
        if (res.ok) {
          const list = await res.json();
          setSearchResults(Array.isArray(list) ? list.slice(0, 5) : []);
        }
      } catch (err) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelectSearchResult = async (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setSearchResults([]);
    setSearchQuery(item.display_name?.split(',')[0] || '');
    if (!isNaN(lat) && !isNaN(lng)) {
      setCoords({ lat, lng });
      await reverseGeocode(lat, lng);
    }
  };

  const handleMapChange = async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    await reverseGeocode(lat, lng);
  };

  const handleApplyAccountInfo = () => {
    if (userProfile) {
      if (userProfile.fullName || userProfile.name) {
        setRecipientName(userProfile.fullName || userProfile.name || '');
      }
      if (userProfile.phone) {
        setPhone(userProfile.phone);
      }
      toast.success('Đã điền thông tin từ tài khoản!');
    }
  };

  const handleConfirmFinal = () => {
    if (!recipientName.trim()) {
      toast.error('Vui lòng nhập tên người nhận hàng');
      return;
    }
    if (!phone.trim()) {
      toast.error('Vui lòng nhập số điện thoại nhận hàng');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 11) {
      toast.error('Số điện thoại không hợp lệ (cần 10 chữ số)');
      return;
    }

    const finalData: DeliveryAddressData = {
      recipientName: recipientName.trim(),
      phone: cleanPhone,
      streetDetail: streetDetail.trim() || 'Vị trí đã chọn',
      ward: ward.trim(),
      province: province.trim() || 'Hồ Chí Minh',
      latitude: coords.lat,
      longitude: coords.lng,
      deliveryNote: deliveryNote.trim() || undefined,
    };

    setStep('CONFIRMED');
    onConfirmAddress(finalData);
  };

  const fullDisplayAddress = [streetDetail, ward, province].filter(Boolean).join(', ') || initialAddress || 'Chưa xác định';

  // ── 1. PROMPT PERMISSION FIRST ──────────────────────────────────────────────
  if (step === 'PROMPT_PERMISSION') {
    return (
      <div className="mt-3 w-full bg-gradient-to-br from-rose-50/90 via-white to-stone-50 border border-rose-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <MapPin className="w-5 h-5 animate-bounce" style={{ animationDuration: '2.5s' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <span>Xác định địa chỉ giao hàng</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </h4>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Để tính phí vận chuyển chính xác và giao món nóng sốt, quý khách vui lòng cấp quyền truy cập vị trí hiện tại nhé:
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
                <span>Đang định vị tọa độ GPS...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>📍 Cho phép truy cập vị trí của tôi</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStep('MAP_PICKER')}
            className="py-2.5 px-3 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs sm:text-sm rounded-xl border border-stone-200 shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Tự chọn trên bản đồ</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── 2. MAP & ADDRESS PICKER ────────────────────────────────────────────────
  if (step === 'MAP_PICKER') {
    return (
      <div className="mt-3 w-full bg-white border border-stone-200 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm space-y-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 to-rose-950 text-white px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
            <h4 className="text-xs sm:text-sm font-bold truncate">Chọn vị trí giao hàng trên bản đồ</h4>
          </div>
          <button
            type="button"
            onClick={handleRequestGps}
            disabled={isLocating}
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10.5px] font-bold flex items-center gap-1 transition-all"
          >
            <LocateFixed className="w-3 h-3 text-rose-400" />
            <span>Định vị lại</span>
          </button>
        </div>

        {/* Address Search Bar */}
        <div className="p-2.5 bg-stone-50 border-b border-stone-200 relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Tìm kiếm số nhà, tên đường, phường/xã..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white border border-stone-200 focus:border-rose-500 focus:outline-hidden text-stone-800 placeholder-stone-400 shadow-2xs"
            />
            {isSearching && (
              <Loader2 className="w-3.5 h-3.5 text-rose-500 animate-spin absolute right-3" />
            )}
          </div>

          {/* Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-2.5 right-2.5 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-[500] max-h-48 overflow-y-auto divide-y divide-stone-100">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left p-2.5 hover:bg-rose-50/70 transition-colors flex items-start gap-2 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-stone-700 leading-snug line-clamp-2">
                    {item.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Leaflet Map */}
        <div className="relative w-full h-48 sm:h-56 bg-stone-100">
          <MapPicker position={coords} onChange={handleMapChange} />

          {/* Quick GPS Overlay button */}
          <button
            type="button"
            onClick={handleRequestGps}
            title="Định vị vị trí hiện tại của tôi"
            className="absolute bottom-3 right-3 z-[400] w-9 h-9 rounded-xl bg-white text-stone-700 border border-stone-200 shadow-md flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95"
          >
            {isLocating ? <Loader2 className="w-4 h-4 animate-spin text-rose-600" /> : <LocateFixed className="w-4 h-4" />}
          </button>
        </div>

        {/* Selected Address Display & Next Button */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 space-y-2">
          <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-stone-200/90 text-xs text-stone-700 shadow-2xs">
            <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="font-bold text-stone-900 block text-[11px] uppercase tracking-wide text-rose-700">
                Địa chỉ nhận diện từ bản đồ:
              </span>
              <p className="font-medium text-stone-800 break-words mt-0.5 text-xs">
                {fullDisplayAddress}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('RECIPIENT_INFO')}
            className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Tiếp tục: Nhập thông tin người nhận</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── 3. RECIPIENT INFO & USE ACCOUNT INFO DEFAULT ───────────────────────────
  if (step === 'RECIPIENT_INFO') {
    return (
      <div className="mt-3 w-full bg-white border border-stone-200 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm space-y-0">
        <div className="bg-gradient-to-r from-stone-900 to-rose-950 text-white px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs sm:text-sm font-bold">Thông tin người nhận hàng</h4>
          </div>
          <button
            type="button"
            onClick={() => setStep('MAP_PICKER')}
            className="text-[10.5px] text-rose-300 hover:text-white underline"
          >
            Đổi vị trí map
          </button>
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          {/* Summary of chosen address */}
          <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs text-stone-700 flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-stone-500">Giao đến:</span>
              <p className="font-medium text-stone-900 break-words">{fullDisplayAddress}</p>
            </div>
          </div>

          {/* Requirement: Default Ask Customer to Use Account Info */}
          {userProfile && (userProfile.fullName || userProfile.phone) && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Bạn có muốn dùng thông tin từ tài khoản không?
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyAccountInfo}
                className="w-full py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Dùng thông tin tài khoản: {userProfile.fullName || userProfile.name} • {userProfile.phone}</span>
              </button>
            </div>
          )}

          {/* Form inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Tên người nhận <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <User className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ví dụ: Anh Phát"
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl text-xs bg-stone-50 border border-stone-200 focus:bg-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Số điện thoại liên hệ <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0839654952"
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl text-xs bg-stone-50 border border-stone-200 focus:bg-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              Ghi chú giao hàng (tùy chọn)
            </label>
            <input
              type="text"
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="Ví dụ: Gọi trước khi giao, gửi bảo vệ tòa nhà..."
              className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-stone-50 border border-stone-200 focus:bg-white focus:border-rose-500 focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={handleConfirmFinal}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Xác nhận địa chỉ giao hàng này</span>
          </button>
        </div>
      </div>
    );
  }

  // ── 4. CONFIRMED STATE ─────────────────────────────────────────────────────
  return (
    <div className="mt-3 w-full bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-1.5">
      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs sm:text-sm">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Đã xác nhận địa chỉ giao hàng thành công!</span>
      </div>
      <p className="text-xs text-emerald-900 break-words leading-relaxed pl-6">
        <b>{recipientName || 'Người nhận'}</b> ({phone}) • {fullDisplayAddress}
      </p>
    </div>
  );
}

