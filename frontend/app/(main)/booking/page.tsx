'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Phone,
  ChevronRight,
  ChevronLeft,
  Info,
  ShieldCheck,
  Heart,
  QrCode,
  ArrowRight,
  Utensils,
  RefreshCw,
  Search,
  Check,
  Building2,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface BranchItem {
  id: string;
  name: string;
  branchCode: string;
  phone?: string;
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
  openTime?: string;
  closeTime?: string;
  reservationEnabled: boolean;
  minPartySize: number;
  maxPartySize: number;
  advanceBookingDays: number;
}

interface SlotItem {
  time: string;
  status: 'AVAILABLE' | 'LIMITED' | 'FULL' | 'PAST';
  remainingCapacity: number;
  reason?: string;
}

const OCCASIONS = [
  { id: 'casual', label: 'Bữa ăn thông thường' },
  { id: 'birthday', label: 'Sinh nhật' },
  { id: 'anniversary', label: 'Kỷ niệm ngày cưới' },
  { id: 'date', label: 'Hẹn hò lãng mạn' },
  { id: 'business', label: 'Gặp gỡ đối tác / Tiếp khách' },
  { id: 'family', label: 'Sum họp gia đình' },
];

const SEATING_PREFERENCES = [
  { id: 'main', label: 'Trong nhà (Main Dining)', desc: 'Không gian ấm cúng, sang trọng, mát mẻ' },
  { id: 'window', label: 'Cạnh cửa sổ (Window View)', desc: 'Tầm nhìn thoáng đãng ngắm phố phường' },
  { id: 'outdoor', label: 'Ngoài trời (Outdoor Terrace)', desc: 'Không gian thoáng mát, gió tự nhiên' },
  { id: 'vip', label: 'Phòng VIP riêng tư', desc: 'Không gian tách biệt cho tiệc thân mật' },
];

