'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  ArrowLeft,
  Users,
  Send,
  ShieldCheck,
  Store,
  Crown,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Search,
  User as UserIcon,
  X,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface AudiencePreview {
  estimatedRecipients: number;
  targetType: string;
  selectedBranches: { id: string; name: string; branchCode?: string }[];
  selectedMembershipTiers: { id: string; name: string }[];
  selectedUsers: { id: string; fullName?: string; email?: string }[];
}

export default function ArticleNotificationPage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params?.id as string;
  const { locale } = useLanguage();
  const isEn = locale === 'en';

  const [article, setArticle] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sendPush, setSendPush] = useState(true);
  const [sendInApp, setSendInApp] = useState(true);

  // Target type: ALL | MEMBERSHIP_TIER | BRANCH | BRANCH_AND_TIER | SPECIFIC_USERS
  const [targetType, setTargetType] = useState('ALL');

  // Available metadata
  const [availableTiers, setAvailableTiers] = useState<any[]>([]);
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>([]);

  const [availableBranches, setAvailableBranches] = useState<any[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  // Specific user search
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // 1. Fetch available Membership Tiers and Branches
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Fetch Tiers
    fetch(`${baseUrl}/api/admin/membership-tiers?limit=100`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setAvailableTiers(list);
      })
      .catch(() => {});

    // Fetch Branches
    fetch(`${baseUrl}/api/admin/branches`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setAvailableBranches(list);
      })
      .catch(() => {});
  }, []);

  // 2. Fetch article details
  useEffect(() => {
    if (!articleId) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${baseUrl}/api/admin/articles/${articleId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const art = data?.data || data;
        if (art) {
          setArticle(art);
          setTitle(`[AVORA] ${art.title}`);
          setBody(art.excerpt || `Đọc ngay bài viết "${art.title}" với nhiều thông tin hấp dẫn!`);
          setImageUrl(art.coverImageUrl || art.coverImage || art.thumbnailUrl || '');
          setCampaigns(art.campaigns || art.notificationCampaigns || []);

          // Pre-select article tiers and branches if available
          if (art.membershipTiers && art.membershipTiers.length > 0) {
            setSelectedTierIds(art.membershipTiers.map((t: any) => t.id || t.membershipTierId));
          }
          if (art.branches && art.branches.length > 0) {
            setSelectedBranchIds(art.branches.map((b: any) => b.id || b.branchId));
          }
        }
      })
      .catch(() => {});
  }, [articleId]);

  // 3. User search handler with debounce
  useEffect(() => {
    if (targetType !== 'SPECIFIC_USERS') return;

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(
          `${baseUrl}/api/admin/users?limit=30&search=${encodeURIComponent(userSearchQuery)}`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
          setUserSearchResults(list);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [targetType, userSearchQuery]);

  // 4. Fetch Audience Preview whenever targeting changes
  useEffect(() => {
    if (!articleId) return;

    const fetchPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(
          `${baseUrl}/api/admin/articles/${articleId}/notification-audience-preview`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              targetType,
              targetTierIds:
                targetType === 'MEMBERSHIP_TIER' || targetType === 'BRANCH_AND_TIER'
                  ? selectedTierIds
                  : undefined,
              targetBranchIds:
                targetType === 'BRANCH' || targetType === 'BRANCH_AND_TIER'
                  ? selectedBranchIds
                  : undefined,
              targetUserIds:
                targetType === 'SPECIFIC_USERS' ? selectedUsers.map((u) => u.id) : undefined,
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          setAudiencePreview(data?.data || data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchPreview();
  }, [articleId, targetType, selectedTierIds, selectedBranchIds, selectedUsers]);

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error(
        isEn
          ? 'Please enter notification title and content'
          : 'Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo'
      );
      return;
    }

    if (
      (targetType === 'MEMBERSHIP_TIER' || targetType === 'BRANCH_AND_TIER') &&
      selectedTierIds.length === 0
    ) {
      toast.error(
        isEn
          ? 'Please select at least 1 membership tier'
          : 'Vui lòng chọn ít nhất 1 hạng thẻ thành viên'
      );
      return;
    }

    if (
      (targetType === 'BRANCH' || targetType === 'BRANCH_AND_TIER') &&
      selectedBranchIds.length === 0
    ) {
      toast.error(isEn ? 'Please select at least 1 branch' : 'Vui lòng chọn ít nhất 1 chi nhánh');
      return;
    }

    if (targetType === 'SPECIFIC_USERS' && selectedUsers.length === 0) {
      toast.error(
        isEn
          ? 'Please select at least 1 individual recipient'
          : 'Vui lòng chọn ít nhất 1 cá nhân nhận thông báo'
      );
      return;
    }

    const count = audiencePreview?.estimatedRecipients ?? 0;
    if (
      !window.confirm(
        isEn
          ? `Confirm broadcasting notification to estimated ${count} customers? This action cannot be undone.`
          : `Xác nhận gửi thông báo tới ước tính ${count} khách hàng? Thao tác này không thể hoàn tác.`
      )
    ) {
      return;
    }

    setIsSending(true);
    // Generate idempotency key
    const idempotencyKey = `camp_${articleId}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/admin/articles/${articleId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          content: body.trim(),
          imageUrl: imageUrl.trim() || undefined,
          targetType,
          targetTierIds:
            targetType === 'MEMBERSHIP_TIER' || targetType === 'BRANCH_AND_TIER'
              ? selectedTierIds
              : undefined,
          targetBranchIds:
            targetType === 'BRANCH' || targetType === 'BRANCH_AND_TIER'
              ? selectedBranchIds
              : undefined,
          targetUserIds:
            targetType === 'SPECIFIC_USERS' ? selectedUsers.map((u) => u.id) : undefined,
          sendPush,
          sendInApp,
          idempotencyKey,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData?.error?.message || errData?.message || (isEn ? 'Cannot send campaign' : 'Không thể gửi chiến dịch'));
        return;
      }

      const data = await res.json();
      toast.success(
        isEn
          ? `Campaign broadcasted successfully to ${data?.data?.recipientCount || count} customers!`
          : `Chiến dịch đã gửi thành công tới ${data?.data?.recipientCount || count} khách hàng!`
      );
      router.push(`/admin/articles/${articleId}`);
    } catch (err) {
      console.error(err);
      toast.error(isEn ? 'Error sending notification' : 'Lỗi khi gửi thông báo');
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/articles/${articleId}`}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Bell size={20} className="text-red-600" />
              {isEn ? 'Article Push Notification Campaign' : 'Chiến Dịch Gửi Thông Báo Bài Viết'}
            </h1>
            <p className="text-xs text-slate-500">
              {isEn
                ? 'Broadcast push & in-app notifications to targeted customer segments'
                : 'Gửi thông báo đẩy và thông báo ứng dụng tới đúng nhóm khách hàng mục tiêu'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* ── LEFT: FORM ── */}
        <div className="md:col-span-7 space-y-6">
          <form
            onSubmit={handleSendCampaign}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4"
          >
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">
              {isEn ? 'Notification Details' : 'Nội dung thông báo'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {isEn ? 'Notification Title' : 'Tiêu đề thông báo'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isEn ? 'e.g. [AVORA] Special promotion today only!' : 'VD: [AVORA] Khuyến mãi đặc biệt chỉ hôm nay!'}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {isEn ? 'Detailed Message' : 'Nội dung chi tiết'} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={isEn ? 'Notification message displayed on devices...' : 'Nội dung hiển thị trên thông báo...'}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {isEn ? 'Thumbnail Image (Optional)' : 'Ảnh minh họa (Tùy chọn)'}
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder={isEn ? 'https://... (Image thumbnail URL)' : 'https://... (URL ảnh thumbnail)'}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Target Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {isEn ? 'Target Audience' : 'Nhóm khách hàng nhận'}
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 font-semibold"
              >
                <option value="ALL">{isEn ? 'All Customers (System-wide)' : 'Tất cả khách hàng (Toàn hệ thống)'}</option>
                <option value="MEMBERSHIP_TIER">{isEn ? 'By Membership Tier' : 'Theo hạng thẻ thành viên'}</option>
                <option value="BRANCH">{isEn ? 'By Branch' : 'Theo chi nhánh'}</option>
                <option value="BRANCH_AND_TIER">{isEn ? 'Combined Branch & Membership Tier' : 'Kết hợp chi nhánh & hạng thẻ'}</option>
                <option value="SPECIFIC_USERS">{isEn ? 'Specific Individual Users' : 'Gửi cho cá nhân cụ thể'}</option>
              </select>
            </div>

            {/* ── TIER SELECTOR (Khi chọn MEMBERSHIP_TIER hoặc BRANCH_AND_TIER) ── */}
            {(targetType === 'MEMBERSHIP_TIER' || targetType === 'BRANCH_AND_TIER') && (
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Crown size={15} className="text-amber-600" /> {isEn ? 'Select membership tiers to notify:' : 'Chọn hạng thẻ nhận thông báo:'}
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedTierIds(availableTiers.map((t) => t.id))}
                      className="text-amber-800 hover:underline font-bold"
                    >
                      {isEn ? 'Select all' : 'Chọn tất cả'}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTierIds([])}
                      className="text-slate-500 hover:underline"
                    >
                      {isEn ? 'Deselect' : 'Bỏ chọn'}
                    </button>
                  </div>
                </div>

                {availableTiers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">{isEn ? 'Loading membership tiers...' : 'Đang tải danh sách hạng thẻ...'}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {availableTiers.map((tier) => {
                      const isChecked = selectedTierIds.includes(tier.id);
                      return (
                        <label
                          key={tier.id}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-amber-100/90 border-amber-400 text-amber-950 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedTierIds((prev) =>
                                prev.includes(tier.id)
                                  ? prev.filter((id) => id !== tier.id)
                                  : [...prev, tier.id]
                              );
                            }}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>{tier.name}</span>
                          {tier.discountPercent ? (
                            <span className="text-[10px] text-amber-700 bg-white/90 px-1 py-0.5 rounded ml-auto">
                              -{tier.discountPercent}%
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="text-[11px] text-amber-800/80 font-medium">
                  {isEn
                    ? `Selected ${selectedTierIds.length}/${availableTiers.length} tiers.`
                    : `Đã chọn ${selectedTierIds.length}/${availableTiers.length} hạng thẻ.`}
                </div>
              </div>
            )}

            {/* ── BRANCH SELECTOR (Khi chọn BRANCH hoặc BRANCH_AND_TIER) ── */}
            {(targetType === 'BRANCH' || targetType === 'BRANCH_AND_TIER') && (
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Store size={15} className="text-emerald-600" /> {isEn ? 'Select branches to notify:' : 'Chọn chi nhánh nhận thông báo:'}
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedBranchIds(availableBranches.map((b) => b.id))}
                      className="text-emerald-800 hover:underline font-bold"
                    >
                      {isEn ? 'Select all' : 'Chọn tất cả'}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedBranchIds([])}
                      className="text-slate-500 hover:underline"
                    >
                      {isEn ? 'Deselect' : 'Bỏ chọn'}
                    </button>
                  </div>
                </div>

                {availableBranches.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">{isEn ? 'Loading branches...' : 'Đang tải danh sách chi nhánh...'}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableBranches.map((branch) => {
                      const isChecked = selectedBranchIds.includes(branch.id);
                      return (
                        <label
                          key={branch.id}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedBranchIds((prev) =>
                                prev.includes(branch.id)
                                  ? prev.filter((id) => id !== branch.id)
                                  : [...prev, branch.id]
                              );
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="truncate">{branch.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="text-[11px] text-emerald-800/80 font-medium">
                  {isEn
                    ? `Selected ${selectedBranchIds.length}/${availableBranches.length} branches.`
                    : `Đã chọn ${selectedBranchIds.length}/${availableBranches.length} chi nhánh.`}
                </div>
              </div>
            )}

            {/* ── SPECIFIC USERS SELECTOR (Khi chọn SPECIFIC_USERS) ── */}
            {targetType === 'SPECIFIC_USERS' && (
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <UserIcon size={15} className="text-blue-600" /> {isEn ? 'Select individual recipients:' : 'Chọn cá nhân nhận thông báo:'}
                  </span>
                  {selectedUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedUsers([])}
                      className="text-[11px] text-red-600 hover:underline font-bold"
                    >
                      {isEn ? `Clear all (${selectedUsers.length})` : `Xóa tất cả (${selectedUsers.length})`}
                    </button>
                  )}
                </div>

                {/* Selected users chips */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-white rounded-xl border border-blue-100">
                    {selectedUsers.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs font-bold shadow-2xs"
                      >
                        <span className="truncate max-w-[130px]">{u.fullName || u.email}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedUsers((prev) => prev.filter((x) => x.id !== u.id))}
                          className="hover:text-red-600 ml-0.5 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* User search input */}
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder={isEn ? 'Type name, email, or phone to search...' : 'Gõ tên, email hoặc SĐT để tìm khách hàng...'}
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                {/* User search results list */}
                <div className="max-h-48 overflow-y-auto space-y-1 bg-white p-2 rounded-xl border border-slate-200">
                  {isSearchingUsers ? (
                    <div className="py-4 text-center text-xs text-slate-400">{isEn ? 'Searching...' : 'Đang tìm kiếm...'}</div>
                  ) : userSearchResults.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      {userSearchQuery
                        ? (isEn ? 'No matching users found' : 'Không tìm thấy người dùng phù hợp')
                        : (isEn ? 'Type keywords to search...' : 'Gõ từ khóa để tìm kiếm...')}
                    </div>
                  ) : (
                    userSearchResults.map((u) => {
                      const isSelected = selectedUsers.some((x) => x.id === u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSelectedUsers((prev) =>
                              isSelected ? prev.filter((x) => x.id !== u.id) : [...prev, u]
                            );
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50 text-blue-900 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} className="w-full h-full object-cover" />
                              ) : (
                                u.fullName?.[0] || 'U'
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{u.fullName || (isEn ? 'Unnamed' : 'Chưa đặt tên')}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {u.email} {u.phone ? `· ${u.phone}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 ml-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isSelected ? (isEn ? 'Selected' : 'Đã chọn') : (isEn ? '+ Select' : '+ Chọn')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="text-[11px] text-blue-800/80 font-medium">
                  {isEn
                    ? `Selected ${selectedUsers.length} individual recipients.`
                    : `Đã chọn ${selectedUsers.length} khách hàng nhận thông báo.`}
                </div>
              </div>
            )}

            {/* Notification Channels */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendInApp}
                  onChange={(e) => setSendInApp(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>{isEn ? 'In-app Inbox' : 'Hộp thư ứng dụng (In-app)'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendPush}
                  onChange={(e) => setSendPush(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Push Notification</span>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={isSending || isLoadingPreview}
                className="w-full py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Send size={16} />
                <span>{isSending ? (isEn ? 'Sending notification...' : 'Đang gửi thông báo...') : (isEn ? 'Confirm & Send Broadcast' : 'Xác nhận gửi thông báo ngay')}</span>
              </button>
            </div>
          </form>
        </div>

        {/* ── RIGHT: AUDIENCE PREVIEW (REAL DB COUNTS) ── */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Users size={18} className="text-red-600" /> {isEn ? 'Audience Estimation' : 'Ước tính người nhận'}
            </h3>

            {isLoadingPreview ? (
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                {isEn ? 'Calculating recipient audience from DB...' : 'Đang tính toán tập người nhận từ DB...'}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50/70 p-4 rounded-2xl border border-red-100 text-center">
                  <span className="text-xs font-semibold text-slate-500 block">
                    {isEn ? 'Estimated Recipients' : 'Số lượng người nhận dự kiến'}
                  </span>
                  <span className="text-3xl font-black text-red-600 mt-1 block">
                    {audiencePreview?.estimatedRecipients?.toLocaleString('vi-VN') ?? 0}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {isEn ? 'Eligible customers to receive notification' : 'Khách hàng đủ điều kiện nhận thông báo'}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-blue-500" /> {isEn ? 'Delivery Mechanism:' : 'Cơ chế gửi:'}
                    </span>
                    <span className="font-semibold text-slate-800">{isEn ? 'Deduplicated (Idempotent)' : 'Chống trùng lặp (Idempotent)'}</span>
                  </div>

                  {audiencePreview?.selectedBranches && audiencePreview.selectedBranches.length > 0 && (
                    <div className="text-slate-600">
                      <span className="flex items-center gap-1.5 mb-1 font-bold">
                        <Store size={14} className="text-emerald-500" /> {isEn ? 'Filtered Branches:' : 'Chi nhánh lọc:'}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {audiencePreview.selectedBranches.map((b) => (
                          <span
                            key={b.id}
                            className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded"
                          >
                            {b.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {audiencePreview?.selectedMembershipTiers &&
                    audiencePreview.selectedMembershipTiers.length > 0 && (
                      <div className="text-slate-600">
                        <span className="flex items-center gap-1.5 mb-1 font-bold">
                          <Crown size={14} className="text-amber-500" /> {isEn ? 'Filtered Tiers:' : 'Hạng thẻ lọc:'}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {audiencePreview.selectedMembershipTiers.map((t) => (
                            <span
                              key={t.id}
                              className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {audiencePreview?.selectedUsers && audiencePreview.selectedUsers.length > 0 && (
                    <div className="text-slate-600">
                      <span className="flex items-center gap-1.5 mb-1 font-bold">
                        <UserIcon size={14} className="text-blue-500" /> {isEn ? 'Selected Users:' : 'Cá nhân được chọn:'}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {audiencePreview.selectedUsers.map((u) => (
                          <span
                            key={u.id}
                            className="bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded"
                          >
                            {u.fullName || u.email}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Past Campaigns */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs space-y-3">
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <History size={14} className="text-slate-400" /> {isEn ? 'Campaign History' : 'Lịch sử gửi bài này'} ({campaigns.length})
            </h4>

            {campaigns.length === 0 ? (
              <p className="text-xs text-slate-400 italic">{isEn ? 'No notifications sent for this article yet.' : 'Chưa từng gửi thông báo cho bài này.'}</p>
            ) : (
              <div className="space-y-2">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate max-w-[160px]">
                        {c.title}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                      <span>{formatDate(c.createdAt)}</span>
                      <span>{c.recipientCount || c.totalRecipients || 0} {isEn ? 'recipients' : 'người nhận'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
