"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarCheck,
  Search,
  Users,
  Clock,
  Phone,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  UtensilsCrossed,
  Tag,
  AlertCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PosTable } from './pos-types';

export interface RealReservation {
  id: string;
  reservationCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  status: string;
  tablePreference?: string;
  specialRequests?: string;
  internalNote?: string;
  source: string;
  checkedInAt?: string;
  seatedAt?: string;
  branchName: string;
  assignedTables: Array<{ id: string; name: string; code: string }>;
}

interface ReservationPanelProps {
  branchId: string;
  tables: PosTable[];
  onSeatReservation: (reservation: RealReservation, tableId: string) => Promise<void>;
}

export const ReservationPanel: React.FC<ReservationPanelProps> = ({
  branchId,
  tables,
  onSeatReservation,
}) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [reservations, setReservations] = useState<RealReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Active Date Selection (Default today)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // Table Seating Modal
  const [seatingReservation, setSeatingReservation] = useState<RealReservation | null>(null);
  const [chosenTableId, setChosenTableId] = useState<string>('');
  const [isSeatingLoading, setIsSeatingLoading] = useState(false);

  // Fetch real reservations from API
  const fetchReservations = useCallback(async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        branchId,
        date: selectedDate,
      });
      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }
      const res = await fetch(`${baseUrl}/api/pos/reservations?${params.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setReservations(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch reservations:', e);
      toast.error('Không thể tải lịch đặt bàn');
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, branchId, selectedDate, selectedStatus]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Generate 7-day strip
  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : `Thứ ${d.getDay() === 0 ? 'CN' : d.getDay() + 1}`;
    const displayDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    return { dateStr, dayName, displayDate };
  });

  // Vacant tables suitable for party size
  const vacantTables = tables.filter((t) => t.visualStatus === 'VACANT');

  const filteredReservations = reservations.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone.includes(q) ||
        r.reservationCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Handle Seating Confirmation
  const handleConfirmSeat = async () => {
    if (!seatingReservation || !chosenTableId) {
      toast.error('Vui lòng chọn bàn để xếp chỗ');
      return;
    }
    setIsSeatingLoading(true);
    try {
      // Call check-in API
      const res = await fetch(`${baseUrl}/api/pos/reservations/${seatingReservation.id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tableId: chosenTableId }),
      });
      const json = await res.json();
      if (json.success) {
        await onSeatReservation(seatingReservation, chosenTableId);
        setSeatingReservation(null);
        setChosenTableId('');
        fetchReservations();
      } else {
        throw new Error(json.message || 'Lỗi xếp bàn');
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi xếp chỗ cho khách');
    } finally {
      setIsSeatingLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Đã xác nhận
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Chờ xác nhận
          </span>
        );
      case 'CHECKED_IN':
      case 'SEATED':
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold flex items-center gap-1">
            <UtensilsCrossed className="w-3 h-3" />
            Đang dùng bữa
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-[10px] font-bold flex items-center gap-1">
            <Check className="w-3 h-3" />
            Hoàn tất
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-[10px] font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50/60 overflow-hidden select-none text-xs">
      {/* 1. Date Strip & Controls Header */}
      <div className="bg-white border-b border-gray-200 p-3 sm:p-4 space-y-3 shrink-0 shadow-2xs">
        {/* Date Strip */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            {dateStrip.map((item) => {
              const isSelected = selectedDate === item.dateStr;
              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(item.dateStr)}
                  className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#da251d] text-white border-[#da251d] shadow-xs'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  <span className="text-[10px] opacity-80">{item.dayName}</span>
                  <span className="text-xs font-bold leading-tight">{item.displayDate}</span>
                </button>
              );
            })}
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg px-2.5 py-1.5 outline-none font-semibold cursor-pointer"
            />
            <button
              type="button"
              onClick={fetchReservations}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
              title="Làm mới lịch đặt bàn"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters & Search Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-gray-100">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {[
              { key: 'ALL', label: 'Tất cả' },
              { key: 'CONFIRMED', label: 'Đã xác nhận' },
              { key: 'PENDING', label: 'Chờ duyệt' },
              { key: 'CHECKED_IN', label: 'Đang ăn' },
              { key: 'COMPLETED', label: 'Hoàn tất' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setSelectedStatus(st.key)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedStatus === st.key
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, SĐT, mã đặt..."
              className="w-full bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#da251d] text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* 2. Reservations List View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredReservations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 py-16">
            <CalendarCheck className="w-12 h-12 stroke-[1.5] text-gray-300 mb-2" />
            <p className="text-sm font-bold text-gray-600">Không có lịch đặt bàn nào</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Chưa có khách đặt bàn trong ngày {selectedDate} hoặc theo bộ lọc hiện tại
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-8">
            {filteredReservations.map((r) => {
              const isSeatedOrDone = r.status === 'CHECKED_IN' || r.status === 'SEATED' || r.status === 'COMPLETED' || r.status === 'CANCELLED';
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    {/* Top Identity Row */}
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-sm">{r.customerName}</span>
                          <span className="px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">
                            {r.reservationCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 text-[11px] mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {r.customerPhone || 'Chưa có SĐT'}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(r.status)}
                    </div>

                    {/* Time Slot & Party Size */}
                    <div className="flex items-center gap-2 py-2 border-y border-gray-100 text-gray-700">
                      <div className="flex items-center gap-1 font-mono font-bold text-xs bg-red-50 text-[#da251d] px-2 py-1 rounded-md border border-red-200/60">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{r.reservationTime}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-xs bg-gray-100 px-2 py-1 rounded-md text-gray-800">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                        <span>{r.partySize} khách</span>
                      </div>
                      {r.tablePreference && (
                        <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
                          • {r.tablePreference}
                        </span>
                      )}
                    </div>

                    {/* Special Requests if any */}
                    {r.specialRequests && (
                      <div className="mt-2 text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200/70">
                        <span className="font-bold">Yêu cầu đặc biệt:</span> {r.specialRequests}
                      </div>
                    )}

                    {/* Assigned Tables */}
                    {r.assignedTables && r.assignedTables.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                        <span className="text-gray-500">Bàn gán trước:</span>
                        {r.assignedTables.map((t) => (
                          <span
                            key={t.id}
                            className="font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Button: Xếp bàn & Bán hàng */}
                  <div className="pt-2 border-t border-gray-100">
                    {!isSeatedOrDone ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSeatingReservation(r);
                          setChosenTableId(r.assignedTables[0]?.id || vacantTables[0]?.id || '');
                        }}
                        className="w-full bg-[#da251d] hover:bg-[#b81d16] text-white py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Xếp bàn & Bắt đầu gọi món</span>
                      </button>
                    ) : (
                      <div className="text-center text-[11px] text-gray-400 font-medium py-1">
                        {r.status === 'CHECKED_IN' || r.status === 'SEATED'
                          ? 'Khách đang dùng bữa tại bàn'
                          : r.status === 'COMPLETED'
                          ? 'Đã hoàn tất thanh toán'
                          : 'Đơn đặt bàn đã hủy'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Seating Table Modal */}
      {seatingReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-[#da251d]" />
                <h3 className="text-sm font-bold text-gray-900">
                  Xếp bàn cho {seatingReservation.customerName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSeatingReservation(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-red-50 p-3 rounded-xl border border-red-200/80 text-red-900 flex justify-between items-center">
                <div>
                  <span className="font-bold text-sm block">{seatingReservation.customerName}</span>
                  <span className="text-[11px] text-red-700 font-mono">
                    {seatingReservation.customerPhone} • {seatingReservation.partySize} khách
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-base text-[#da251d]">
                    {seatingReservation.reservationTime}
                  </span>
                  <span className="block text-[10px] text-gray-500">Giờ đặt</span>
                </div>
              </div>

              {/* Table Selection */}
              <div>
                <label className="block text-gray-700 font-bold mb-1.5">
                  Chọn bàn phục vụ (Bàn trống):
                </label>
                {vacantTables.length === 0 ? (
                  <p className="text-rose-600 font-medium py-2">
                    Hiện không còn bàn trống nào! Vui lòng kiểm tra sơ đồ bàn.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                    {vacantTables.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setChosenTableId(t.id)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          chosenTableId === t.id
                            ? 'bg-[#da251d] text-white border-[#da251d] font-bold shadow-xs'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                        }`}
                      >
                        <div className="font-bold text-xs">{t.name}</div>
                        <div className="text-[10px] opacity-80">{t.capacity} chỗ</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSeatingReservation(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={!chosenTableId || isSeatingLoading}
                onClick={handleConfirmSeat}
                className="px-4 py-2 rounded-xl bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                {isSeatingLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Xác nhận xếp bàn</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
