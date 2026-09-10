'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  LocateFixed,
  MapPin,
  User,
  Phone,
  Building,
  Home,
  Briefcase,
  Navigation,
  Search,
  Check,
  Sparkles,
  Loader2,
  Compass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

export interface Address {
  id: string;
  recipientName: string;
  phone: string;
  province: string;
  ward: string;
  streetDetail: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface AddressModalProps {
  address?: Address | null;
  onClose: () => void;
  onSuccess: () => void;
}

type AddressTag = 'home' | 'work' | 'other';

// Helper to clean streetDetail and strip "Vị trí hiện tại"
function cleanStreetDetailValue(val?: string | null): string {
  if (!val) return '';
  const cleaned = val.replace(/^\[(Nhà riêng|Văn phòng|Khác)\]\s*/i, '').trim();
  if (cleaned.toLowerCase() === 'vị trí hiện tại' || cleaned.toLowerCase().startsWith('vị trí hiện tại')) {
    return '';
  }
  return cleaned;
}

// Helper to format Vietnamese Ward (e.g. "An Nhơn" -> "Phường An Nhơn", no duplicates)
function cleanVietnameseWard(rawWard?: string, rawDistrict?: string, isCommune?: boolean): string {
  let w = (rawWard || '').trim();
  const d = (rawDistrict || '').trim();

  if (!w && d) w = d;
  if (!w) return '';

  // Remove duplicate parts e.g. "An Nhơn, An Nhơn" -> "An Nhơn"
  const parts = w.split(',').map(s => s.trim()).filter(Boolean);
  const uniqueParts: string[] = [];
  for (const part of parts) {
    const cleanPart = part.replace(/^(phường|xã|thị trấn|p\.|x\.|tt\.)\s+/i, '').trim();
    if (!uniqueParts.some(u => u.toLowerCase() === cleanPart.toLowerCase() || u.toLowerCase() === part.toLowerCase())) {
      uniqueParts.push(part);
    }
  }
  w = uniqueParts[0] || w;

  const lower = w.toLowerCase();
  if (lower.startsWith('phường ') || lower.startsWith('xã ') || lower.startsWith('thị trấn ')) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  if (lower.startsWith('p. ') || lower.startsWith('p.')) {
    return 'Phường ' + w.replace(/^p\.?\s*/i, '');
  }
  if (lower.startsWith('x. ') || lower.startsWith('x.')) {
    return 'Xã ' + w.replace(/^x\.?\s*/i, '');
  }
  if (lower.startsWith('tt. ') || lower.startsWith('tt.')) {
    return 'Thị trấn ' + w.replace(/^tt\.?\s*/i, '');
  }

  // If number e.g. "1", "12"
  if (/^\d+$/.test(w.trim())) {
    return `Phường ${w.trim()}`;
  }

  if (isCommune || lower.includes('xã')) {
    return `Xã ${w.replace(/^xã\s+/i, '')}`;
  }

  return `Phường ${w}`;
}

export default function AddressModal({ address, onClose, onSuccess }: AddressModalProps) {
  // Infer initial tag from streetDetail or default to 'home'
  const inferInitialTag = (): AddressTag => {
    if (!address?.streetDetail) return 'home';
    const lower = address.streetDetail.toLowerCase();
    if (lower.startsWith('[văn phòng]') || lower.startsWith('[công ty]') || lower.includes('văn phòng') || lower.includes('công ty')) {
      return 'work';
    }
    if (lower.startsWith('[nhà riêng]') || lower.startsWith('[nhà]')) {
      return 'home';
    }
    return 'other';
  };

  const [tag, setTag] = useState<AddressTag>(inferInitialTag());
  const [formData, setFormData] = useState({
    recipientName: address?.recipientName || '',
    phone: address?.phone || '',
    province: address?.province || '',
    ward: address?.ward ? cleanVietnameseWard(address.ward) : '',
    streetDetail: cleanStreetDetailValue(address?.streetDetail),
    isDefault: address ? address.isDefault : false,
    latitude: address?.latitude || 10.762622,
    longitude: address?.longitude || 106.660172,
  });

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  
  // Search place on map
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-fill recipient name & phone from current user if creating new address
  useEffect(() => {
    if (!address) {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const u = JSON.parse(userStr);
          setFormData(prev => ({
            ...prev,
            recipientName: prev.recipientName || u.fullName || u.name || '',
            phone: prev.phone || u.phone || '',
          }));
        }
      } catch (e) {}
    }
  }, [address]);

  // Handle location search via OpenStreetMap Nominatim
  const handleSearchPlace = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query.trim()
          )}&countrycodes=vn&limit=5&accept-language=vi`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data || []);
          setShowSearchResults(true);
        }
      } catch (err) {
        console.error('Search place error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 450);
  };

  const handleSelectSearchResult = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setShowSearchResults(false);
    setSearchQuery(result.display_name.split(',')[0] || '');
    autoFillAddressFromCoords(lat, lng);
  };

  const autoFillAddressFromCoords = async (latitude: number, longitude: number, toastId?: string) => {
    setFormData(prev => ({ ...prev, latitude, longitude }));

    // 1. Try BigDataCloud Reverse Geocoding
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`
      );
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        const province = bdcData.principalSubdivision || bdcData.countryName || '';
        let ward = '';
        let isCommune = false;
        let streetDetail = '';

        if (Array.isArray(bdcData.localityInfo?.administrative)) {
          const adminList = bdcData.localityInfo.administrative;

          const wardObj = adminList.find((a: any) =>
            a.adminLevel === 8 ||
            a.description?.toLowerCase().includes('phường') ||
            a.description?.toLowerCase().includes('xã') ||
            a.description?.toLowerCase().includes('thị trấn') ||
            a.name?.toLowerCase().startsWith('phường') ||
            a.name?.toLowerCase().startsWith('xã')
          );
          if (wardObj) {
            ward = wardObj.name;
            isCommune = wardObj.description?.toLowerCase().includes('xã') || wardObj.name?.toLowerCase().startsWith('xã');
          }

          const streetObj = adminList.find((a: any) =>
            a.adminLevel >= 9 ||
            a.description?.toLowerCase().includes('đường') ||
            a.name?.toLowerCase().startsWith('đường')
          );
          if (streetObj) streetDetail = streetObj.name;
        }

        if (!streetDetail && bdcData.localityInfo?.informative) {
          const streetObj = bdcData.localityInfo.informative.find((a: any) =>
            a.description?.toLowerCase().includes('đường') ||
            a.name?.toLowerCase().startsWith('đường')
          );
          if (streetObj) streetDetail = streetObj.name;
        }

        const finalWard = cleanVietnameseWard(ward || bdcData.locality, undefined, isCommune);
        const cleanStreet = cleanStreetDetailValue(streetDetail);

        if (province || finalWard) {
          setFormData(prev => ({
            ...prev,
            province: province || prev.province,
            ward: finalWard || prev.ward,
            streetDetail: cleanStreet || cleanStreetDetailValue(prev.streetDetail),
          }));
          if (toastId) toast.success('Đã xác định vị trí thành công!', { id: toastId });
          return;
        }
      }
    } catch (e) {}

    // 2. Try OpenStreetMap Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=vi&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const province = addr.province || addr.city || addr.state || '';
        const rawWard = addr.ward || addr.quarter || addr.suburb || addr.neighbourhood || addr.village || '';
        const isCommune = !!(addr.village || (rawWard && rawWard.toLowerCase().includes('xã')));
        const finalWard = cleanVietnameseWard(rawWard, addr.district, isCommune);

        const road = addr.road || '';
        const houseNumber = addr.house_number || '';
        const amenity = addr.amenity || addr.building || addr.shop || addr.office || '';

        let streetDetail = [houseNumber, road].filter(Boolean).join(' ') || amenity || '';
        streetDetail = cleanStreetDetailValue(streetDetail);

        setFormData(prev => ({
          ...prev,
          province: province || prev.province,
          ward: finalWard || prev.ward,
          streetDetail: streetDetail || cleanStreetDetailValue(prev.streetDetail),
        }));
        if (toastId) toast.success('Đã xác định vị trí thành công!', { id: toastId });
        return;
      }
    } catch (e) {}

    if (toastId) toast.success('Đã cập nhật tọa độ trên bản đồ', { id: toastId });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMapChange = (lat: number, lng: number) => {
    autoFillAddressFromCoords(lat, lng);
  };

  const handleToggleDefault = () => {
    setFormData(prev => ({ ...prev, isDefault: !prev.isDefault }));
  };

  // Quick fill user profile info
  const handleFillFromProfile = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.fullName || u.phone) {
          setFormData(prev => ({
            ...prev,
            recipientName: u.fullName || u.name || prev.recipientName,
            phone: u.phone || prev.phone,
          }));
          toast.success('Đã điền thông tin người nhận từ tài khoản');
          return;
        }
      }
      toast('Chưa tìm thấy thông tin tài khoản đã lưu', { icon: 'ℹ️' });
    } catch (e) {}
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt của bạn không hỗ trợ định vị GPS');
      return;
    }

    setLocating(true);
    const toastId = toast.loading('Đang lấy vị trí GPS hiện tại...');

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setLocating(false);
        autoFillAddressFromCoords(latitude, longitude, toastId);
      },
      error => {
        setLocating(false);
        toast.error('Không thể lấy vị trí. Vui lòng cấp quyền truy cập vị trí.', { id: toastId });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number
    const cleanPhone = formData.phone.replace(/\s+/g, '');
    if (!/(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(cleanPhone) && cleanPhone.length !== 10) {
      toast.error('Số điện thoại không hợp lệ (cần 10 chữ số)');
      return;
    }

    let finalStreetDetail = cleanStreetDetailValue(formData.streetDetail);
    if (!finalStreetDetail) {
      toast.error('Vui lòng nhập địa chỉ chi tiết (số nhà, tên đường)');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading(address ? 'Đang cập nhật địa chỉ...' : 'Đang lưu địa chỉ mới...');

    try {
      const url = address ? `/api/addresses/${address.id}` : '/api/addresses';
      const method = address ? 'PUT' : 'POST';

      // Prepend tag to street detail if not already included
      const tagPrefix = tag === 'home' ? '[Nhà riêng]' : tag === 'work' ? '[Văn phòng]' : '[Khác]';
      if (!finalStreetDetail.startsWith('[') && tag !== 'other') {
        finalStreetDetail = `${tagPrefix} ${finalStreetDetail}`;
      }

      const payload = {
        recipientName: formData.recipientName.trim(),
        phone: cleanPhone,
        province: formData.province.trim(),
        ward: cleanVietnameseWard(formData.ward),
        streetDetail: finalStreetDetail,
        isDefault: formData.isDefault,
        latitude: formData.latitude,
        longitude: formData.longitude,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(address ? 'Cập nhật địa chỉ thành công! ✨' : 'Thêm địa chỉ thành công! 🎉', {
          id: loadingToast,
        });
        onSuccess();
        onClose();
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Không thể lưu địa chỉ');
      }
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra, vui lòng thử lại', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog / Mobile Bottom Sheet */}
      <div
        className="relative w-full max-w-xl bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] sm:max-h-[88vh] z-10 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-full flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 sm:px-5 py-3.5 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <MapPin size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                {address ? 'Cập Nhật Địa Chỉ' : 'Thêm Địa Chỉ Nhận Hàng'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors active:scale-95"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-5 space-y-4 flex-1">
            {/* 1. Address Category Tags & Quick Profile Fill */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/70">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTag('home')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    tag === 'home'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Home size={13} /> Nhà riêng
                </button>

                <button
                  type="button"
                  onClick={() => setTag('work')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    tag === 'work'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Briefcase size={13} /> Văn phòng
                </button>

                <button
                  type="button"
                  onClick={() => setTag('other')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    tag === 'other'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <MapPin size={13} /> Khác
                </button>
              </div>

              {/* Quick Fill Button */}
              <button
                type="button"
                onClick={handleFillFromProfile}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors shrink-0 active:scale-95"
                title="Lấy tên và số điện thoại từ tài khoản"
              >
                <Sparkles size={12} />
                <span className="hidden sm:inline">Điền từ</span> tài khoản
              </button>
            </div>

            {/* 2. Recipient Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên người nhận <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User size={15} />
                  </div>
                  <input
                    required
                    name="recipientName"
                    value={formData.recipientName}
                    onChange={handleInputChange}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone size={15} />
                  </div>
                  <input
                    required
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="VD: 0901234567"
                  />
                </div>
              </div>
            </div>

            {/* 3. Administrative Region (Province / Ward) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tỉnh / Thành phố <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building size={15} />
                  </div>
                  <input
                    required
                    name="province"
                    value={formData.province}
                    onChange={handleInputChange}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="VD: Thành phố Hồ Chí Minh"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phường / Xã <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Navigation size={15} />
                  </div>
                  <input
                    required
                    name="ward"
                    value={formData.ward}
                    onChange={handleInputChange}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="VD: Phường Bến Nghé"
                  />
                </div>
              </div>
            </div>

            {/* 4. Detailed House Number / Street */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Địa chỉ chi tiết (Số nhà, tên đường...) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <MapPin size={15} />
                </div>
                <input
                  required
                  name="streetDetail"
                  value={formData.streetDetail}
                  onChange={handleInputChange}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                  placeholder="Vui lòng nhập số nhà, tên đường..."
                />
              </div>
            </div>

            {/* 5. Map & GPS Section */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Compass size={14} className="text-red-600" />
                  Ghim vị trí trên bản đồ
                </label>

                {/* GPS Trigger Button */}
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={locating}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  <LocateFixed size={13} className={locating ? 'animate-spin' : ''} />
                  <span>{locating ? 'Đang định vị...' : 'Lấy vị trí GPS'}</span>
                </button>
              </div>

              {/* Place search box for Map */}
              <div className="relative">
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    {isSearching ? <Loader2 size={13} className="animate-spin text-red-600" /> : <Search size={13} />}
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchPlace(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowSearchResults(true);
                    }}
                    placeholder="Tìm địa danh, tòa nhà trên bản đồ..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Search Auto-complete Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-[1100] max-h-40 overflow-y-auto custom-scrollbar">
                    {searchResults.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSearchResult(item)}
                        className="w-full text-left px-3 py-1.5 hover:bg-red-50 flex items-start gap-2 text-[11px] text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <MapPin size={12} className="text-red-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{item.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Leaflet Map Frame */}
              <div className="h-[180px] sm:h-[200px] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative">
                <MapPicker
                  position={{ lat: formData.latitude, lng: formData.longitude }}
                  onChange={handleMapChange}
                />
              </div>
            </div>

            {/* 6. Default Address Switch */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <div>
                <p className="font-bold text-slate-900 text-xs">Đặt làm địa chỉ mặc định</p>
                <p className="text-[11px] text-slate-500">Tự động chọn cho các đơn hàng tiếp theo</p>
              </div>
              <button
                type="button"
                onClick={handleToggleDefault}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  formData.isDefault ? 'bg-red-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                    formData.isDefault ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-4 sm:px-5 py-3 flex items-center justify-end gap-2.5 z-20 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 active:scale-95"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>{address ? 'Cập nhật' : 'Lưu địa chỉ'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