export default function BookingPage() {
  const router = useRouter();

  // Step state (1 -> 4: Flow, 5: Success)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form selections
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loadingBranches, setLoadingBranches] = useState<boolean>(true);
  const [branchError, setBranchError] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [partySize, setPartySize] = useState<number>(2);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [occasion, setOccasion] = useState<string>('casual');
  const [seatingPreference, setSeatingPreference] = useState<string>('main');
  const [specialRequests, setSpecialRequests] = useState<string>('');

  // Customer details
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');

  // Slots data
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotMessage, setSlotMessage] = useState<string>('');

  // Submission
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null);

  // Fetch branches with fallback and retry
  const fetchBranches = async () => {
    try {
      setLoadingBranches(true);
      setBranchError('');

      let res = await fetch('/api/reservations/branches');
      if (!res.ok) {
        res = await fetch('/api/home/branches');
      }

      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : json?.data || [];
        setBranches(list);
        if (list.length > 0 && !selectedBranchId) {
          setSelectedBranchId(list[0].id);
        }
      } else {
        setBranchError('Không thể tải danh sách chi nhánh lúc này.');
      }
    } catch (e) {
      console.error('Error fetching branches:', e);
      setBranchError('Lỗi kết nối máy chủ khi lấy danh sách chi nhánh.');
    } finally {
      setLoadingBranches(false);
    }
  };

  useEffect(() => {
    fetchBranches();

    // Default date to tomorrow in Vietnam
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrowStr = d.toISOString().split('T')[0];
    setSelectedDate(tomorrowStr);

    // Auto-fill customer profile if logged in
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (res.ok) {
          const u = await res.json();
          const userData = u?.data || u;
          if (userData?.name) setCustomerName(userData.name);
          if (userData?.phone) setCustomerPhone(userData.phone);
          if (userData?.email) setCustomerEmail(userData.email);
        }
      } catch (err) {
        // Silently ignore if not logged in
      }
    };
    fetchUser();
  }, []);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) || branches[0],
    [branches, selectedBranchId],
  );

  // Fetch real availability slots whenever branch, date, or partySize changes
  useEffect(() => {
    if (!selectedBranchId || !selectedDate) return;

    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        setSlotMessage('');
        const res = await fetch(
          `/api/reservations/availability?branchId=${selectedBranchId}&date=${selectedDate}&partySize=${partySize}`,
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setSlots(json.data.slots || []);
            if (!json.data.isOpen) {
              setSlotMessage(json.data.message || 'Chi nhánh tạm ngưng nhận đặt bàn vào ngày này.');
            }
          }
        } else {
          const errData = await res.json();
          setSlotMessage(errData?.error?.message || 'Không thể tải danh sách khung giờ.');
          setSlots([]);
        }
      } catch (err) {
        console.error('Fetch availability error:', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedBranchId, selectedDate, partySize]);

  // Handle Booking Submission
  const handleBooking = async () => {
    if (!customerName.trim()) {
      toast.error('Vui lòng nhập tên người đặt');
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 9) {
      toast.error('Vui lòng nhập số điện thoại hợp lệ');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        branchId: selectedBranchId,
        reservationDate: selectedDate,
        reservationTime: selectedTime,
        partySize,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        occasion,
        seatingPreference,
        specialRequests: specialRequests.trim() || undefined,
      };

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setConfirmedReservation(data.data);
        setCurrentStep(5); // Step 5 is Success screen
        toast.success('Đặt bàn thành công!');
      } else {
        const errorMsg = data?.error?.message || 'Đặt bàn không thành công. Vui lòng thử lại!';
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('Booking submission error:', err);
      toast.error('Có lỗi xảy ra khi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 pb-24 pt-4 sm:pt-8">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6">
        {/* Header Title */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200/80 text-red-700 text-xs sm:text-sm font-semibold mb-2.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
            <span>Hệ Thống Đặt Bàn Đẳng Cấp AVORA</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
            Đặt Bàn Trực Tuyến
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
            Trải nghiệm không gian ẩm thực thượng hạng với chỗ ngồi lý tưởng và dịch vụ tận tâm tại chuỗi nhà hàng AVORA.
          </p>

          {/* Quick link to Lookup existing reservation */}
          <div className="mt-3">
            <Link
              href="/profile/reservations"
              className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium transition-colors underline underline-offset-4"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Đã có lịch đặt? Tra cứu mã đặt bàn tại đây</span>
            </Link>
          </div>
        </div>

        {/* STEPPER PROGRESS INDICATOR (Steps 1 to 4) */}
        {currentStep < 5 && (
          <div className="mb-6 sm:mb-8">
            {/* MOBILE STEPPER: Ultra-optimized, NEVER overflows screen width */}
            <div className="block md:hidden bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold shadow-xs">
                    {currentStep}
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {currentStep === 1 && '1. Chi nhánh & Ngày'}
                    {currentStep === 2 && '2. Khung giờ & Khách'}
                    {currentStep === 3 && '3. Sở thích & Yêu cầu'}
                    {currentStep === 4 && '4. Thông tin & Xác nhận'}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 shrink-0 ml-2">
                  Bước {currentStep}/4
                </span>
              </div>

              {/* Progress bar line */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-rose-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(currentStep / 4) * 100}%` }}
                />
              </div>

              {/* 4 Compact step pills */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { step: 1, label: 'Chi nhánh' },
                  { step: 2, label: 'Giờ & Khách' },
                  { step: 3, label: 'Sở thích' },
                  { step: 4, label: 'Xác nhận' },
                ].map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    disabled={currentStep < s.step}
                    onClick={() => {
                      if (currentStep > s.step) setCurrentStep(s.step);
                    }}
                    className={`py-1 px-1 rounded-md text-[10px] font-medium text-center transition-colors truncate ${
                      currentStep === s.step
                        ? 'bg-red-50 text-red-700 font-bold border border-red-200'
                        : currentStep > s.step
                        ? 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                        : 'text-slate-400 bg-transparent opacity-60'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DESKTOP STEPPER: Elegant timeline flow with clean labels */}
            <div className="hidden md:block bg-white border border-slate-200/90 rounded-2xl py-4 px-6 shadow-xs">
              <div className="flex items-center justify-between relative max-w-xl mx-auto">
                <div className="absolute left-0 top-4 -translate-y-1/2 h-0.5 bg-slate-200 w-full z-0" />
                <div
                  className="absolute left-0 top-4 -translate-y-1/2 h-0.5 bg-gradient-to-r from-red-600 to-rose-600 transition-all duration-300 z-0"
                  style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                />

                {[
                  { step: 1, label: 'Chi nhánh & Ngày' },
                  { step: 2, label: 'Khung giờ & Khách' },
                  { step: 3, label: 'Sở thích & Yêu cầu' },
                  { step: 4, label: 'Thông tin & Xác nhận' },
                ].map((item) => {
                  const isCompleted = currentStep > item.step;
                  const isCurrent = currentStep === item.step;
                  return (
                    <div key={item.step} className="relative z-10 flex flex-col items-center">
                      <button
                        type="button"
                        disabled={!isCompleted}
                        onClick={() => {
                          if (isCompleted) setCurrentStep(item.step);
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCurrent
                            ? 'bg-red-600 text-white ring-4 ring-red-100 shadow-md shadow-red-600/20'
                            : isCompleted
                            ? 'bg-red-600 text-white cursor-pointer hover:bg-red-700'
                            : 'bg-white text-slate-400 border-2 border-slate-200'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : item.step}
                      </button>
                      <span
                        className={`text-xs mt-1.5 font-medium ${
                          isCurrent
                            ? 'text-red-600 font-bold'
                            : isCompleted
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Chọn Chi Nhánh & Ngày */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Chi nhánh AVORA: SELECT OPTION DROPDOWN */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-600 shrink-0" />
                  <span>1. Chọn Chi Nhánh AVORA</span>
                </h2>
                <span className="text-xs text-slate-400 font-medium">
                  {branches.length > 0 ? `${branches.length} chi nhánh` : ''}
                </span>
              </div>

              {loadingBranches ? (
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 animate-pulse space-y-2">
                  <div className="h-10 w-full bg-slate-200 rounded-xl" />
                  <div className="h-16 w-full bg-slate-200 rounded-xl" />
                </div>
              ) : branchError ? (
                <div className="p-5 text-center bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <p className="mb-3">{branchError}</p>
                  <button
                    type="button"
                    onClick={fetchBranches}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Thử tải lại</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Select Dropdown */}
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-600 pointer-events-none">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <select
                      id="branch-select"
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-xs appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.branchCode}) - {[b.district, b.province].filter(Boolean).join(', ')}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Selected Branch Detail Mini Card */}
                  {selectedBranch && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 bg-red-100/80 px-2 py-0.5 rounded">
                            {selectedBranch.branchCode}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {selectedBranch.name}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Đang nhận đặt
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-start gap-1.5 pt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>
                          {[selectedBranch.street, selectedBranch.ward, selectedBranch.district, selectedBranch.province].filter(Boolean).join(', ')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 border-t border-slate-200/60 pt-2 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Giờ mở cửa: {selectedBranch.openTime || '10:00'} - {selectedBranch.closeTime || '22:00'}
                        </span>
                        {selectedBranch.phone && (
                          <a
                            href={`tel:${selectedBranch.phone}`}
                            className="flex items-center gap-1 text-red-600 hover:text-red-700 font-medium"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {selectedBranch.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chọn Ngày */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-7 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-red-600 shrink-0" />
                <span>2. Chọn Ngày Dùng Bữa</span>
              </h2>

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm font-medium focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 w-full sm:w-64 shadow-xs"
                />
                <span className="text-xs text-slate-500">
                  Hệ thống cho phép đặt bàn trước tối đa {selectedBranch?.advanceBookingDays || 30} ngày.
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!selectedBranchId || !selectedDate}
                onClick={() => setCurrentStep(2)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 shadow-md shadow-red-600/20"
              >
                <span>Tiếp tục chọn giờ</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Khung giờ & Số lượng khách */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Chọn số lượng khách */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-7 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-red-600 shrink-0" />
                <span>Số Lượng Khách</span>
              </h2>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPartySize(num)}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                      partySize === num
                        ? 'bg-red-600 text-white border-red-600 font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {num} người
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium">Số khách khác:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={partySize}
                  onChange={(e) => setPartySize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-sm w-24 text-center font-semibold focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-xs"
                />
              </div>

              {partySize > 16 && (
                <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-800 leading-relaxed">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Đoàn trên 16 khách: Nhà hàng sẽ chủ động ghép các bàn gần nhau hoặc sắp xếp phòng tiệc VIP riêng biệt để đảm bảo không gian ấm cúng nhất cho quý khách.
                  </span>
                </div>
              )}
            </div>

            {/* Khung giờ khả dụng từ Backend */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-7 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-600 shrink-0" />
                  <span>Chọn Khung Giờ Đến</span>
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Còn chỗ
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Sắp kín
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> Hết chỗ
                  </span>
                </div>
              </div>

              {loadingSlots ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-600" />
                  <span className="text-xs">Đang kiểm tra sức chứa thời gian thực...</span>
                </div>
              ) : slotMessage ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{slotMessage}</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  Không tìm thấy khung giờ phù hợp. Quý khách vui lòng chọn ngày khác.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {slots.map((slot) => {
                    const isAvailable = slot.status === 'AVAILABLE';
                    const isLimited = slot.status === 'LIMITED';
                    const isFull = slot.status === 'FULL' || slot.status === 'PAST';
                    const isSelected = selectedTime === slot.time;

                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={isFull}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all relative ${
                          isSelected
                            ? 'bg-red-600 text-white font-bold border-red-600 shadow-md shadow-red-600/30 ring-2 ring-red-200'
                            : isFull
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            : isLimited
                            ? 'bg-amber-50/70 border-amber-300 text-amber-900 hover:bg-amber-100/60'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-red-300 hover:bg-red-50/20'
                        }`}
                      >
                        <div className="text-sm font-bold">{slot.time}</div>
                        <div
                          className={`text-[10px] mt-0.5 font-medium ${
                            isSelected ? 'text-white/90' : isLimited ? 'text-amber-700' : 'text-slate-400'
                          }`}
                        >
                          {isFull
                            ? slot.reason || 'Kín chỗ'
                            : isLimited
                            ? `Còn ${slot.remainingCapacity} chỗ`
                            : 'Còn chỗ'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>
              <button
                type="button"
                disabled={!selectedTime}
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-2 px-6 sm:px-7 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 shadow-md shadow-red-600/20"
              >
                <span>Tiếp tục</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Sở thích chỗ ngồi & Dịp kỷ niệm */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Dịp kỷ niệm */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-7 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-600 shrink-0" />
                <span>Dịp Đặc Biệt Của Bữa Ăn</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() => setOccasion(occ.id)}
                    className={`p-3 sm:p-3.5 rounded-xl text-left border transition-all text-xs sm:text-sm font-medium ${
                      occasion === occ.id
                        ? 'bg-red-50 border-red-500 text-red-700 font-bold ring-1 ring-red-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs'
                    }`}
                  >
                    {occ.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sở thích chỗ ngồi kèm Disclaimer (Requirement M) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-7 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-red-600 shrink-0" />
                <span>Khu Vực Bàn Mong Muốn</span>
              </h2>

              {/* Requirement M: Mandatory Seating Preference Disclaimer */}
              <div className="p-3.5 mb-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
                <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Lưu ý quan trọng:</strong> Sở thích vị trí ngồi là yêu cầu ưu tiên. Nhà hàng AVORA sẽ nỗ lực tối đa sắp xếp vị trí phù hợp nhất tùy theo tình trạng bàn thực tế lúc quý khách đến.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SEATING_PREFERENCES.map((pref) => (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => setSeatingPreference(pref.id)}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      seatingPreference === pref.id
                        ? 'bg-red-50/50 border-red-500 text-slate-900 ring-1 ring-red-500 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs'
                    }`}
                  >
                    <div className="font-bold text-sm text-slate-900">{pref.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{pref.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ghi chú đặc biệt */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-7 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3">
                Yêu Cầu Đặc Biệt Khác (Tùy chọn)
              </h2>
              <textarea
                rows={3}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="VD: Có trẻ em cần ghế ăn dặm, chuẩn bị nến sinh nhật, trang trí bàn tiệc..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-xs"
              />
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="flex items-center gap-2 px-6 sm:px-7 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-red-600/20"
              >
                <span>Nhập thông tin liên hệ</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Thông Tin Người Đặt & Tóm Tắt Xác Nhận */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Tóm tắt phiếu đặt */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-7 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span>Tóm Tắt Thông Tin Đặt Bàn</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 mb-6">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Chi nhánh</span>
                  <strong className="text-xs sm:text-sm text-slate-900 block truncate">
                    {selectedBranch?.name}
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Thời gian</span>
                  <strong className="text-xs sm:text-sm text-red-600 block">
                    {selectedTime} • {selectedDate}
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Số lượng</span>
                  <strong className="text-xs sm:text-sm text-slate-900 block">{partySize} người</strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Vị trí mong muốn</span>
                  <strong className="text-xs sm:text-sm text-slate-800 block truncate">
                    {SEATING_PREFERENCES.find((p) => p.id === seatingPreference)?.label}
                  </strong>
                </div>
              </div>

              {/* Nhập Thông Tin Khách Hàng */}
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3">
                Thông Tin Liên Hệ Nhận Mã Đặt Bàn
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Họ và Tên người đặt <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Số điện thoại liên hệ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="VD: 0901234567"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Email nhận thông báo (Không bắt buộc)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="VD: email@example.com"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-xs"
                  />
                </div>
              </div>

              <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 leading-relaxed">
                Sau khi nhấn "Xác Nhận Đặt Bàn", hệ thống AVORA sẽ kiểm tra và giữ bàn ngay lập tức với thuật toán chống overbooking an toàn tuyệt đối. Mã đặt bàn và mã QR check-in sẽ được cấp ngay trên màn hình.
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>
              <button
                type="button"
                disabled={submitting || !customerName || !customerPhone}
                onClick={handleBooking}
                className="flex items-center gap-2 px-7 sm:px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 shadow-lg shadow-red-600/25"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý đặt bàn...</span>
                  </>
                ) : (
                  <>
                    <span>Xác Nhận Đặt Bàn Ngay</span>
                    <CheckCircle2 className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: ĐẶT BÀN THÀNH CÔNG VỚI QR CHECK-IN */}
        {currentStep === 5 && confirmedReservation && (
          <div className="max-w-xl mx-auto space-y-6 animate-in zoom-in-95 duration-400">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center shadow-xl relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <span className="text-xs uppercase tracking-widest text-red-600 font-bold">
                Xác Nhận Đặt Bàn Thành Công
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 mb-2">
                Hân Hạnh Chào Đón Quý Khách
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Đặt bàn của bạn đã được ghi nhận trên toàn hệ thống nhà hàng AVORA.
              </p>

              {/* Reservation Code Badge */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-6">
                <span className="text-[11px] text-slate-500 block mb-1 font-semibold">MÃ ĐẶT BÀN CỦA BẠN</span>
                <span className="text-2xl sm:text-3xl font-mono font-extrabold text-red-600 tracking-wider">
                  {confirmedReservation.reservationCode}
                </span>
              </div>

              {/* Secure QR Code Check-in */}
              {confirmedReservation.checkInToken && (
                <div className="inline-block p-4 rounded-2xl bg-white mb-6 border border-slate-200 shadow-sm">
                  <QRCodeSVG
                    value={confirmedReservation.checkInToken}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                  <span className="text-[10px] text-slate-600 font-semibold block mt-2">
                    Mã QR Check-in Khi Đến Quán
                  </span>
                </div>
              )}

              {/* Details Summary */}
              <div className="text-left p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-700 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-500">Khách hàng:</span>
                  <span className="font-bold text-slate-900">{confirmedReservation.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số điện thoại:</span>
                  <span className="font-bold text-slate-900">{confirmedReservation.customerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chi nhánh:</span>
                  <span className="font-bold text-slate-900">{selectedBranch?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thời gian:</span>
                  <span className="font-bold text-red-600">
                    {confirmedReservation.reservationTime} • {selectedDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số lượng khách:</span>
                  <span className="font-bold text-slate-900">{confirmedReservation.partySize} người</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={`/profile/reservations/${confirmedReservation.reservationCode}?phone=${encodeURIComponent(confirmedReservation.customerPhone)}`}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-600/20"
                >
                  <span>Quản lý lịch đặt bàn</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/"
                  className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center transition-all shadow-xs"
                >
                  <span>Về trang chủ</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
