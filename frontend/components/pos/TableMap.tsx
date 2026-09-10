"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Search,
  Clock,
  RotateCcw,
  MapPin,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { PosTable, PosArea } from './pos-types';

interface TableMapProps {
  tables: PosTable[];
  areas: PosArea[];
  onSelectTable: (table: PosTable) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const TableMap: React.FC<TableMapProps> = ({
  tables,
  areas,
  onSelectTable,
  onRefresh,
  isLoading = false,
}) => {
  const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Real-time tick every second for serving timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtering
  const filteredTables = tables.filter((t) => {
    if (selectedAreaId !== 'ALL' && t.areaId !== selectedAreaId) return false;
    if (statusFilter !== 'ALL' && t.visualStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.tableCode.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.areaName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Summary counts
  const totalTables = tables.length;
  const vacantCount = tables.filter((t) => t.visualStatus === 'VACANT').length;
  const occupiedCount = tables.filter((t) => t.visualStatus === 'OCCUPIED').length;
  const billPrintedCount = tables.filter((t) => t.visualStatus === 'BILL_PRINTED').length;
  const reservedCount = tables.filter((t) => t.visualStatus === 'RESERVED').length;

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const scrollGrid = (offset: number) => {
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollBy({ top: offset, behavior: 'smooth' });
    }
  };

  // Helper to extract clean table display number
  const getTableDisplayNum = (name: string, code: string) => {
    const cleaned = name.replace(/^bàn\s*/i, '').trim();
    return cleaned || code || name;
  };

  // Helper to get formatted serving time: KHÔNG hiển thị thời gian vào, CHỈ hiển thị thời gian phục vụ đếm real-time (ví dụ: 00:59:23)
  const getServingDuration = (table: PosTable) => {
    const timeStr = table.activeSession?.openedAt || table.currentOrder?.createdAt;
    if (!timeStr) return null;
    const start = new Date(timeStr).getTime();
    if (isNaN(start)) return null;

    const diffSec = Math.max(0, Math.floor((currentTime - start) / 1000));
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;

    const pad = (n: number) => String(n).padStart(2, '0');

    if (days > 0) {
      return `${days} ngày`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden select-none">
      {/* 1. Horizontal Combined Area & Status Bar (Thanh nằm ngang chung khu vực + trạng thái) */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shrink-0 shadow-2xs">
        {/* Left: Khu vực & Trạng thái bàn */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          {/* Khu vực Tabs */}
          <div className="flex items-center gap-1 shrink-0 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setSelectedAreaId('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                selectedAreaId === 'ALL'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3 h-3 shrink-0" />
              <span>Bàn ({totalTables})</span>
            </button>

            {areas.map((area) => {
              const count = tables.filter((t) => t.areaId === area.id).length;
              const isSelected = selectedAreaId === area.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-[#da251d] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
                  }`}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>{area.name}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Vertical Divider Line */}
          <div className="h-6 w-[1px] bg-slate-200 shrink-0 mx-1 hidden sm:block" />

          {/* Status Quick Filters */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tất cả ({totalTables})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('VACANT')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'VACANT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70'
              }`}
            >
              Bàn trống ({vacantCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('OCCUPIED')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'OCCUPIED'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : 'bg-red-50 text-[#da251d] hover:bg-red-100 border border-red-200/70'
              }`}
            >
              Có khách ({occupiedCount})
            </button>
            {billPrintedCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('BILL_PRINTED')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'BILL_PRINTED'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/70'
                }`}
              >
                Chờ TT ({billPrintedCount})
              </button>
            )}
            {reservedCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('RESERVED')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'RESERVED'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/70'
                }`}
              >
                Đặt trước ({reservedCount})
              </button>
            )}
          </div>
        </div>

        {/* Right: Search & Quick Scroll & Refresh Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-40 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm bàn..."
              className="w-full text-xs bg-slate-100 text-slate-800 placeholder:text-slate-400 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 outline-none focus:border-[#da251d] focus:bg-white h-8 transition-colors"
            />
          </div>

          {/* Quick Scroll Up/Down buttons */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            <button
              type="button"
              onClick={() => scrollGrid(-220)}
              className="w-7 h-7 flex items-center justify-center hover:bg-white text-slate-600 rounded-md transition-colors cursor-pointer"
              title="Cuộn lên"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollGrid(220)}
              className="w-7 h-7 flex items-center justify-center hover:bg-white text-slate-600 rounded-md transition-colors cursor-pointer"
              title="Cuộn xuống"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title="Làm mới sơ đồ bàn"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#da251d]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Full-Width Dense Compact Table Cards Grid (100% diện tích chiều ngang) */}
      <div
        ref={gridContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 bg-slate-50"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2.5 pb-8">
          {filteredTables.map((table) => {
            const isOccupied = table.visualStatus === 'OCCUPIED';
            const isBillPrinted = table.visualStatus === 'BILL_PRINTED';
            const isReserved = table.visualStatus === 'RESERVED';
            const displayNum = getTableDisplayNum(table.name, table.tableCode);
            const servingTime = getServingDuration(table);

            return (
              <div
                key={table.id}
                onClick={() => onSelectTable(table)}
                className={`relative rounded-xl border transition-all duration-100 cursor-pointer flex flex-col items-center justify-center text-center select-none active:scale-95 shadow-xs min-h-[82px] sm:min-h-[88px] p-2 ${
                  isOccupied
                    ? 'bg-red-50/20 border-[#da251d] ring-2 ring-[#da251d]/30 hover:shadow-md'
                    : isBillPrinted
                    ? 'bg-amber-50/20 border-amber-400 ring-2 ring-amber-400/30 hover:shadow-md'
                    : isReserved
                    ? 'bg-sky-50/20 border-sky-400 ring-2 ring-sky-400/30 hover:shadow-md'
                    : 'bg-white border-slate-200 hover:border-[#da251d] hover:shadow-md'
                }`}
                title={`${table.name} (${table.areaName}) - ${table.capacity} khách`}
              >
                {/* Table Number: Thu nhỏ 1 xíu (text-xs sm:text-sm font-bold thay cho text-base sm:text-lg) */}
                <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight leading-none truncate max-w-full px-1">
                  {displayNum}
                </span>

                {/* Horizontal Divider Line */}
                <div className="w-10/12 h-[1px] bg-slate-200 my-1.5" />

                {/* Subtitle / Status / Serving Time (Đếm realtime, không hiển thị giờ vào) */}
                <div className="text-[11px] leading-tight truncate max-w-full px-1">
                  {isOccupied && table.currentOrder ? (
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-[#da251d]">
                        {table.currentOrder.totalAmount.toLocaleString('vi-VN')}đ
                      </div>
                      {servingTime && (
                        <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{servingTime}</span>
                        </div>
                      )}
                    </div>
                  ) : isOccupied ? (
                    <div className="space-y-0.5">
                      <span className="font-bold text-[#da251d]">Có khách</span>
                      {servingTime && (
                        <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{servingTime}</span>
                        </div>
                      )}
                    </div>
                  ) : isBillPrinted && table.currentOrder ? (
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-amber-600">
                        {table.currentOrder.totalAmount.toLocaleString('vi-VN')}đ
                      </div>
                      {servingTime && (
                        <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{servingTime}</span>
                        </div>
                      )}
                    </div>
                  ) : isBillPrinted ? (
                    <span className="font-bold text-amber-600">Chờ TT</span>
                  ) : isReserved ? (
                    <span className="font-bold text-blue-600">Đã đặt</span>
                  ) : (
                    <span className="font-medium text-slate-400">Bàn trống</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
