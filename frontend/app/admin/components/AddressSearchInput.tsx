'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, Navigation, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';

export interface AddressSearchResult {
  lat: number;
  lon: number;
  displayName: string;
  street: string;
  ward: string;
  district: string;
  province: string;
}

interface AddressSearchInputProps {
  value?: string;
  onSelect: (result: AddressSearchResult) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressSearchInput({
  value = '',
  onSelect,
  placeholder,
  className = '',
}: AddressSearchInputProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync incoming value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search Address with Debounce via local Next.js API Route Proxy
  const searchAddress = (text: string) => {
    setQuery(text);
    setSelectedIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim() || text.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `/api/geocode?q=${encodeURIComponent(text.trim())}`;
        const res = await fetch(url);

        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
          setIsOpen(Array.isArray(data) && data.length > 0);
        }
      } catch (err) {
        console.error('Address search error:', err);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  // Parse address structure to standard Vietnam fields
  const parseAddressData = (item: any): AddressSearchResult => {
    const addr = item.address || {};

    const province =
      addr.city ||
      addr.state ||
      addr.province ||
      addr.region ||
      '';

    const district =
      addr.city_district ||
      addr.district ||
      addr.suburb ||
      addr.county ||
      addr.town ||
      '';

    const ward =
      addr.quarter ||
      addr.neighbourhood ||
      addr.ward ||
      addr.subdistrict ||
      '';

    const houseNumber = addr.house_number || '';
    const road = addr.road || addr.street || '';
    const street = [houseNumber, road].filter(Boolean).join(' ') || item.name || (item.display_name ? item.display_name.split(',')[0] : '');

    return {
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      displayName: item.display_name || street,
      street,
      ward,
      district,
      province,
    };
  };

  const handleSelect = (item: any) => {
    const parsed = parseAddressData(item);
    setQuery(parsed.displayName);
    setIsOpen(false);
    onSelect(parsed);
    toast.success(t('address.locatedSuccess', 'Đã định vị vị trí thành công!'));
  };

  // Locate Current GPS Position
  const handleGetLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ định vị GPS');
      return;
    }

    setIsLocating(true);
    toast.loading('Đang lấy tọa độ GPS của bạn...', { id: 'geo-loc' });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        try {
          // Reverse geocode via server-side API proxy
          const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);

          if (res.ok) {
            const data = await res.json();
            if (data && !data.error) {
              const parsed = parseAddressData(data);
              setQuery(parsed.displayName);
              onSelect(parsed);
              toast.success('Đã định vị vị trí hiện tại!', { id: 'geo-loc' });
              return;
            }
          }
          
          onSelect({
            lat,
            lon,
            displayName: `Tọa độ: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
            street: '',
            ward: '',
            district: '',
            province: '',
          });
          toast.success('Đã lấy tọa độ GPS thành công!', { id: 'geo-loc' });
        } catch (e) {
          onSelect({
            lat,
            lon,
            displayName: `Tọa độ: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
            street: '',
            ward: '',
            district: '',
            province: '',
          });
          toast.success('Đã lấy tọa độ GPS thành công!', { id: 'geo-loc' });
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        toast.error('Không thể truy cập GPS: ' + err.message, { id: 'geo-loc' });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative flex items-center">
        {/* Search Icon or Loading Spinner */}
        <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
          {loading ? (
            <Loader2 size={16} className="animate-spin text-red-600" />
          ) : (
            <Search size={16} />
          )}
        </div>

        {/* Input field */}
        <input
          type="text"
          value={query}
          onChange={(e) => searchAddress(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            placeholder ||
            t(
              'address.searchPlaceholder',
              'Nhập địa chỉ, tên đường, tòa nhà hoặc khu vực để tìm nhanh...'
            )
          }
          className="w-full h-10 pl-9 pr-24 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 shadow-2xs transition-all"
        />

        {/* Actions inside input: Clear & GPS Locate */}
        <div className="absolute right-1.5 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsOpen(false);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isLocating}
            title="Định vị vị trí hiện tại (GPS)"
            className="flex items-center gap-1 h-7 px-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] rounded-lg transition-colors disabled:opacity-50"
          >
            {isLocating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Navigation size={12} />
            )}
            <span className="hidden sm:inline">GPS</span>
          </button>
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 divide-y divide-slate-50">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Địa điểm gợi ý ({results.length})</span>
            <span>OpenStreetMap</span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const primaryName = item.name || (item.display_name ? item.display_name.split(',')[0] : 'Địa điểm');
              const secondaryName = item.display_name
                ? item.display_name.replace(primaryName, '').replace(/^,\s*/, '')
                : '';

              return (
                <button
                  key={item.place_id || idx}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 text-left text-xs transition-colors ${
                    isSelected ? 'bg-red-50/80 text-red-900' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="p-1.5 rounded-xl bg-red-100 text-red-600 shrink-0 mt-0.5">
                    <MapPin size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {primaryName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {secondaryName || item.display_name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 block">
                      {parseFloat(item.lat).toFixed(4)}, {parseFloat(item.lon).toFixed(4)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
