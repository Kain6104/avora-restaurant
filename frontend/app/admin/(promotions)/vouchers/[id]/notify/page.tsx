'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Mail,
  Send,
  ArrowLeft,
  Users,
  Crown,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Search,
  User as UserIcon,
  X,
  Check,
  Ticket,
  Smartphone,
  Eye,
  RefreshCw,
  Clock,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface MembershipTier {
  id: string;
  name: string;
  minSpending?: number;
  discountPercent?: number;
}

interface UserSummary {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  membershipTier?: { id: string; name: string };
}

interface AudiencePreview {
  estimatedRecipients: number;
  emailRecipients: number;
  targetType: string;
  selectedMembershipTiers: MembershipTier[];
  selectedUsers: UserSummary[];
}

export default function VoucherNotificationPage() {
  const params = useParams();
  const router = useRouter();
  const voucherId = params?.id as string;
  const { locale } = useLanguage();
  const isEn = locale === 'en';

  // 1. Voucher details state
  const [voucher, setVoucher] = useState<any>(null);
  const [loadingVoucher, setLoadingVoucher] = useState(true);

  // 2. Campaign channel configuration
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);

  // 3. Target Audience: 'ALL' | 'MEMBERSHIP_TIER' | 'SPECIFIC_USERS'
  const [targetType, setTargetType] = useState<'ALL' | 'MEMBERSHIP_TIER' | 'SPECIFIC_USERS'>('ALL');

  // 4. Membership Tiers selection
  const [availableTiers, setAvailableTiers] = useState<MembershipTier[]>([]);
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>([]);

  // 5. Specific Users selection & search
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSummary[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSummary[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // 6. Content Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [customEmailSubject, setCustomEmailSubject] = useState('');
  const [customEmailNote, setCustomEmailNote] = useState('');

  // 7. Audience Preview & Status
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 8. Live Preview Mode: 'PUSH' | 'EMAIL'
  const [previewMode, setPreviewMode] = useState<'PUSH' | 'EMAIL'>('PUSH');

  // 9. Result Dialog State
  const [sendResult, setSendResult] = useState<any>(null);

  // FETCH VOUCHER & TIERS
  useEffect(() => {
    if (!voucherId) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // 1. Fetch Membership Tiers
    fetch(`${baseUrl}/api/admin/membership-tiers?limit=100`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setAvailableTiers(list);
      })
      .catch((err) => console.error('Error fetching tiers:', err));

    // 2. Fetch Voucher details
    setLoadingVoucher(true);
    fetch(`${baseUrl}/api/admin/promotions/vouchers/${voucherId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        const v = res?.data || res;
        if (v) {
          setVoucher(v);

          // Build smart prefilled notification messages
          const discountString = v.discountType === 'PERCENTAGE'
            ? `giảm ${v.discountValue}%${v.maxDiscount ? ` (tối đa ${Number(v.maxDiscount).toLocaleString('vi-VN')}đ)` : ''}`
            : `giảm ${Number(v.discountValue).toLocaleString('vi-VN')}đ`;

          const minOrderString = v.minOrderValue > 0
            ? ` cho đơn từ ${Number(v.minOrderValue).toLocaleString('vi-VN')}đ`
            : '';

          const endFormatted = v.endDate
            ? new Date(v.endDate).toLocaleDateString('vi-VN')
            : '';

          setTitle(`[AVORA] Tặng bạn mã ${v.code}: ${v.discountType === 'PERCENTAGE' ? `Giảm ${v.discountValue}%` : `Giảm ${Number(v.discountValue).toLocaleString('vi-VN')}đ`}`);
          setContent(`Nhập mã "${v.code}" để nhận ưu đãi ${discountString}${minOrderString}. HSD đến ${endFormatted}. Khám phá thực đơn và đặt bàn/giao món ngay cùng Avora Restaurant!`);
          setCustomEmailSubject(`[AVORA] Quà tặng đặc quyền: Mã ưu đãi ${v.code} - Giảm ngay trên toàn hệ thống`);
          setCustomEmailNote('Ưu đãi có thể áp dụng trực tiếp tại giỏ hàng hoặc đưa mã cho nhân viên phục vụ khi thanh toán tại nhà hàng.');

          // If voucher has pre-configured tiers, select them
          if (v.membershipTiers && v.membershipTiers.length > 0) {
            setSelectedTierIds(v.membershipTiers.map((t: any) => t.id));
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching voucher:', err);
        toast.error('Không thể tải thông tin voucher');
      })
      .finally(() => setLoadingVoucher(false));
  }, [voucherId]);

  // DEBOUNCED USER SEARCH
  useEffect(() => {
    if (targetType !== 'SPECIFIC_USERS') return;

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(
          `${baseUrl}/api/admin/promotions/vouchers/recipients/search?search=${encodeURIComponent(userSearchQuery)}`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
          setUserSearchResults(list);
        }
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [targetType, userSearchQuery]);

  // AUDIENCE PREVIEW FETCH
  useEffect(() => {
    if (!voucherId) return;

    const fetchPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${baseUrl}/api/admin/promotions/vouchers/${voucherId}/notify/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            targetType,
            targetTierIds: targetType === 'MEMBERSHIP_TIER' ? selectedTierIds : undefined,
            targetUserIds: targetType === 'SPECIFIC_USERS' ? selectedUsers.map((u) => u.id) : undefined,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          setAudiencePreview(json?.data || json);
        }
      } catch (err) {
        console.error('Error fetching audience preview:', err);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchPreview();
  }, [voucherId, targetType, selectedTierIds, selectedUsers]);

  // TOGGLE TIER SELECTION
  const handleToggleTier = (tierId: string) => {
    setSelectedTierIds((prev) =>
      prev.includes(tierId) ? prev.filter((id) => id !== tierId) : [...prev, tierId]
    );
  };

  // ADD SPECIFIC USER
  const handleAddUser = (user: UserSummary) => {
    if (!selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers((prev) => [...prev, user]);
    }
  };

  // REMOVE SPECIFIC USER
  const handleRemoveUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // HANDLE SEND CAMPAIGN
  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sendInApp && !sendEmail) {
      toast.error('Vui lòng chọn ít nhất một kênh gửi thông báo (In-App hoặc Email)');
      return;
    }

    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề thông báo');
      return;
    }

    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung thông báo');
      return;
    }

    if (targetType === 'MEMBERSHIP_TIER' && selectedTierIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 hạng thành viên nhận thông báo');
      return;
    }

    if (targetType === 'SPECIFIC_USERS' && selectedUsers.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 khách hàng cụ thể nhận thông báo');
      return;
    }

    const estimatedCount = audiencePreview?.estimatedRecipients ?? 0;
    const confirmMessage = isEn
      ? `Confirm broadcasting voucher notification to ${estimatedCount} customer(s)?`
      : `Xác nhận gửi thông báo voucher "${voucher?.code}" tới ước tính ${estimatedCount} khách hàng mục tiêu? Thao tác này sẽ gửi thông báo trực tiếp đến tài khoản người dùng.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsSending(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/admin/promotions/vouchers/${voucherId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          sendInApp,
          sendEmail,
          targetType,
          targetTierIds: targetType === 'MEMBERSHIP_TIER' ? selectedTierIds : undefined,
          targetUserIds: targetType === 'SPECIFIC_USERS' ? selectedUsers.map((u) => u.id) : undefined,
          customEmailSubject: customEmailSubject.trim() || undefined,
          customEmailNote: customEmailNote.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || 'Gửi chiến dịch thất bại');
      }

      toast.success(json.message || 'Đã phát hành thông báo thành công!');
      setSendResult(json.data || json);
    } catch (err: any) {
      console.error('Error sending voucher campaign:', err);
      toast.error(err.message || 'Có lỗi xảy ra khi gửi thông báo');
    } finally {
      setIsSending(false);
    }
  };

  // Helper values for display
  const discountLabel = useMemo(() => {
    if (!voucher) return '';
    return voucher.discountType === 'PERCENTAGE'
      ? `GIẢM ${voucher.discountValue}%`
      : `GIẢM ${Number(voucher.discountValue).toLocaleString('vi-VN')}đ`;
  }, [voucher]);

  const maxDiscountLabel = useMemo(() => {
    if (!voucher || !voucher.maxDiscount) return '';
    return `Tối đa ${Number(voucher.maxDiscount).toLocaleString('vi-VN')}đ`;
  }, [voucher]);

  const minOrderLabel = useMemo(() => {
    if (!voucher) return '';
    return voucher.minOrderValue > 0
      ? `Đơn từ ${Number(voucher.minOrderValue).toLocaleString('vi-VN')}đ`
      : 'Đơn từ 0đ';
  }, [voucher]);

  const endDateLabel = useMemo(() => {
    if (!voucher || !voucher.endDate) return '';
    return new Date(voucher.endDate).toLocaleDateString('vi-VN');
  }, [voucher]);

  if (loadingVoucher) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
        <p className="text-sm font-medium">Đang tải thông tin Voucher và cấu hình chiến dịch...</p>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không tìm thấy Voucher</h2>
        <p className="text-sm text-slate-500">Mã ưu đãi này có thể đã bị xóa hoặc bạn không có quyền truy cập.</p>
        <Link
          href="/admin/vouchers"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Quay lại Quản lý Vouchers</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/vouchers"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Quay lại Quản lý Vouchers</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 text-white flex items-center justify-center shadow-md">
              <Bell size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Gửi Thông Báo & Email Tiếp Thị Voucher</span>
                <span className="text-xs px-2.5 py-0.5 rounded-lg bg-red-100 text-red-700 font-mono font-bold tracking-wider">
                  {voucher.code}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Chủ động phát hành thông báo đẩy (Push/In-App) và Email Marketing để khách hàng không bỏ lỡ mã giảm giá.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/vouchers/${voucher.id}/edit`}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <Ticket size={14} />
            <span>Xem/Sửa Voucher</span>
          </Link>
        </div>
      </div>

      {/* 2. VOUCHER SUMMARY BADGE BANNER */}
      <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-6 -bottom-10 opacity-10 text-white pointer-events-none">
          <Ticket size={180} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs">
              <Sparkles size={12} />
              <span>Voucher Đang Áp Dụng</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
              <span>{voucher.title || 'Mã Ưu Đãi Avora'}</span>
            </h2>
            <p className="text-xs text-red-100 max-w-xl line-clamp-1">
              {voucher.description || 'Ưu đãi dành cho toàn thể quý khách hàng trải nghiệm ẩm thực tinh hoa.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20">
              <span className="text-[10px] uppercase font-bold text-red-200 block">Mức Giảm</span>
              <span className="text-base font-black text-white">{discountLabel}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20">
              <span className="text-[10px] uppercase font-bold text-red-200 block">Đơn Tối Thiểu</span>
              <span className="text-base font-black text-white">{minOrderLabel}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20">
              <span className="text-[10px] uppercase font-bold text-red-200 block">Hạn Sử Dụng</span>
              <span className="text-base font-black text-white">{endDateLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN WORKFLOW: 2 COLUMNS (FORM & LIVE PREVIEW) */}
      <form onSubmit={handleSendCampaign} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CAMPAIGN CONFIG (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* STEP 1: CHANNELS SELECTION */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <div className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs font-black">
                1
              </div>
              <span>Kênh Tiếp Thị & Phát Hành</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* In-App & Push Notification */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  sendInApp ? 'border-red-500 bg-red-50/50' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendInApp}
                  onChange={(e) => setSendInApp(e.target.checked)}
                  className="mt-1 w-4 h-4 text-red-600 rounded-md focus:ring-red-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-800">
                    <Bell size={15} className={sendInApp ? 'text-red-600' : 'text-slate-400'} />
                    <span>Thông Báo In-App & Web Push</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Đẩy tin nhắn chuông realtime đến khách hàng và lưu vào danh sách thông báo.
                  </p>
                </div>
              </label>

              {/* Email Marketing */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  sendEmail ? 'border-orange-500 bg-orange-50/50' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="mt-1 w-4 h-4 text-orange-600 rounded-md focus:ring-orange-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-800">
                    <Mail size={15} className={sendEmail ? 'text-orange-600' : 'text-slate-400'} />
                    <span>Email Marketing (Vé HTML)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Gửi thư điện tử định dạng vé ưu đãi kèm nút nhấn lưu mã trực tiếp vào ví.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* STEP 2: AUDIENCE TARGETING */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <div className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs font-black">
                  2
                </div>
                <span>Chọn Nhóm Khách Hàng Mục Tiêu</span>
              </div>

              {/* Realtime Audience Counter Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                <Users size={13} className="text-red-600" />
                <span>
                  {isLoadingPreview ? 'Đang tính...' : `Ước tính: ${audiencePreview?.estimatedRecipients ?? 0} khách`}
                </span>
              </div>
            </div>

            {/* Target Type Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              {/* Option 1: ALL */}
              <button
                type="button"
                onClick={() => setTargetType('ALL')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  targetType === 'ALL'
                    ? 'border-red-600 bg-red-50/60 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900">Tất Cả Khách Hàng</span>
                  {targetType === 'ALL' && <CheckCircle2 size={15} className="text-red-600" />}
                </div>
                <p className="text-[11px] text-slate-500">Toàn bộ khách hàng đang hoạt động</p>
              </button>

              {/* Option 2: MEMBERSHIP_TIER */}
              <button
                type="button"
                onClick={() => setTargetType('MEMBERSHIP_TIER')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  targetType === 'MEMBERSHIP_TIER'
                    ? 'border-red-600 bg-red-50/60 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900">Theo Hạng Thẻ</span>
                  {targetType === 'MEMBERSHIP_TIER' && <CheckCircle2 size={15} className="text-red-600" />}
                </div>
                <p className="text-[11px] text-slate-500">Đồng, Bạc, Vàng, Kim Cương...</p>
              </button>

              {/* Option 3: SPECIFIC_USERS */}
              <button
                type="button"
                onClick={() => setTargetType('SPECIFIC_USERS')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  targetType === 'SPECIFIC_USERS'
                    ? 'border-red-600 bg-red-50/60 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900">Khách Hàng Cụ Thể</span>
                  {targetType === 'SPECIFIC_USERS' && <CheckCircle2 size={15} className="text-red-600" />}
                </div>
                <p className="text-[11px] text-slate-500">Tìm kiếm & chỉ định tài khoản</p>
              </button>
            </div>

            {/* EXPANDABLE SECTION FOR MEMBERSHIP TIERS */}
            {targetType === 'MEMBERSHIP_TIER' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Crown size={14} className="text-amber-500" />
                    <span>Chọn các hạng thẻ thành viên muốn gửi:</span>
                  </span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTierIds(availableTiers.map((t) => t.id))}
                      className="text-[11px] text-red-600 font-bold hover:underline cursor-pointer"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTierIds([])}
                      className="text-[11px] text-slate-500 font-bold hover:underline cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {availableTiers.map((tier) => {
                    const isSelected = selectedTierIds.includes(tier.id);
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => handleToggleTier(tier.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Crown size={13} className={isSelected ? 'text-amber-300' : 'text-slate-400'} />
                        <span>{tier.name}</span>
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EXPANDABLE SECTION FOR SPECIFIC USERS SEARCH */}
            {targetType === 'SPECIFIC_USERS' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-200">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Tìm theo Tên, Email hoặc Số điện thoại khách hàng..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {isSearchingUsers && (
                    <RefreshCw size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                </div>

                {/* Search suggestions dropdown list */}
                {userSearchResults.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto divide-y divide-slate-100 shadow-sm">
                    {userSearchResults.map((u) => {
                      const isAdded = selectedUsers.some((sel) => sel.id === u.id);
                      return (
                        <div
                          key={u.id}
                          className="py-2 px-2.5 flex items-center justify-between hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                              {u.fullName?.charAt(0) || <UserIcon size={13} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>{u.fullName || 'Khách hàng'}</span>
                                {u.membershipTier && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    {u.membershipTier.name}
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {u.email || 'Chưa có email'} {u.phone ? `• ${u.phone}` : ''}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => (isAdded ? handleRemoveUser(u.id) : handleAddUser(u))}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              isAdded
                                ? 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                          >
                            {isAdded ? 'Đã chọn' : '+ Thêm'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected Users Chips */}
                {selectedUsers.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Đã chọn ({selectedUsers.length} người nhận):
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {selectedUsers.map((u) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs"
                        >
                          <span className="font-bold">{u.fullName || u.email || u.phone}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveUser(u.id)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 3: CONTENT COMPOSER */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <div className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs font-black">
                3
              </div>
              <span>Nội Dung Thông Báo</span>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Tiêu đề thông báo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề thông báo..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>

            {/* In-App / Push Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  Nội dung tóm tắt (In-App & Push) <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">{content.length} ký tự</span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="Nhập nội dung ngắn hiển thị trên thông báo đẩy và chuông in-app..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
                required
              />
            </div>

            {/* Email Specific Extra Options */}
            {sendEmail && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-orange-700">
                  <Mail size={13} />
                  <span>Tùy biến nội dung Email Marketing</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Tiêu đề hòm thư (Email Subject)
                  </label>
                  <input
                    type="text"
                    value={customEmailSubject}
                    onChange={(e) => setCustomEmailSubject(e.target.value)}
                    placeholder="Để trống nếu muốn dùng tiêu đề mặc định..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Ghi chú bổ sung trong email (Lưu ý nhà hàng)
                  </label>
                  <input
                    type="text"
                    value={customEmailNote}
                    onChange={(e) => setCustomEmailNote(e.target.value)}
                    placeholder="Ví dụ: Áp dụng cả các ngày lễ tết, ưu tiên đặt bàn trước..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ACTION BUTTON: SEND CAMPAIGN */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <Link
              href="/admin/vouchers"
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              Hủy bỏ
            </Link>

            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Đang gửi chiến dịch...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>
                    Gửi Thông Báo Tới {audiencePreview?.estimatedRecipients ?? 0} Khách Hàng
                  </span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: LIVE INTERACTIVE PREVIEW (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20 space-y-4">
            
            {/* Live Preview Card Header */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                  <Eye size={16} className="text-red-600" />
                  <span>Xem Trước Trực Quan (Live Preview)</span>
                </div>

                {/* Toggle Mode Tabs */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('PUSH')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      previewMode === 'PUSH'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Smartphone size={13} />
                    <span>In-App/Push</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('EMAIL')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      previewMode === 'EMAIL'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Mail size={13} />
                    <span>Email Vé</span>
                  </button>
                </div>
              </div>

              {/* AUDIENCE STATS SUMMARY BOX */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Tiếp cận In-App</span>
                  <span className="text-sm font-black text-slate-800">
                    {audiencePreview?.estimatedRecipients ?? 0} tài khoản
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Địa chỉ Email</span>
                  <span className="text-sm font-black text-slate-800">
                    {audiencePreview?.emailRecipients ?? 0} hộp thư
                  </span>
                </div>
              </div>
            </div>

            {/* PREVIEW CONTAINER 1: SMARTPHONE IN-APP / PUSH PREVIEW */}
            {previewMode === 'PUSH' && (
              <div className="bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-2xl border-4 border-slate-800 text-white max-w-sm mx-auto animate-in fade-in duration-300">
                {/* Phone Speaker & Camera Notch */}
                <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-4"></div>

                {/* Status Bar */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-6 px-2">
                  <span>09:41</span>
                  <div className="flex items-center gap-1">
                    <span>5G</span>
                    <div className="w-4 h-2 border border-slate-400 rounded-xs flex items-center p-0.5">
                      <div className="w-full h-full bg-slate-400"></div>
                    </div>
                  </div>
                </div>

                {/* NOTIFICATION CARD BUBBLE */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-3.5 rounded-2xl shadow-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-red-600 text-white flex items-center justify-center font-bold text-[10px]">
                        A
                      </div>
                      <span className="font-bold text-white tracking-tight">Avora Restaurant</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Vừa xong</span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-black text-white line-clamp-1">
                      {title || 'Tiêu đề thông báo voucher...'}
                    </p>
                    <p className="text-[11px] text-slate-200 line-clamp-3 leading-relaxed">
                      {content || 'Nội dung thông báo ưu đãi gửi tới khách hàng...'}
                    </p>
                  </div>

                  <div className="pt-1.5 flex items-center justify-between border-t border-white/10">
                    <span className="text-[10px] font-mono text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/60">
                      CODE: {voucher.code}
                    </span>
                    <span className="text-[10px] font-bold text-white flex items-center gap-0.5">
                      <span>Mở ví voucher</span>
                      <ChevronRight size={10} />
                    </span>
                  </div>
                </div>

                {/* In-app simulated bottom bar */}
                <div className="mt-8 text-center">
                  <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto"></div>
                </div>
              </div>
            )}

            {/* PREVIEW CONTAINER 2: EMAIL MARKETING TICKET PREVIEW */}
            {previewMode === 'EMAIL' && (
              <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 shadow-md animate-in fade-in duration-300">
                <div className="bg-white rounded-xl overflow-hidden shadow-xs border border-slate-200 text-slate-800 text-xs">
                  
                  {/* Email Mock Header */}
                  <div className="bg-gradient-to-r from-red-700 to-red-600 p-4 text-center text-white space-y-1">
                    <span className="text-[9px] font-extrabold tracking-widest uppercase bg-white/20 px-2 py-0.5 rounded-full inline-block">
                      AVORA RESTAURANT
                    </span>
                    <h3 className="text-sm font-black tracking-tight">QUÀ TẶNG ƯU ĐÃI ĐẶC BIỆT</h3>
                    <p className="text-[10px] text-red-100">Dành riêng cho bạn</p>
                  </div>

                  {/* Greeting & message */}
                  <div className="p-3.5 space-y-1 text-[11px]">
                    <p className="font-bold text-slate-900">Xin chào Quý khách,</p>
                    <p className="text-slate-600 leading-relaxed line-clamp-2">
                      {content || 'Nội dung thông báo ưu đãi...'}
                    </p>
                  </div>

                  {/* Voucher Ticket Cutout */}
                  <div className="px-3.5 pb-2">
                    <div className="bg-gradient-to-br from-amber-50 to-red-50 border-2 border-dashed border-red-300 rounded-xl p-3 text-center space-y-1">
                      <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider block">
                        {voucher.title || 'MÃ ƯU ĐÃI'}
                      </span>
                      <p className="text-xl font-black text-red-700">{discountLabel}</p>
                      {maxDiscountLabel && (
                        <p className="text-[10px] font-bold text-orange-600">{maxDiscountLabel}</p>
                      )}

                      {/* Code Box */}
                      <div className="inline-block bg-white border border-red-400 rounded-lg px-3 py-1 my-1">
                        <span className="font-mono text-sm font-black text-red-600 tracking-wider">
                          {voucher.code}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 pt-1 border-t border-dashed border-red-200 space-y-0.5">
                        <p>• {minOrderLabel}</p>
                        <p>• HSD đến: {endDateLabel}</p>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="p-3.5 text-center">
                    <div className="inline-block bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs">
                      LƯU VÀO VÍ & DÙNG NGAY →
                    </div>
                  </div>

                  {/* Mock Footer */}
                  <div className="bg-slate-50 p-2.5 text-center text-[9px] text-slate-400 border-t border-slate-100">
                    Hệ thống nhà hàng Avora Restaurant • Hotline 1900 6868
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </form>

      {/* 4. SUCCESS RESULT MODAL */}
      {sendResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 size={32} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900">Chiến Dịch Đã Được Gửi Đi!</h3>
              <p className="text-xs text-slate-500">
                Thông báo voucher đã được chuyển phát thành công tới các kênh tiếp thị được chọn.
              </p>
            </div>

            {/* Statistics */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tổng khách hàng mục tiêu:</span>
                <span className="font-bold text-slate-800">{sendResult.totalRecipients || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Thông báo In-App đã gửi:</span>
                <span className="font-bold text-emerald-600">{sendResult.sentInAppCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email Marketing đã gửi:</span>
                <span className="font-bold text-emerald-600">{sendResult.sentEmailCount || 0}</span>
              </div>
              {sendResult.failedInAppCount > 0 || sendResult.failedEmailCount > 0 ? (
                <div className="flex items-center justify-between text-rose-600 font-bold pt-1 border-t border-slate-200">
                  <span>Gửi thất bại:</span>
                  <span>{(sendResult.failedInAppCount || 0) + (sendResult.failedEmailCount || 0)}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/vouchers"
                className="flex-1 py-2.5 text-center text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Về danh sách Voucher
              </Link>
              <button
                type="button"
                onClick={() => setSendResult(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
