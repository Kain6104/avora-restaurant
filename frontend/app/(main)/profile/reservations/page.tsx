'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Search,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Plus,
  RefreshCw,
  QrCode,
  CheckCircle2,
  XCircle,
  Phone,
  BookmarkCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ReservationItem {
  id: string;
  reservationCode: string;
  reservationDate: string;
  reservationTime: string;
  partySize: number;
  status: string;
  branch: {
    id: string;
    name: string;
    phone?: string;
    street?: string;
    province?: string;
  };
  startAt?: string;
  createdAt: string;
}

export default function ReservationsListPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  // Guest lookup form
  const [guestCode, setGuestCode] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [lookingUp, setLookingUp] = useState<boolean>(false);

  const fetchMyReservations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reservations/my', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setReservations(json?.data?.data || []);
      } else if (res.status === 401) {
        setIsGuest(true);
      }
    } catch (err) {
      console.error('Fetch reservations error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReservations();
  }, []);

  const handleGuestLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestCode.trim() || !guestPhone.trim()) {
      toast.error('Vui lòng nhập đầy đủ mã đặt bàn và số điện thoại');
      return;
    }

    try {
      setLookingUp(true);
      const res = await fetch('/api/reservations/guest-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationCode: guestCode.trim().toUpperCase(),
          phone: guestPhone.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push(`/profile/reservations/${data.data.reservationCode}?phone=${encodeURIComponent(guestPhone)}`);
      } else {
        toast.error(data?.error?.message || 'Không tìm thấy đặt bàn phù hợp');
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLookingUp(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
            <CheckCircle2 className="w-3 h-3" /> Đã xác nhận
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-800">
            <Clock className="w-3 h-3" /> Chờ duyệt
          </span>
        );
      case 'CHECKED_IN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
            <BookmarkCheck className="w-3 h-3" /> Đã Check-in
          </span>
        );
      case 'SEATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 border border-purple-200 text-purple-700">
            Đang dùng bữa
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 border border-slate-200 text-slate-700">
            Hoàn tất
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 border border-rose-200 text-rose-700">
            <XCircle className="w-3 h-3" /> Đã hủy
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 border border-slate-300 text-slate-500">
            Vắng mặt
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 pb-24 pt-4 sm:pt-8">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200/80 text-red-700 text-xs font-semibold mb-2 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-red-600" />
              <span>Quản Lý Đặt Chỗ AVORA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Calendar className="w-7 h-7 text-red-600 shrink-0" />
              <span>Lịch Sử Đặt Bàn</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Xem chi tiết, xuất trình mã QR check-in và quản lý lịch hẹn tại nhà hàng AVORA
            </p>
          </div>
          <Link
            href="/booking"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-red-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Đặt bàn mới</span>
          </Link>
        </div>

        {/* Guest Lookup Form (Always available) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-xs">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-1.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-red-600 shrink-0" />
            <span>Tra Cứu Đặt Bàn Khách Vãng Lai (Guest Lookup)</span>
          </h2>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Quý khách không đăng nhập tài khoản? Nhập mã đặt bàn (AVR-XXXX) và số điện thoại khi đặt để xem phiếu hẹn & mã QR check-in:
          </p>

          <form onSubmit={handleGuestLookup} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="Mã đặt bàn (VD: AVR-260904-89AB)"
              value={guestCode}
              onChange={(e) => setGuestCode(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 flex-1 shadow-xs"
            />
            <input
              type="tel"
              required
              placeholder="Số điện thoại khi đặt"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 sm:w-56 shadow-xs"
            />
            <button
              type="submit"
              disabled={lookingUp}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs shrink-0"
            >
              {lookingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Tìm kiếm</span>
            </button>
          </form>
        </div>

        {/* Reservations List */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white border border-slate-200/80 rounded-2xl p-8 shadow-xs">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-red-600" />
            <span className="text-xs sm:text-sm font-medium text-slate-600">Đang tải danh sách đặt bàn...</span>
          </div>
        ) : reservations.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-12 text-center shadow-xs">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">
              Chưa có lịch đặt bàn nào
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
              Bạn chưa có lịch hẹn đặt bàn nào trên tài khoản này. Hãy chọn một chi nhánh yêu thích và tận hưởng bữa ăn trọn vẹn tại AVORA!
            </p>
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-red-600/20"
            >
              <span>Đặt bàn ngay bây giờ</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {reservations.map((res) => (
              <Link
                key={res.id}
                href={`/profile/reservations/${res.reservationCode}`}
                className="block bg-white hover:bg-slate-50/80 border border-slate-200/90 hover:border-red-300 rounded-2xl p-4 sm:p-5 transition-all group shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-extrabold text-red-600 text-sm sm:text-base tracking-wide">
                      {res.reservationCode}
                    </span>
                    {getStatusBadge(res.status)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-red-600 font-medium transition-colors">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Xem chi tiết & mã QR</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="font-bold text-slate-900 truncate">{res.branch?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700">
                      {res.reservationTime} • {res.reservationDate ? res.reservationDate.split('T')[0] : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700">{res.partySize} khách</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
