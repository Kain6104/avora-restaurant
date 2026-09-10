'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle, CheckCircle2, Loader2, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export interface OperatingSlot {
  id: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  effectiveCurrentOrders: number;
  remainingOrders: number;
  leadTimeMinutes: number;
  orderType: string;
  isActive: boolean;
  calculatedStatus: 'OPEN' | 'FULL';
  isCapacityFull: boolean;
  isLeadTimeRestricted: boolean;
  isAvailable: boolean;
}

interface OperatingSlotPickerProps {
  branchId?: string;
  orderType?: string;
  selectedSlotId: string | null;
  selectedDate: string; // YYYY-MM-DD
  onSelectSlot: (slot: OperatingSlot | null, dateStr: string) => void;
  sessionId: string;
}

function getVnDateInfo(offsetDays: number = 0) {
  const now = new Date();
  const target = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(target); // YYYY-MM-DD
  const parts = dateStr.split('-');
  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10);
  return {
    dateStr,
    day,
    month,
    displayLabel: `${day}/${month}`,
  };
}

export default function OperatingSlotPicker({
  branchId,
  orderType = 'DELIVERY',
  selectedSlotId,
  selectedDate,
  onSelectSlot,
  sessionId,
}: OperatingSlotPickerProps) {
  const [slots, setSlots] = useState<OperatingSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const todayInfo = getVnDateInfo(0);
  const tomorrowInfo = getVnDateInfo(1);
  const max14DaysInfo = getVnDateInfo(14);

  const [dayTab, setDayTab] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>('');

  const effectiveDate =
    dayTab === 'today'
      ? todayInfo.dateStr
      : dayTab === 'tomorrow'
      ? tomorrowInfo.dateStr
      : customDate || todayInfo.dateStr;

  useEffect(() => {
    if (!branchId || !isModalOpen) return;

    const fetchSlots = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/operating-slots/for-date?branchId=${branchId}&date=${effectiveDate}&orderType=${orderType}`,
        );
        if (res.ok) {
          const data = await res.json();
          const list: OperatingSlot[] = data.data || [];
          setSlots(list);

          // Nếu slot đang chọn không còn khả dụng trên ngày này, reset
          if (selectedSlotId) {
            const found = list.find((s) => s.id === selectedSlotId);
            if (!found || !found.isAvailable) {
              // keep or reset
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch operating slots:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [branchId, effectiveDate, orderType, isModalOpen]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  const handleSelect = async (slot: OperatingSlot) => {
    if (!slot.isAvailable) return;

    try {
      const res = await fetch('/api/operating-slots/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          date: effectiveDate,
          sessionId,
        }),
      });

      if (res.ok) {
        onSelectSlot(slot, effectiveDate);
        toast.success(`Đã chọn khung giờ ${slot.startTime} - ${slot.endTime} (giữ chỗ 10 phút)`, {
          id: 'slot-lock-toast',
        });
        setIsModalOpen(false);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Không thể chọn khung giờ này.');
      }
    } catch (e) {
      onSelectSlot(slot, effectiveDate);
      setIsModalOpen(false);
    }
  };

  // Format nhãn ngày đã chọn hiển thị trên Checkout Card
  const getSelectedDateLabel = () => {
    if (selectedDate === todayInfo.dateStr) return `Hôm nay (${todayInfo.displayLabel})`;
    if (selectedDate === tomorrowInfo.dateStr) return `Ngày mai (${tomorrowInfo.displayLabel})`;
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-');
      return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
    }
    return `Hôm nay (${todayInfo.displayLabel})`;
  };

  return (
    <>
      {/* ── COMPACT CHECKOUT CARD TRIGGER ── */}
      <div
        onClick={() => setIsModalOpen(true)}
        className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60 cursor-pointer hover:border-slate-300 transition-colors"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="flex items-center text-base font-bold text-slate-800">
            <Clock className="mr-2 text-[#da251d]" size={20} />
            Thời gian nhận hàng
          </h2>
          <span className="text-xs font-bold text-[#da251d] hover:underline flex items-center gap-1">
            {selectedSlotId ? 'Thay đổi' : 'Chọn khung giờ'}
            <ChevronRight size={14} />
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div>
            {selectedSlotId && selectedSlot ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-sm sm:text-base">
                    {selectedSlot.startTime} - {selectedSlot.endTime}
                  </span>
                  <span className="bg-red-50 text-[#da251d] text-xs px-2 py-0.5 rounded-md font-bold">
                    {getSelectedDateLabel()}
                  </span>
                </div>
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Nhà hàng sẽ chuẩn bị và giao món đúng khung giờ bạn chọn
                </p>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Vui lòng chọn khung giờ giao hàng (Nhấn để chọn)...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL CHỌN KHUNG GIỜ HOẠT ĐỘNG ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Chọn khung giờ giao hàng</h3>
                  <p className="text-xs text-slate-400">Chọn ngày và giờ nhà hàng phục vụ đơn của bạn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Date Tabs */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDayTab('today')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    dayTab === 'today'
                      ? 'bg-white text-[#da251d] shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Hôm nay ({todayInfo.displayLabel})
                </button>
                <button
                  type="button"
                  onClick={() => setDayTab('tomorrow')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    dayTab === 'tomorrow'
                      ? 'bg-white text-[#da251d] shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Ngày mai ({tomorrowInfo.displayLabel})
                </button>
                <button
                  type="button"
                  onClick={() => setDayTab('custom')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    dayTab === 'custom'
                      ? 'bg-white text-[#da251d] shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Chọn ngày khác
                </button>
              </div>

              {/* Custom Date Input (trong vòng 14 ngày) */}
              {dayTab === 'custom' && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <Calendar size={18} className="text-[#da251d]" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Chọn ngày trong vòng 14 ngày
                    </p>
                    <input
                      type="date"
                      min={todayInfo.dateStr}
                      max={max14DaysInfo.dateStr}
                      value={customDate || todayInfo.dateStr}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full text-xs font-bold bg-transparent outline-none text-slate-800 pt-0.5"
                    />
                  </div>
                </div>
              )}

              {/* Slot Grid */}
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[#da251d]" />
                  <span>Đang tải các khung giờ mở bán...</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <AlertCircle size={24} className="mx-auto text-amber-500 mb-1" />
                  <p className="font-bold text-slate-800">Không có khung giờ phục vụ nào trong ngày này.</p>
                  <p className="text-[11px] text-slate-500">Vui lòng chọn ngày giao hàng khác.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {slots.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!slot.isAvailable}
                        onClick={() => handleSelect(slot)}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative cursor-pointer ${
                          isSelected
                            ? 'border-[#da251d] bg-red-50/50 shadow-sm ring-2 ring-[#da251d]/20'
                            : slot.isAvailable
                            ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                            : 'border-slate-100 bg-slate-100/60 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs sm:text-sm font-black tracking-tight ${
                              isSelected
                                ? 'text-[#da251d]'
                                : slot.isAvailable
                                ? 'text-slate-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {slot.startTime} - {slot.endTime}
                          </span>
                          {isSelected && <CheckCircle2 size={15} className="text-[#da251d]" />}
                        </div>

                        <div className="text-[11px]">
                          {slot.isLeadTimeRestricted ? (
                            <span className="text-amber-600 font-bold">Quá giờ đặt trước</span>
                          ) : slot.isCapacityFull ? (
                            <span className="text-red-500 font-bold">Hết chỗ</span>
                          ) : slot.maxOrders > 0 ? (
                            <span className="text-emerald-600 font-semibold">Còn {slot.remainingOrders} suất</span>
                          ) : (
                            <span className="text-slate-500 font-medium">Sẵn sàng nhận đơn</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
