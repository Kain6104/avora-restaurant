'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

interface DateRangeFilterProps {
  fromDate: string;
  toDate: string;
  onChange: (from: string, to: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

type PresetType = 'today' | '7days' | '30days' | '90days' | 'custom';

export default function DateRangeFilter({
  fromDate,
  toDate,
  onChange,
  className = '',
  size = 'md',
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetType>('30days');
  const [tempFrom, setTempFrom] = useState(fromDate);
  const [tempTo, setTempTo] = useState(toDate);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempFrom(fromDate);
    setTempTo(toDate);
  }, [fromDate, toDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    if (d && m && y) return `${d}/${m}/${y}`;
    return dateStr;
  };

  const applyPreset = (preset: PresetType) => {
    setActivePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      onChange(todayStr, todayStr);
      setIsOpen(false);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      onChange(past.toISOString().split('T')[0], todayStr);
      setIsOpen(false);
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      onChange(past.toISOString().split('T')[0], todayStr);
      setIsOpen(false);
    } else if (preset === '90days') {
      const past = new Date();
      past.setDate(past.getDate() - 90);
      onChange(past.toISOString().split('T')[0], todayStr);
      setIsOpen(false);
    }
  };

  const handleApplyCustom = () => {
    if (tempFrom && tempTo) {
      setActivePreset('custom');
      onChange(tempFrom, tempTo);
      setIsOpen(false);
    }
  };

  const sizeClasses = size === 'sm' ? 'h-8 text-xs px-2.5' : 'h-9 sm:h-10 text-xs sm:text-sm px-3';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-200/80 shadow-sm focus:ring-2 focus:ring-red-500/20 outline-none transition-colors ${sizeClasses}`}
      >
        <Calendar size={15} className="text-slate-400 shrink-0" strokeWidth={2} />
        <span className="truncate">
          {fromDate && toDate
            ? `${formatDateLabel(fromDate)} - ${formatDateLabel(toDate)}`
            : 'Chọn thời gian'}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50 animate-in fade-in duration-150">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Khoảng thời gian
          </p>

          <div className="space-y-1 mb-3">
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: '7days', label: '7 ngày qua' },
              { id: '30days', label: '30 ngày qua' },
              { id: '90days', label: '90 ngày qua' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as PresetType)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activePreset === p.id
                    ? 'bg-red-50 text-red-600 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{p.label}</span>
                {activePreset === p.id && <Check size={14} className="text-red-600" />}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700 px-1">Tùy chỉnh ngày</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-1">Từ ngày</label>
                <input
                  type="date"
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value)}
                  className="w-full h-8 text-xs px-2 rounded-lg border border-slate-200 outline-none focus:border-red-500 font-medium text-slate-700"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-1">Đến ngày</label>
                <input
                  type="date"
                  value={tempTo}
                  onChange={(e) => setTempTo(e.target.value)}
                  className="w-full h-8 text-xs px-2 rounded-lg border border-slate-200 outline-none focus:border-red-500 font-medium text-slate-700"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="w-full mt-2 h-8 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
