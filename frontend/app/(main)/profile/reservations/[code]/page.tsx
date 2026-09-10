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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function ReservationDetailPage({ params }: PageProps) {
  const { code } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const guestPhone = searchParams.get('phone');

  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

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
                  {reservation.reservationTime} • {reservation.reservationDate ? reservation.reservationDate.split('T')[0] : ''}
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

          {/* Cancellation Action (if applicable) */}
          {!isCancelled && !isCompleted && (
            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
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
      </div>
    </div>
  );
}
