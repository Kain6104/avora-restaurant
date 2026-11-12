'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  User, 
  Gift, 
  Coins, 
  Loader2, 
  Utensils, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Edit3, 
  ShieldCheck,
  History,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import Image from 'next/image';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useWaiterStore } from '@/store/useWaiterStore';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { CreateCustomerModal } from '@/components/pos/CreateCustomerModal';

interface RedeemPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onAppliedSuccess?: () => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RedeemPointsModal({
  isOpen,
  onClose,
  order,
  onAppliedSuccess,
}: RedeemPointsModalProps) {
  const activeBranchId = useWaiterStore((s) => s.activeBranchId);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isChangingUser, setIsChangingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [redeemingProductId, setRedeemingProductId] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<any | null>(null);

  // States for Add Customer Modal (Sử dụng chung CreateCustomerModal chuẩn như màn thanh toán)
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // States for Edit Member Modal
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberPhone, setEditMemberPhone] = useState('');
  const [editMemberEmail, setEditMemberEmail] = useState('');

  // States for Customer Point History Modal
  const [isPointHistoryOpen, setIsPointHistoryOpen] = useState(false);
  const [pointHistory, setPointHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Check if order already has redeemed points
  const hasRedeemedPoints = Boolean(
    (order?.pointsUsed && order.pointsUsed > 0) ||
      order?.orderItems?.some(
        (it: any) =>
          it.priceAtSale === 0 &&
          (it.discountReason?.includes('đổi điểm') || it.discountReason?.includes('Đổi điểm')),
      ),
  );

  // Sync selectedUser from order
  useEffect(() => {
    if (order?.user) {
      setSelectedUser(order.user);
    } else if (order?.userId) {
      fetch(`/api/pos/members/search?query=${encodeURIComponent(order.customerPhone || order.customerName || '')}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.length > 0) {
            const found = res.data.find((u: any) => u.id === order.userId) || res.data[0];
            setSelectedUser(found);
          }
        })
        .catch(() => {});
    }
  }, [order]);

  // Fetch redeemable rewards catalog with branch scope
  const effectiveBranchId = order?.branchId || activeBranchId;
  const { data: rewardsResponse, isLoading: isLoadingRewards, mutate: refreshRewards } = useSWR(
    isOpen ? `/api/pos/rewards${effectiveBranchId ? `?branchId=${effectiveBranchId}` : ''}` : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  const rewards = rewardsResponse?.data || [];

  // Search members
  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/pos/members/search?query=${encodeURIComponent(val.trim())}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSearchResults(data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = async (user: any) => {
    if (hasRedeemedPoints) {
      toast.error('Đơn hàng này đã đổi điểm thưởng, không thể thay đổi hội viên!');
      return;
    }
    setSelectedUser(user);
    setIsChangingUser(false);
    setSearchQuery('');
    setSearchResults([]);

    // Nếu đơn chưa lưu xuống DB (đơn tạm thời TMP- hoặc OFF-)
    if (order?.id && (order.id.startsWith('TMP-') || order.id.startsWith('OFF-') || (!order.id.includes('-') && order.id.length < 20))) {
      if (order) {
        order.user = user;
        order.userId = user.id;
        order.customerName = user.fullName;
        order.customerPhone = user.phone;
      }
      refreshRewards();
      toast.success(`Đã chọn thành viên ${user.fullName}`);
      onAppliedSuccess?.();
      return;
    }

    // Đơn đã lưu trong DB
    if (order?.id) {
      try {
        const res = await fetch(`/api/pos/orders/${order.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: user.id,
            customerName: user.fullName,
            customerPhone: user.phone || undefined,
          }),
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          toast.success(`Đã gắn khách hàng ${user.fullName} vào đơn`);
          refreshRewards();
          onAppliedSuccess?.();
        } else {
          refreshRewards();
          toast.success(`Đã chọn thành viên ${user.fullName}`);
          onAppliedSuccess?.();
        }
      } catch {
        refreshRewards();
        toast.success(`Đã chọn thành viên ${user.fullName}`);
      }
    }
  };

  const handleRemoveUser = async () => {
    if (hasRedeemedPoints) {
      toast.error('Đơn hàng này đã đổi điểm thưởng, không thể gỡ hội viên!');
      return;
    }
    setSelectedUser(null);
    setIsChangingUser(false);

    if (order?.id && (order.id.startsWith('TMP-') || order.id.startsWith('OFF-') || (!order.id.includes('-') && order.id.length < 20))) {
      if (order) {
        order.user = null;
        order.userId = null;
        order.customerName = null;
        order.customerPhone = null;
      }
      refreshRewards();
      toast.success('Đã gỡ khách hàng khỏi đơn');
      onAppliedSuccess?.();
      return;
    }

    if (order?.id) {
      try {
        const res = await fetch(`/api/pos/orders/${order.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: null,
            customerName: null,
            customerPhone: null,
          }),
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          toast.success('Đã gỡ khách hàng khỏi đơn');
          refreshRewards();
          onAppliedSuccess?.();
        }
      } catch {
        refreshRewards();
      }
    }
  };

  // Mở modal sửa thông tin hội viên
  const handleOpenEditMember = (u: any) => {
    if (!u) return;
    setEditMemberName(u.fullName || '');
    setEditMemberPhone(u.phone || '');
    setEditMemberEmail(u.email || '');
    setIsEditMemberOpen(true);
  };

  // Lưu sửa thông tin hội viên
  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser?.id) return;
    if (!editMemberName.trim()) {
      toast.error('Họ tên không được để trống');
      return;
    }
    if (!editMemberPhone.trim()) {
      toast.error('Số điện thoại không được để trống');
      return;
    }

    setIsUpdatingMember(true);
    try {
      const res = await fetch(`/api/pos/members/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: editMemberName.trim(),
          phone: editMemberPhone.trim(),
          email: editMemberEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể cập nhật thông tin hội viên');
      }
      toast.success('Cập nhật thông tin hội viên thành công!');
      setSelectedUser(data.data);
      setIsEditMemberOpen(false);
      onAppliedSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật hội viên');
    } finally {
      setIsUpdatingMember(false);
    }
  };

  // Mở modal lịch sử điểm
  const handleOpenPointHistory = async () => {
    if (!selectedUser?.id) return;
    setIsPointHistoryOpen(true);
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/pos/members/${selectedUser.id}/point-history`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPointHistory(json.data || []);
      } else {
        setPointHistory([]);
      }
    } catch {
      setPointHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const userPoints = selectedUser?.points ?? selectedUser?.currentPoints ?? 0;

  // Prompt confirmation dialog
  const handlePromptConfirm = (item: any) => {
    if (!selectedUser) {
      toast.error('Vui lòng chọn thành viên');
      return;
    }

    if (userPoints < (item.redemptionPoints || 0)) {
      toast.error(
        `Khách hàng hiện có ${userPoints.toLocaleString('vi-VN')} điểm, không đủ ${item.redemptionPoints.toLocaleString('vi-VN')} điểm để đổi món này.`,
      );
      return;
    }

    setConfirmItem(item);
  };

  // Execute redeem after confirmation
  const handleExecuteRedeem = async (item: any) => {
    if (!order?.id || !selectedUser || !item) return;

    setRedeemingProductId(item.id);
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/redeem-reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: item.id,
          userId: selectedUser.id,
          quantity: 1,
        }),
      });

      const resData = await res.json();
      if (resData.success) {
        toast.success(`Đã đổi thành công món "${item.name}"!`);
        // Deduct points locally for smooth UX
        setSelectedUser((prev: any) =>
          prev
            ? {
                ...prev,
                points: Math.max(0, (prev.points ?? prev.currentPoints ?? 0) - item.redemptionPoints),
                currentPoints: Math.max(0, (prev.currentPoints ?? prev.points ?? 0) - item.redemptionPoints),
              }
            : null,
        );
        setConfirmItem(null);
        refreshRewards();
        onAppliedSuccess?.();
      } else {
        toast.error(resData.message || 'Đổi điểm thất bại');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setRedeemingProductId(null);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <>
      <ResponsiveModal
        isOpen={isOpen}
        onClose={onClose}
        title="Đổi Điểm Thưởng"
        subtitle="Sử dụng điểm tích lũy thành viên để đổi món quà tặng"
        icon={<Gift size={18} className="text-amber-600" />}
        maxWidth="md"
      >
        <div className="space-y-4 py-1">
          {/* Member Section */}
          {selectedUser && !isChangingUser ? (
            /* Member Card */
            <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* User Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#1A73E8] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <User size={20} className="stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm leading-tight truncate">
                    {selectedUser.fullName || selectedUser.phone || 'Khách hàng'}
                  </div>
                  {hasRedeemedPoints ? (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-700 font-semibold">
                      <Lock size={11} />
                      <span>Đã đổi điểm (Cố định hội viên)</span>
                    </div>
                  ) : (
                    /* CHỈ HIỂN THỊ 2 NÚT: SỬA THÔNG TIN VÀ GỠ TRÊN 1 DÒNG CHỮ GỌN GÀNG */
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMember(selectedUser)}
                        className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                        title="Sửa thông tin thành viên"
                      >
                        <Edit3 size={11} />
                        <span>Sửa thông tin</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveUser}
                        className="px-2 py-0.5 rounded-md bg-red-50 text-[#DA251D] hover:bg-red-100 font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                        title="Gỡ khách hàng khỏi đơn"
                      >
                        <X size={11} />
                        <span>Gỡ</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Points & History on the Right */}
              <div className="text-right shrink-0 ml-2">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">
                  ĐIỂM HIỆN CÓ
                </span>
                <span className="text-xl font-black text-[#00875A] tracking-tight block">
                  {userPoints.toLocaleString('vi-VN')}
                </span>
                <button
                  type="button"
                  onClick={handleOpenPointHistory}
                  className="mt-0.5 text-[10.5px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer inline-flex items-center gap-0.5 select-none"
                >
                  <History size={10} />
                  <span>Lịch sử đổi điểm</span>
                </button>
              </div>
            </div>
          ) : (
            /* Search Customer Input */
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chọn thành viên
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerOpen(true)}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-[#DA251D] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Thêm khách</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Nhập SĐT hoặc tên khách hàng..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-[#DA251D] focus:ring-1 focus:ring-[#DA251D]"
                />
              </div>
              {isSearching && <p className="text-[11px] text-slate-400 italic">Đang tìm khách hàng...</p>}
              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-xs">
                  {searchResults.map((u: any) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className="w-full text-left p-2 hover:bg-red-50/60 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{u.fullName || u.phone}</div>
                        <div className="text-slate-400 text-[11px]">{u.phone}</div>
                      </div>
                      <span className="font-black text-[#00875A] bg-emerald-50 px-2 py-0.5 rounded text-xs">
                        {(u.points ?? u.currentPoints ?? 0).toLocaleString('vi-VN')} điểm
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section: VẬT PHẨM CÓ THỂ ĐỔI */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
              VẬT PHẨM CÓ THỂ ĐỔI:
            </h4>

            {isLoadingRewards ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between animate-pulse"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                      <div className="space-y-1.5">
                        <div className="w-28 h-3.5 bg-slate-200 rounded" />
                        <div className="w-16 h-3 bg-slate-200 rounded" />
                      </div>
                    </div>
                    <div className="w-14 h-7 bg-slate-200 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : rewards.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Utensils size={32} className="mx-auto mb-1.5 opacity-40" />
                <p className="text-xs font-medium">Hiện chưa có món nào thiết lập đổi điểm thưởng</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-0.5">
                {rewards.map((item: any) => {
                  const requiredPoints = item.redemptionPoints || 0;
                  const canRedeem = selectedUser && userPoints >= requiredPoints;
                  const isProcessing = redeemingProductId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-between shadow-2xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Thumbnail */}
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                          {item.image || item.imageUrl ? (
                            <Image
                              src={item.image || item.imageUrl}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Utensils size={18} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-xs truncate leading-snug">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-black text-[#00875A] text-xs">
                              {requiredPoints.toLocaleString('vi-VN')} điểm
                            </span>
                            <span className="text-[10px] text-slate-400 line-through">
                              {(item.price || 0).toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Redeem Button */}
                      <button
                        type="button"
                        disabled={!canRedeem || isProcessing}
                        onClick={() => handlePromptConfirm(item)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer whitespace-nowrap shadow-2xs flex items-center gap-1 ${
                          canRedeem
                            ? 'bg-[#00875A] hover:bg-[#00704a] active:scale-95 text-white'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isProcessing ? (
                          <Loader2 size={13} className="animate-spin text-white" />
                        ) : (
                          <Coins size={13} className="shrink-0" />
                        )}
                        <span>Đổi</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ResponsiveModal>

      {/* CONFIRMATION POPUP MODAL */}
      {confirmItem && (
        <ResponsiveModal
          isOpen={Boolean(confirmItem)}
          onClose={() => setConfirmItem(null)}
          title="Xác nhận đổi món"
          subtitle="Vui lòng kiểm tra kỹ số điểm trừ trước khi xác nhận"
          icon={<Coins size={18} className="text-amber-500" />}
          maxWidth="sm"
          footer={
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={Boolean(redeemingProductId)}
                onClick={() => handleExecuteRedeem(confirmItem)}
                className="flex-1 py-2 rounded-xl bg-[#00875A] hover:bg-[#00704a] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                {redeemingProductId ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                <span>Xác nhận đổi</span>
              </button>
            </div>
          }
        >
          <div className="space-y-3 py-1 text-center">
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-left space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Món quà tặng:</span>
                <span className="font-bold text-slate-900">{confirmItem.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Điểm cần trừ:</span>
                <span className="font-bold text-[#DA251D]">
                  -{(confirmItem.redemptionPoints || 0).toLocaleString('vi-VN')} điểm
                </span>
              </div>
              <div className="flex justify-between text-xs border-t border-amber-200/60 pt-1.5 font-bold">
                <span className="text-slate-700">Điểm còn lại:</span>
                <span className="text-[#00875A]">
                  {Math.max(0, userPoints - (confirmItem.redemptionPoints || 0)).toLocaleString('vi-VN')} điểm
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Món quà tặng sẽ được thêm vào hóa đơn với giá <span className="font-bold text-emerald-600">0đ</span> và ghi chú <span className="font-bold">ĐỔI ĐIỂM THƯỞNG</span>.
            </p>
          </div>
        </ResponsiveModal>
      )}

      {/* MODAL THÊM KHÁCH HÀNG MỚI (GIỐNG 100% TRONG MODAL THANH TOÁN QUA CreateCustomerModal) */}
      {isAddCustomerOpen && (
        <CreateCustomerModal
          onClose={() => setIsAddCustomerOpen(false)}
          onSuccess={(newCustomer) => {
            setIsAddCustomerOpen(false);
            handleSelectUser(newCustomer);
          }}
          isDarkMode={false}
        />
      )}

      {/* MODAL SỬA THÔNG TIN THÀNH VIÊN */}
      {isEditMemberOpen && selectedUser && (
        <ResponsiveModal
          isOpen={isEditMemberOpen}
          onClose={() => setIsEditMemberOpen(false)}
          title="Sửa Thông Tin Thành Viên"
          subtitle={`Hội viên: #${selectedUser.memberCode || selectedUser.id?.slice(0, 8)}`}
          icon={<Edit3 size={18} className="text-blue-600" />}
          maxWidth="sm"
          footer={
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsEditMemberOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isUpdatingMember}
                onClick={handleSaveEditMember}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isUpdatingMember ? <Loader2 size={14} className="animate-spin" /> : 'Lưu thay đổi'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveEditMember} className="space-y-3 py-1 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editMemberName}
                onChange={(e) => setEditMemberName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={editMemberPhone}
                onChange={(e) => setEditMemberPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Email
                </label>
                {Boolean(selectedUser.isEmailVerified || selectedUser.emailVerified) && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                    <CheckCircle2 size={11} className="text-emerald-600" />
                    <span>Đã xác thực</span>
                  </span>
                )}
              </div>
              <div
                className="relative"
                onClick={() => {
                  if (Boolean(selectedUser.isEmailVerified || selectedUser.emailVerified)) {
                    toast('Email khách hàng đã được xác thực bảo mật, không thể chỉnh sửa trực tiếp.', {
                      icon: '🔒',
                      id: 'email-verified-lock',
                    });
                  }
                }}
              >
                <input
                  type="email"
                  disabled={Boolean(selectedUser.isEmailVerified || selectedUser.emailVerified)}
                  value={editMemberEmail}
                  onChange={(e) => setEditMemberEmail(e.target.value)}
                  placeholder="khachhang@example.com"
                  className={`w-full px-3 py-2 border rounded-xl text-xs pr-8 ${
                    Boolean(selectedUser.isEmailVerified || selectedUser.emailVerified)
                      ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed select-none'
                      : 'border-slate-200 focus:outline-none focus:border-blue-600'
                  }`}
                />
                {Boolean(selectedUser.isEmailVerified || selectedUser.emailVerified) && (
                  <CheckCircle2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                )}
              </div>
              {Boolean(selectedUser.isEmailVerified || selectedUser.emailVerified) && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                  <Lock size={11} />
                  <span>Email đã được xác thực, không thể chỉnh sửa.</span>
                </p>
              )}
            </div>
          </form>
        </ResponsiveModal>
      )}

      {/* MODAL LỊCH SỬ ĐỔI ĐIỂM CỦA KHÁCH HÀNG */}
      {isPointHistoryOpen && selectedUser && (
        <ResponsiveModal
          isOpen={isPointHistoryOpen}
          onClose={() => setIsPointHistoryOpen(false)}
          title="Lịch Sử Điểm Thưởng"
          subtitle={`Khách hàng: ${selectedUser.fullName || selectedUser.phone} • ${(userPoints).toLocaleString('vi-VN')} điểm`}
          icon={<History size={18} className="text-[#00875A]" />}
          maxWidth="md"
        >
          <div className="py-1 space-y-3">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 size={24} className="animate-spin text-slate-400" />
                <span className="text-xs text-slate-400">Đang tải lịch sử điểm...</span>
              </div>
            ) : pointHistory.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-1">
                <Coins size={32} className="mx-auto opacity-30 text-amber-500" />
                <p className="text-xs font-semibold">Chưa có lịch sử giao dịch điểm</p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {pointHistory.map((t: any) => {
                  const isEarn = t.type === 'EARN' || (t.amount && t.amount > 0);
                  return (
                    <div key={t.id} className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isEarn ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {isEarn ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                            {isEarn ? 'TÍCH ĐIỂM' : 'ĐỔI QUÀ'}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {t.description || (isEarn ? 'Tích lũy từ đơn hàng' : 'Đổi món ăn quà tặng')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {t.createdAtFormatted || new Date(t.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black ${isEarn ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isEarn ? `+${t.amount}` : `-${Math.abs(t.amount)}`}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          Dư: {(t.balanceAfter || 0).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ResponsiveModal>
      )}
    </>
  );
}
