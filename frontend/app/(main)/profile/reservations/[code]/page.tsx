'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Phone,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Utensils,
  Share2,
  Check,
  Plus,
  Minus,
  Trash2,
  Edit3,
  ShoppingBag,
  Sparkles,
  Info,
  Search,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface PageProps {
  params: Promise<{ code: string }>;
}

const formatVND = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

const formatDateVN = (dateStr?: string) => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
};

function ReservationDetailContent({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const guestPhone = searchParams.get('phone');

  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Pre-ordered Dine-in items state
  const [preOrderItems, setPreOrderItems] = useState<any[]>([]);
  const [isAddDishModalOpen, setIsAddDishModalOpen] = useState<boolean>(false);
  const [dineInMenu, setDineInMenu] = useState<any[]>([]);
  const [loadingMenu, setLoadingMenu] = useState<boolean>(false);
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isSavingPreOrder, setIsSavingPreOrder] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Cancellation modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);

  // Phone verification fallback state
  const [manualPhone, setManualPhone] = useState<string>('');
  const [verifyingPhone, setVerifyingPhone] = useState<boolean>(false);

  const fetchDetail = async (overridePhone?: string) => {
    try {
      setLoading(true);
      setError('');

      const phoneToUse = overridePhone || guestPhone;

      // If guest phone provided
      if (phoneToUse) {
        const res = await fetch('/api/reservations/guest-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationCode: code, phone: phoneToUse }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setReservation(data.data);
          setPreOrderItems(Array.isArray(data.data.preOrderedItems) ? data.data.preOrderedItems : []);
          setHasUnsavedChanges(false);
          setError('');
          return;
        } else {
          setError(data?.error?.message || 'Không tìm thấy đặt bàn');
        }
      }

      // Member lookup
      const res = await fetch(`/api/reservations/my/${code}${phoneToUse ? `?phone=${encodeURIComponent(phoneToUse)}` : ''}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReservation(data.data);
        setPreOrderItems(Array.isArray(data.data.preOrderedItems) ? data.data.preOrderedItems : []);
        setHasUnsavedChanges(false);
        setError('');
      } else {
        const errData = await res.json();
        setError(errData?.error?.message || 'Số điện thoại hoặc mã đặt bàn không chính xác');
      }
    } catch (err) {
      console.error('Fetch detail error:', err);
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [code, guestPhone]);

  const handleManualPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim() || manualPhone.replace(/\D/g, '').length < 9) {
      toast.error('Vui lòng nhập số điện thoại hợp lệ');
      return;
    }
    setVerifyingPhone(true);
    await fetchDetail(manualPhone.trim());
    setVerifyingPhone(false);
  };

  const handleCancelReservation = async () => {
    try {
      setCancelling(true);
      const res = await fetch(`/api/reservations/${reservation.id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cancelReason: cancelReason.trim() || 'Khách hàng yêu cầu hủy',
          phone: guestPhone || manualPhone || reservation.customerPhone,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Hủy đặt bàn thành công');
        setIsCancelModalOpen(false);
        fetchDetail(guestPhone || manualPhone);
      } else {
        toast.error(data?.error?.message || 'Hủy đặt bàn thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    } finally {
      setCancelling(false);
    }
  };

  // Pre-order Dine-in Handlers
  const fetchDineInMenu = async () => {
    if (!reservation?.branchId) return;
    try {
      setLoadingMenu(true);
      const res = await fetch(`/api/reservations/dine-in-menu?branchId=${reservation.branchId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setDineInMenu(data.data || []);
      } else {
        toast.error('Không thể tải thực đơn món ăn');
      }
    } catch (e) {
      console.error(e);
      toast.error('Lỗi kết nối tải thực đơn');
    } finally {
      setLoadingMenu(false);
    }
  };

  const handleOpenAddDish = () => {
    setIsAddDishModalOpen(true);
    fetchDineInMenu();
  };

  const handleAddDishToPreOrder = (prod: any) => {
    const pId = prod.id;
    const existingIdx = preOrderItems.findIndex(i => (i.productId || i.id) === pId);
    let updated: any[] = [];
    if (existingIdx >= 0) {
      updated = preOrderItems.map((item, idx) =>
        idx === existingIdx ? { ...item, quantity: item.quantity + 1, lineTotal: (item.quantity + 1) * item.price } : item
      );
    } else {
      updated = [
        ...preOrderItems,
        {
          productId: prod.id,
          name: prod.name,
          image: prod.imageUrl || prod.image || '',
          price: Number(prod.price),
          quantity: 1,
          lineTotal: Number(prod.price),
          selectedOptions: [],
          optionsTextSnapshot: '',
          note: '',
        }
      ];
    }
    setPreOrderItems(updated);
    setHasUnsavedChanges(true);
    toast.success(`Đã thêm "${prod.name}" vào danh sách`);
  };

  const handleUpdateItemQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setPreOrderItems(prev => prev.filter(i => (i.productId || i.id) !== productId));
    } else {
      setPreOrderItems(prev =>
        prev.map(i => ((i.productId || i.id) === productId ? { ...i, quantity: newQty, lineTotal: newQty * i.price } : i))
      );
    }
    setHasUnsavedChanges(true);
  };

  const handleRemovePreOrderItem = (productId: string) => {
    setPreOrderItems(prev => prev.filter(i => (i.productId || i.id) !== productId));
    setHasUnsavedChanges(true);
    toast.success('Đã xóa món');
  };

  const handleSavePreOrder = async () => {
    if (!reservation) return;
    try {
      setIsSavingPreOrder(true);
      const res = await fetch(`/api/reservations/${reservation.id}/pre-order-items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: preOrderItems,
          phone: guestPhone || manualPhone || reservation.customerPhone,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Cập nhật món đặt trước thành công!');
        setHasUnsavedChanges(false);
        fetchDetail(guestPhone || manualPhone);
      } else {
        const msg = data?.error?.message || data?.message || 'Cập nhật thất bại';
        toast.error(msg);
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsSavingPreOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-red-600 mb-3" />
          <p className="text-xs text-slate-500 font-medium">Đang tải thông tin đặt bàn...</p>
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center px-4 py-12">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 text-center max-w-md w-full shadow-xs">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">Xác minh thông tin đặt bàn</h2>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            Mã đặt bàn: <strong className="font-mono text-red-600">{code}</strong>. Vui lòng nhập số điện thoại khi đặt bàn để mở khóa phiếu hẹn & mã QR check-in:
          </p>

          <form onSubmit={handleManualPhoneSubmit} className="space-y-3 mb-5">
            <input
              type="tel"
              required
              placeholder="Nhập số điện thoại khi đặt"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 font-semibold focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-xs"
            />
            <button
              type="submit"
              disabled={verifyingPhone || !manualPhone}
              className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-red-600/20 disabled:opacity-50"
            >
              {verifyingPhone ? 'Đang kiểm tra...' : 'Xem phiếu đặt bàn & Mã QR'}
            </button>
          </form>

          <Link
            href="/profile/reservations"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại danh sách</span>
          </Link>
        </div>
      </div>
    );
  }

  const isCancelled = reservation.status === 'CANCELLED';
  const isCompleted = reservation.status === 'COMPLETED';
  const isNoShow = reservation.status === 'NO_SHOW';

  // 30-Minute Cutoff Calculation
  let canModifyPreOrder = false;
  let remainingMinutesToBooking = 999;
  try {
    const rawDate = reservation.reservationDate ? reservation.reservationDate.split('T')[0] : '';
    const rawTime = reservation.reservationTime || '12:00';
    if (rawDate) {
      const bookingDateTime = new Date(`${rawDate}T${rawTime}:00+07:00`);
      remainingMinutesToBooking = Math.floor((bookingDateTime.getTime() - Date.now()) / (1000 * 60));
      canModifyPreOrder = remainingMinutesToBooking > 30 && !isCancelled && !isCompleted && !isNoShow;
    }
  } catch (err) {
    canModifyPreOrder = false;
  }

  // Pre-order calculations
  const totalPreOrderAmount = preOrderItems.reduce(
    (sum, item) => sum + (Number(item.lineTotal) || (Number(item.price) * Number(item.quantity)) || 0),
    0
  );

  // State Machine Step indexing
  const getStepIndex = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 1;
      case 'CONFIRMED':
        return 2;
      case 'CHECKED_IN':
        return 3;
      case 'SEATED':
        return 4;
      case 'COMPLETED':
        return 5;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(reservation.status);

  // Filter menu by search & category
  const categories = Array.from(new Set(dineInMenu.map((m: any) => m.category?.name).filter(Boolean)));
  const filteredMenu = dineInMenu.filter((prod: any) => {
    const matchSearch = menuSearch.trim() === '' || prod.name.toLowerCase().includes(menuSearch.toLowerCase());
    const matchCat = selectedCategory === 'ALL' || prod.category?.name === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 pb-24 pt-4 sm:pt-8">
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6">
        {/* Back navigation */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/profile/reservations"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại lịch sử đặt bàn</span>
          </Link>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-8 shadow-xs relative overflow-hidden mb-6">
          {/* Status Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-5 mb-6">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                MÃ ĐẶT BÀN
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-red-600 mt-0.5 tracking-wider">
                {reservation.reservationCode}
              </div>
            </div>

            <div>
              {reservation.status === 'CONFIRMED' && (
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Đã xác nhận chỗ
                </span>
              )}
              {reservation.status === 'PENDING' && (
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Đang chờ duyệt
                </span>
              )}
              {reservation.status === 'CHECKED_IN' && (
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Đã Check-in tại quầy
                </span>
              )}
              {reservation.status === 'SEATED' && (
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-purple-50 border border-purple-200 text-purple-700 flex items-center gap-1.5">
                  <Utensils className="w-4 h-4" /> Đang phục vụ tại bàn
                </span>
              )}
              {reservation.status === 'COMPLETED' && (
                <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                  Bữa ăn đã hoàn tất
                </span>
              )}
              {reservation.status === 'CANCELLED' && (
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Đã hủy ({reservation.cancelReason || 'Theo yêu cầu'})
                </span>
              )}
            </div>
          </div>

          {/* Status Timeline Bar (if not cancelled/no-show) */}
          {!isCancelled && !isNoShow && (
            <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-400 block mb-3 uppercase tracking-wider">
                TIẾN TRÌNH ĐẶT BÀN
              </span>
              <div className="grid grid-cols-4 gap-2 text-center relative">
                {[
                  { idx: 2, label: 'Đã xác nhận' },
                  { idx: 3, label: 'Đã check-in' },
                  { idx: 4, label: 'Đang dùng bữa' },
                  { idx: 5, label: 'Hoàn tất' },
                ].map((step) => {
                  const isDone = currentStepIdx >= step.idx;
                  return (
                    <div key={step.idx} className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all mb-1 ${
                          isDone
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5" /> : step.idx}
                      </div>
                      <span
                        className={`text-[10px] sm:text-xs font-medium truncate ${
                          isDone ? 'text-red-700 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Left: Info */}
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 font-medium block mb-1">Chi Nhánh Phục Vụ</span>
                <strong className="text-sm sm:text-base text-slate-900 block">{reservation.branch?.name}</strong>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                  {[reservation.branch?.street, reservation.branch?.province].filter(Boolean).join(', ')}
                </p>
                {reservation.branch?.phone && (
                  <a
                    href={`tel:${reservation.branch.phone}`}
                    className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1 mt-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Hotline: {reservation.branch.phone}
                  </a>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-slate-400 font-medium block mb-1">Thời Gian & Số Lượng</span>
                <div className="text-sm font-bold text-red-600">
                  {reservation.reservationTime} • {formatDateVN(reservation.reservationDate)}
                </div>
                <div className="text-slate-700 text-xs mt-0.5">
                  Đoàn: <strong>{reservation.partySize} người</strong>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-slate-400 font-medium block mb-1">Thông Tin Người Đặt</span>
                <div className="font-bold text-slate-900 text-sm">{reservation.customerName}</div>
                <div className="text-slate-500 mt-0.5">{reservation.customerPhone}</div>
              </div>

              {reservation.tables && reservation.tables.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-400 font-medium block mb-1">Bàn Được Gán Sẵn</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {reservation.tables.map((t: any) => (
                      <span
                        key={t.tableId}
                        className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 font-bold text-xs"
                      >
                        {t.table?.name || t.table?.tableCode || t.tableId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {reservation.specialRequests && (
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-400 font-medium block mb-1">Yêu Cầu Đặc Biệt</span>
                  <p className="text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    "{reservation.specialRequests}"
                  </p>
                </div>
              )}
            </div>

            {/* Right: QR Check-in Box */}
            <div className="flex flex-col items-center justify-center p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
              {reservation.checkInToken && !isCancelled && !isCompleted ? (
                <>
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm mb-3">
                    <QRCodeSVG
                      value={reservation.checkInToken}
                      size={160}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                    <QrCode className="w-4 h-4 text-red-600" />
                    <span>Mã QR Check-in Tại Quầy</span>
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                    Quý khách chỉ cần xuất trình mã này cho nhân viên lễ tân khi đến nhà hàng để được tiếp đón và dẫn vào bàn ngay lập tức.
                  </p>
                </>
              ) : isCancelled ? (
                <div className="text-slate-400 py-6">
                  <XCircle className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <span className="text-xs">Đặt bàn này đã bị hủy. Mã QR đã vô hiệu hóa.</span>
                </div>
              ) : (
                <div className="text-slate-500 py-6">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <span className="text-xs font-semibold text-slate-700">Bữa ăn đã hoàn tất. Cảm ơn quý khách!</span>
                </div>
              )}
            </div>
          </div>

          {/* PRE-ORDER DINE-IN DISHES SECTION */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-red-600" />
                  <h3 className="text-base font-bold text-slate-900">Món Đặt Trước Dùng Tại Quán (Dine-in)</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đặt món trước giúp đầu bếp sơ chế sẵn, tiết kiệm thời gian chờ đợi khi quý khách đến nơi.
                </p>
              </div>

              {canModifyPreOrder && (
                <button
                  type="button"
                  onClick={handleOpenAddDish}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-600/20 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Thêm món dùng tại quán</span>
                </button>
              )}
            </div>

            {/* 30-Minute Cutoff Notification Banner */}
            {!canModifyPreOrder && !isCancelled && !isCompleted && (
              <div className="mb-4 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="font-bold block text-amber-950 mb-0.5">Thời gian tự sửa món trực tuyến đã khóa</strong>
                  Đã dưới 30 phút trước giờ hẹn đến dùng bữa. Bếp nhà hàng đã chuẩn bị nguyên liệu phục vụ quý khách. Để thêm, xóa hoặc đổi món, quý khách vui lòng liên hệ hotline chi nhánh qua số{' '}
                  <a
                    href={`tel:${reservation.branch?.phone || '19006868'}`}
                    className="font-bold text-red-700 underline hover:text-red-800"
                  >
                    {reservation.branch?.phone || '1900 6868'}
                  </a>{' '}
                  để được nhân viên lễ tân hỗ trợ ngay ạ.
                </div>
              </div>
            )}

            {/* Items list */}
            {preOrderItems.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-slate-700 mb-1">Chưa có món nào được đặt trước cho bữa ăn này</p>
                {canModifyPreOrder ? (
                  <p className="text-[11px] text-slate-400 mb-3">
                    Bấm "+ Thêm món dùng tại quán" để chọn các món đặc sắc phục vụ tại chỗ khi bạn đến.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Bạn có thể gọi món trực tiếp qua máy POS hoặc nhân viên phục vụ khi đến nhà hàng.
                  </p>
                )}
                {canModifyPreOrder && (
                  <button
                    type="button"
                    onClick={handleOpenAddDish}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:border-red-400 text-red-600 font-bold rounded-xl text-xs transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Chọn món ngay
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  {preOrderItems.map((item: any, idx: number) => {
                    const itemKey = item.productId || item.id || idx;
                    return (
                      <div key={itemKey} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded-xl border border-slate-100 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                              <Utensils className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate text-xs sm:text-sm">
                              {item.name}
                            </span>
                            {item.optionsTextSnapshot && (
                              <span className="text-[10px] text-slate-500 block truncate">
                                {item.optionsTextSnapshot}
                              </span>
                            )}
                            <span className="text-red-600 font-bold text-xs block mt-0.5">
                              {formatVND(item.price)}
                            </span>
                          </div>
                        </div>

                        {/* Quantity / Subtotal controls */}
                        <div className="flex items-center gap-3 shrink-0">
                          {canModifyPreOrder ? (
                            <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.productId || item.id, item.quantity - 1)}
                                className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-red-600 active:scale-95"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center font-bold text-xs text-slate-800">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.productId || item.id, item.quantity + 1)}
                                className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-red-600 active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
                              x{item.quantity}
                            </span>
                          )}

                          <div className="text-right w-24">
                            <span className="font-extrabold text-slate-900 block text-xs sm:text-sm">
                              {formatVND(item.lineTotal || (item.price * item.quantity))}
                            </span>
                          </div>

                          {canModifyPreOrder && (
                            <button
                              type="button"
                              onClick={() => handleRemovePreOrderItem(item.productId || item.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Xóa món"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pre-order Total Summary */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    Tổng cộng: <strong className="text-slate-900">{preOrderItems.length} món</strong> (
                    {preOrderItems.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0)} phần)
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Tạm tính:</span>
                    <span className="text-base sm:text-lg font-extrabold text-red-600 font-mono">
                      {formatVND(totalPreOrderAmount)}
                    </span>
                  </div>
                </div>

                {/* Unsaved changes banner */}
                {hasUnsavedChanges && canModifyPreOrder && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs text-red-700 animate-in fade-in">
                    <span className="font-semibold">Bạn có thay đổi món chưa lưu!</span>
                    <button
                      type="button"
                      disabled={isSavingPreOrder}
                      onClick={handleSavePreOrder}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                    >
                      {isSavingPreOrder ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang lưu...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" /> Lưu danh sách món
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cancellation Action (if applicable) */}
          {!isCancelled && !isCompleted && (
            <div className="mt-8 border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-[11px] text-slate-500">
                Cần thay đổi hoặc hủy bàn? Bạn có thể hủy trực tuyến trước giờ hẹn ít nhất 60 phút.
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all shrink-0 shadow-xs"
              >
                Hủy đặt bàn
              </button>
            </div>
          )}
        </div>

        {/* Cancellation Modal */}
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-base font-bold text-slate-900 mb-1.5">Xác Nhận Hủy Đặt Bàn</h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Quý khách có chắc chắn muốn hủy đặt bàn mã <strong className="text-slate-900">{reservation.reservationCode}</strong>? Chỗ ngồi sẽ được giải phóng cho khách hàng khác.
              </p>

              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Lý do hủy (Tùy chọn):</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="VD: Thay đổi kế hoạch đột xuất, bận việc..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 text-xs focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 mb-5 shadow-xs"
              />

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Không hủy
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancelReservation}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs"
                >
                  {cancelling ? 'Đang xử lý...' : 'Xác nhận hủy'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD DINE-IN DISH MODAL */}
        {isAddDishModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3.5 sm:p-4 animate-in fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-red-600" />
                    Thực Đơn Dùng Tại Quán (Dine-in)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Các món ăn khả dụng tại {reservation.branch?.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddDishModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search & Category Filter */}
              <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Tìm tên món ăn..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {categories.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                        selectedCategory === 'ALL'
                          ? 'bg-red-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      Tất cả
                    </button>
                    {categories.map((cat: any) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                          selectedCategory === cat
                            ? 'bg-red-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Dish List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {loadingMenu ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-600" />
                    <span className="text-xs">Đang tải thực đơn...</span>
                  </div>
                ) : filteredMenu.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Không tìm thấy món ăn phù hợp
                  </div>
                ) : (
                  filteredMenu.map((prod: any) => {
                    const alreadyInOrder = preOrderItems.find((i) => (i.productId || i.id) === prod.id);
                    return (
                      <div
                        key={prod.id}
                        className="p-3 bg-white border border-slate-200 hover:border-red-200 rounded-2xl flex items-center justify-between gap-3 transition-colors shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                              <Utensils className="w-6 h-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate text-xs sm:text-sm">
                              {prod.name}
                            </span>
                            <span className="text-slate-400 text-[11px] block truncate">
                              {prod.category?.name || 'Món ăn'}
                            </span>
                            <span className="text-red-600 font-extrabold text-xs block mt-0.5">
                              {formatVND(prod.price)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {alreadyInOrder && (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              x{alreadyInOrder.quantity}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAddDishToPreOrder(prod)}
                            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{alreadyInOrder ? 'Thêm +1' : 'Thêm'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Đã chọn: <strong className="text-slate-900">{preOrderItems.length} món</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddDishModalOpen(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                >
                  Xong
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReservationDetailPage({ params }: PageProps) {
  const { code } = use(params);
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ReservationDetailContent code={code} />
    </React.Suspense>
  );
}
