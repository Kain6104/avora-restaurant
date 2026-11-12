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
  isDarkMode?: boolean;
}

export const TableMap: React.FC<TableMapProps> = ({
  tables,
  areas,
  onSelectTable,
  onRefresh,
  isLoading = false,
  isDarkMode = false,
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

  // Real-time serving duration
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
    <div className={`flex-1 flex flex-row overflow-hidden select-none transition-colors ${
      isDarkMode ? 'bg-[#29384d]' : 'bg-slate-100/70'
    }`}>
      {/* 1. Main Left Area: Toolbar + Table Cards Grid */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header Toolbar */}
        <div className={`border-b px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-2xs transition-colors ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm bàn theo tên, số bàn, mã bàn..."
              className={`w-full text-xs rounded-lg pl-9 pr-3 py-1.5 outline-none transition-colors border ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-[#da251d]'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-[#da251d] focus:bg-white'
              }`}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium hidden sm:inline ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
              Hiển thị <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{filteredTables.length}</strong>/{totalTables} bàn
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
              title="Làm mới sơ đồ bàn"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#da251d]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dense Compact Table Cards Grid */}
        <div
          ref={gridContainerRef}
          className={`flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 pb-8">
            {filteredTables.map((table) => {
              const isOccupied = table.visualStatus === 'OCCUPIED';
              const isBillPrinted = table.visualStatus === 'BILL_PRINTED';
              const isReserved = table.visualStatus === 'RESERVED';
              const isAwaitingConfirmation = table.currentOrder?.paymentStatus === 'AWAITING_PAYMENT';
              const displayNum = getTableDisplayNum(table.name, table.tableCode);
              const servingTime = getServingDuration(table);

              return (
                <div
                  key={table.id}
                  onClick={() => onSelectTable(table)}
                  className={`relative rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between p-3 select-none active:scale-[0.98] min-h-[120px] ${
                    isDarkMode ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-200'
                  } ${
                    isAwaitingConfirmation
                      ? 'border-blue-500 ring-2 ring-blue-500 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/40 dark:to-slate-800 shadow-md'
                      : isOccupied
                      ? isDarkMode
                        ? 'border-red-500/60 bg-gradient-to-b from-slate-800 to-red-950/30 ring-1 ring-red-500/20 shadow-xs hover:border-[#da251d]'
                        : 'border-red-300 bg-gradient-to-b from-white to-red-50/40 ring-1 ring-red-400/20 shadow-xs hover:shadow-md hover:border-[#da251d]'
                      : isBillPrinted
                      ? isDarkMode
                        ? 'border-amber-500/60 bg-gradient-to-b from-slate-800 to-amber-950/30 ring-1 ring-amber-500/20 shadow-xs hover:border-amber-500'
                        : 'border-amber-300 bg-gradient-to-b from-white to-amber-50/40 ring-1 ring-amber-400/20 shadow-xs hover:shadow-md hover:border-amber-500'
                      : isReserved
                      ? isDarkMode
                        ? 'border-sky-500/60 bg-gradient-to-b from-slate-800 to-sky-950/30 ring-1 ring-sky-500/20 shadow-xs hover:border-sky-500'
                        : 'border-sky-300 bg-gradient-to-b from-white to-sky-50/40 ring-1 ring-sky-400/20 shadow-xs hover:shadow-md hover:border-sky-500'
                      : isDarkMode
                      ? 'border-slate-700 hover:border-slate-500 shadow-xs hover:shadow-md'
                      : 'border-slate-200 hover:border-[#da251d] shadow-xs hover:shadow-md'
                  }`}
                  title={`${table.name} (${table.areaName}) - ${table.capacity} chỗ ngồi`}
                >
                  {/* Card Top: Table Code / Name & Status Badge */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className={`text-sm sm:text-base font-black tracking-tight leading-none truncate ${
                        isAwaitingConfirmation ? 'text-blue-600 dark:text-blue-400' : isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}>
                        {displayNum}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium truncate mt-1">
                        {table.areaName || 'Khu vực'}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isAwaitingConfirmation ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/60 dark:text-blue-300 dark:border-blue-700 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                          Chờ XN NH
                        </span>
                      ) : isOccupied ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 dark:border dark:border-red-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                          Có khách
                        </span>
                      ) : isBillPrinted ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 dark:border dark:border-amber-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          Chờ TT
                        </span>
                      ) : isReserved ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 dark:border dark:border-sky-800/60">
                          Đã đặt
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isDarkMode ? 'bg-slate-700/80 text-slate-300' : 'bg-slate-100 text-slate-500'
                        }`}>
                          Trống
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom: Financial Total or Capacity + Serving Time */}
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-end justify-between gap-2">
                    {isOccupied && table.currentOrder ? (
                      <>
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-400 font-medium leading-none">Tổng tiền</div>
                          <div className="text-sm sm:text-base font-extrabold text-[#da251d] tracking-tight leading-tight mt-0.5 truncate font-mono">
                            {table.currentOrder.totalAmount.toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                        {servingTime && (
                          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-black bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            <Clock className="w-3 h-3 text-black" />
                            <span>{servingTime}</span>
                          </div>
                        )}
                      </>
                    ) : isOccupied ? (
                      <>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-[#da251d]">Đang phục vụ</span>
                        </div>
                        {servingTime && (
                          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-black bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            <Clock className="w-3 h-3 text-black" />
                            <span>{servingTime}</span>
                          </div>
                        )}
                      </>
                    ) : isBillPrinted && table.currentOrder ? (
                      <>
                        <div className="min-w-0">
                          <div className="text-[10px] text-amber-600 font-medium leading-none">Chờ thanh toán</div>
                          <div className="text-sm sm:text-base font-extrabold text-amber-600 tracking-tight leading-tight mt-0.5 truncate font-mono">
                            {table.currentOrder.totalAmount.toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                        {servingTime && (
                          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-black bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 shrink-0">
                            <Clock className="w-3 h-3 text-black" />
                            <span>{servingTime}</span>
                          </div>
                        )}
                      </>
                    ) : isBillPrinted ? (
                      <>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-amber-600">Đã in tạm tính</span>
                        </div>
                        {servingTime && (
                          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-black bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 shrink-0">
                            <Clock className="w-3 h-3 text-black" />
                            <span>{servingTime}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{table.capacity || 4} chỗ</span>
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          Sẵn sàng
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Compact Right Column (Area & Status Sidebar) */}
      <aside className={`w-72 sm:w-80 md:w-88 shrink-0 flex flex-col justify-between border-l p-3.5 sm:p-4 select-none transition-colors ${
        isDarkMode
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
      }`}>
        <div className="space-y-3">
          {/* 1. Blue Button: Tất cả bàn */}
          <button
            type="button"
            onClick={() => {
              setSelectedAreaId('ALL');
              setStatusFilter('ALL');
            }}
            className={`w-full py-3 sm:py-3.5 px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-between transition-all cursor-pointer shadow-xs ${
              selectedAreaId === 'ALL' && statusFilter === 'ALL'
                ? 'bg-[#2563eb] text-white ring-1 ring-blue-300 shadow-sm'
                : isDarkMode
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-2xs'
            }`}
          >
            <span>Tất cả bàn</span>
            <span className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-full ${
              selectedAreaId === 'ALL' && statusFilter === 'ALL'
                ? 'bg-white/20 text-white'
                : isDarkMode
                ? 'bg-slate-700 text-slate-200'
                : 'bg-slate-200 text-slate-800'
            }`}>
              {totalTables}
            </span>
          </button>

          {/* 2. Two-Column Status Row: Bàn trống | Có khách */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'VACANT' ? 'ALL' : 'VACANT')}
              className={`p-3 rounded-xl text-center flex flex-col items-center justify-center relative transition-all cursor-pointer border min-h-[64px] sm:min-h-[68px] ${
                statusFilter === 'VACANT'
                  ? 'border-emerald-500 bg-emerald-600 text-white font-black shadow-sm ring-1 ring-emerald-400'
                  : isDarkMode
                  ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 shadow-2xs'
              }`}
            >
              <span className={`text-xs absolute top-1.5 right-2 font-mono font-black ${
                statusFilter === 'VACANT' ? 'text-white' : isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
              }`}>
                {vacantCount}
              </span>
              <span className="text-xs sm:text-[13px] font-bold leading-tight mt-2">Bàn trống</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'OCCUPIED' ? 'ALL' : 'OCCUPIED')}
              className={`p-3 rounded-xl text-center flex flex-col items-center justify-center relative transition-all cursor-pointer border min-h-[64px] sm:min-h-[68px] ${
                statusFilter === 'OCCUPIED'
                  ? 'border-red-500 bg-[#da251d] text-white font-black shadow-sm ring-1 ring-red-400'
                  : isDarkMode
                  ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  : 'border-red-200 bg-white text-red-800 hover:bg-red-50 shadow-2xs'
              }`}
            >
              <span className={`text-xs absolute top-1.5 right-2 font-mono font-black ${
                statusFilter === 'OCCUPIED' ? 'text-white' : isDarkMode ? 'text-red-400' : 'text-red-600'
              }`}>
                {occupiedCount}
              </span>
              <span className="text-xs sm:text-[13px] font-bold leading-tight mt-2">Có khách</span>
            </button>
          </div>

          {/* 3. Secondary Status Filters (Chờ thanh toán, Đặt trước) */}
          {(billPrintedCount > 0 || reservedCount > 0) && (
            <div className="grid grid-cols-2 gap-2.5">
              {billPrintedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'BILL_PRINTED' ? 'ALL' : 'BILL_PRINTED')}
                  className={`p-3 rounded-xl text-center flex flex-col items-center justify-center relative transition-all cursor-pointer border min-h-[64px] sm:min-h-[68px] ${
                    statusFilter === 'BILL_PRINTED'
                      ? 'border-amber-400 bg-amber-500 text-white font-black shadow-sm'
                      : isDarkMode
                      ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                      : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50 shadow-2xs'
                  }`}
                >
                  <span className={`text-xs absolute top-1.5 right-2 font-mono font-black ${
                    statusFilter === 'BILL_PRINTED' ? 'text-white' : isDarkMode ? 'text-amber-400' : 'text-amber-600'
                  }`}>
                    {billPrintedCount}
                  </span>
                  <span className="text-xs sm:text-[13px] font-bold mt-2">Chờ TT</span>
                </button>
              )}
              {reservedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'RESERVED' ? 'ALL' : 'RESERVED')}
                  className={`p-3 rounded-xl text-center flex flex-col items-center justify-center relative transition-all cursor-pointer border min-h-[64px] sm:min-h-[68px] ${
                    statusFilter === 'RESERVED'
                      ? 'border-sky-500 bg-sky-600 text-white font-black shadow-sm'
                      : isDarkMode
                      ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                      : 'border-sky-200 bg-white text-sky-800 hover:bg-sky-50 shadow-2xs'
                  }`}
                >
                  <span className={`text-xs absolute top-1.5 right-2 font-mono font-black ${
                    statusFilter === 'RESERVED' ? 'text-white' : isDarkMode ? 'text-sky-400' : 'text-sky-600'
                  }`}>
                    {reservedCount}
                  </span>
                  <span className="text-xs sm:text-[13px] font-bold mt-2">Đã đặt</span>
                </button>
              )}
            </div>
          )}

          {/* 4. Area List Column */}
          <div className={`pt-2 border-t space-y-1.5 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className={`text-[11px] font-black uppercase tracking-wider mb-1.5 px-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Khu vực bàn
            </div>
            <button
              type="button"
              onClick={() => setSelectedAreaId('ALL')}
              className={`w-full p-3 rounded-xl flex items-center justify-between text-xs sm:text-sm font-black transition-all cursor-pointer border ${
                selectedAreaId === 'ALL'
                  ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                  : isDarkMode
                  ? 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className={`w-4 h-4 shrink-0 ${selectedAreaId === 'ALL' ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">Tất cả khu vực</span>
              </div>
              <span className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-black ${
                selectedAreaId === 'ALL' ? 'bg-white/20 text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-600'
              }`}>{totalTables}</span>
            </button>

            {areas.map((area) => {
              const areaTables = tables.filter((t) => t.areaId === area.id);
              const occupiedInArea = areaTables.filter(
                (t) => t.visualStatus === 'OCCUPIED' || t.visualStatus === 'BILL_PRINTED',
              ).length;
              const isSelected = selectedAreaId === area.id;

              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`w-full p-3 rounded-xl flex items-center justify-between text-xs sm:text-sm font-black transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                      : isDarkMode
                      ? 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{area.name}</span>
                  </div>
                  <span className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-black ${
                    isSelected ? 'bg-white/20 text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {occupiedInArea}/{areaTables.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Bottom Navigation Controls: Up / Down arrows */}
        <div className={`grid grid-cols-2 gap-2.5 pt-2.5 border-t shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={() => scrollGrid(-240)}
            className={`py-3.5 flex items-center justify-center rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs'
            }`}
            title="Cuộn lên trên"
          >
            <ChevronUp className="w-5 h-5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => scrollGrid(240)}
            className={`py-3.5 flex items-center justify-center rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs'
            }`}
            title="Cuộn xuống dưới"
          >
            <ChevronDown className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </aside>
    </div>
  );
};
