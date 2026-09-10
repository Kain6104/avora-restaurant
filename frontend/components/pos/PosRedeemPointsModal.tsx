'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User, Gift, Coins, Loader2, Utensils, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { PosOrder, PosBranch } from './pos-types';

export interface PosRedeemPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PosOrder | null;
  currentBranch: PosBranch | null;
  selectedMember?: any | null;
  onAppliedSuccess?: () => void;
}

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export const PosRedeemPointsModal: React.FC<PosRedeemPointsModalProps> = ({
  isOpen,
  onClose,
  order,
  currentBranch,
  selectedMember,
  onAppliedSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isChangingUser, setIsChangingUser] = useState(false);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [redeemingProductId, setRedeemingProductId] = useState<string | null>(null);

  // Check if order already has redeemed points
  const hasRedeemedPoints = Boolean(
    (order?.pointsUsed && order.pointsUsed > 0) ||
      (order as any)?.orderItems?.some(
        (it: any) =>
          it.priceAtSale === 0 &&
          (it.discountReason?.includes('đổi điểm') || it.discountReason?.includes('Đổi điểm')),
      ),
  );

  // Sync activeUser from props or order
  useEffect(() => {
    if (selectedMember) {
      setActiveUser(selectedMember);
    } else if (order?.user) {
      setActiveUser(order.user);
    } else if (order?.userId) {
      fetch(`/api/pos/members/search?query=${encodeURIComponent(order.customerPhone || order.customerName || '')}`, {
        credentials: 'include',
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.length > 0) {
            const found = res.data.find((u: any) => u.id === order.userId) || res.data[0];
            setActiveUser(found);
          }
        })
        .catch(() => {});
    } else {
      setActiveUser(null);
    }
  }, [selectedMember, order]);

  // Fetch redeemable rewards catalog for branch
  const branchId = currentBranch?.id || order?.branchId;
  const { data: rewardsResponse, isLoading: isLoadingRewards } = useSWR(
    isOpen && branchId ? `/api/pos/rewards?branchId=${branchId}` : null,
    fetcher,
  );

  const rewards = rewardsResponse?.data || [];

  // Member search handler
  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/pos/members/search?query=${encodeURIComponent(val.trim())}`, {
        credentials: 'include',
      });
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
      toast.error('Đơn hàng này đã đổi điểm, không thể đổi khách hàng!');
      return;
    }
    setActiveUser(user);
    setIsChangingUser(false);
    setSearchQuery('');
    setSearchResults([]);

    // Auto update order with this member
    if (order?.id) {
      try {
        await fetch(`/api/pos/orders/${order.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: user.id,
            customerName: user.fullName,
            customerPhone: user.phone || undefined,
          }),
        });
      } catch (e) {
        console.error('Failed to attach user to order:', e);
      }
    }
  };

  const handleRemoveUser = () => {
    if (hasRedeemedPoints) {
      toast.error('Đơn hàng này đã đổi điểm thưởng, không thể gỡ hội viên!');
      return;
    }
    setActiveUser(null);
    setIsChangingUser(true);
  };

  const [confirmItem, setConfirmItem] = useState<any | null>(null);

  const userPoints = activeUser?.points ?? activeUser?.currentPoints ?? 0;

  // Prompt confirmation dialog before redeeming
  const handlePromptConfirm = (item: any) => {
    if (!order?.id) {
      toast.error('Không tìm thấy thông tin đơn hàng');
      return;
    }

    if (!activeUser) {
      toast.error('Vui lòng chọn khách hàng thành viên trước khi đổi điểm');
      return;
    }

    const requiredPoints = item.redemptionPoints || 0;
    if (userPoints < requiredPoints) {
      toast.error(
        `Hội viên hiện có ${userPoints.toLocaleString('vi-VN')} điểm, không đủ ${requiredPoints.toLocaleString('vi-VN')} điểm để đổi món này.`,
      );
      return;
    }

    setConfirmItem(item);
  };

  // Execute redeem after confirmation
  const handleExecuteRedeem = async (item: any) => {
    if (!order?.id || !activeUser || !item) return;

    const requiredPoints = item.redemptionPoints || 0;
    setRedeemingProductId(item.id);
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/redeem-reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: item.id,
          userId: activeUser.id,
          quantity: 1,
        }),
      });

      const resData = await res.json();
      if (resData.success) {
        toast.success(`Đã đổi thành công món "${item.name}"!`);
        // Deduct points locally for smooth UX
        setActiveUser((prev: any) =>
          prev
            ? {
                ...prev,
                points: Math.max(0, (prev.points ?? prev.currentPoints ?? 0) - requiredPoints),
                currentPoints: Math.max(0, (prev.currentPoints ?? prev.points ?? 0) - requiredPoints),
              }
            : null,
        );
        setConfirmItem(null);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden select-none border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center shrink-0">
              <Gift size={20} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900 leading-tight">Đổi Điểm Thưởng Lấy Món</h3>
              <p className="text-[11px] text-slate-500">Quy đổi điểm tích lũy của hội viên lấy món ăn 0đ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Lock notice banner if points already redeemed */}
          {hasRedeemedPoints && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-800">
              <Lock size={16} className="text-amber-600 shrink-0" />
              <span>
                Đơn hàng đã có món đổi điểm thưởng. Tài khoản hội viên được <strong>cố định</strong> để đảm bảo đối soát.
              </span>
            </div>
          )}

          {/* Member Card */}
          {activeUser && !isChangingUser ? (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#1A73E8] text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
                  {activeUser.fullName ? activeUser.fullName.charAt(0).toUpperCase() : <User size={20} />}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm leading-snug">
                    {activeUser.fullName || activeUser.phone || 'Hội viên'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {activeUser.phone || 'Chưa SĐT'} {activeUser.memberCode ? `• ${activeUser.memberCode}` : ''}
                  </div>
                  {!hasRedeemedPoints ? (
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setIsChangingUser(true)}
                        className="text-[#1A73E8] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                      >
                        <User size={12} />
                        <span>Đổi tài khoản</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveUser}
                        className="text-[#E53935] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                      >
                        <X size={12} />
                        <span>Gỡ</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-700 font-semibold">
                      <Lock size={11} />
                      <span>Đã liên kết đơn hàng</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Points display */}
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  ĐIỂM HIỆN CÓ
                </span>
                <span className="text-2xl font-black text-[#00875A] tracking-tight">
                  {userPoints.toLocaleString('vi-VN')}
                </span>
              </div>
            </div>
          ) : (
            /* Search Customer Input */
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} className="text-[#da251d]" />
                  <span>Chọn hội viên tích điểm</span>
                </span>
                {activeUser && isChangingUser && (
                  <button
                    type="button"
                    onClick={() => setIsChangingUser(false)}
                    className="text-xs text-slate-500 hover:underline cursor-pointer"
                  >
                    Hủy thay đổi
                  </button>
                )}
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Nhập số điện thoại hoặc họ tên hội viên..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-[#DA251D] focus:ring-1 focus:ring-[#DA251D] transition-all"
                />
              </div>
              {isSearching && <p className="text-[11px] text-slate-400 italic">Đang tìm kiếm hội viên...</p>}
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-xs">
                  {searchResults.map((u: any) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className="w-full text-left p-2.5 hover:bg-red-50/60 flex items-center justify-between text-xs transition-colors cursor-pointer"
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

          {/* Section: Danh mục món đổi điểm */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                MÓN ĂN CÓ THỂ ĐỔI ĐIỂM:
              </h4>
              <span className="text-xs font-semibold text-slate-400">
                {rewards.length} món sẵn có
              </span>
            </div>

            {isLoadingRewards ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-3 bg-white border border-slate-100 rounded-2xl flex items-center justify-between animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-slate-200 rounded-2xl" />
                      <div className="space-y-1.5">
                        <div className="w-32 h-3.5 bg-slate-200 rounded" />
                        <div className="w-20 h-3 bg-slate-200 rounded" />
                      </div>
                    </div>
                    <div className="w-16 h-8 bg-slate-200 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : rewards.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                <Utensils size={36} className="mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-medium text-slate-600">Hiện chưa có món nào thiết lập đổi điểm</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Quản trị viên có thể cài đặt mục đổi điểm trong phần quản lý thực đơn
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {rewards.map((item: any) => {
                  const requiredPoints = item.redemptionPoints || 0;
                  const canRedeem = activeUser && userPoints >= requiredPoints;
                  const isProcessing = redeemingProductId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl flex items-center justify-between gap-3 shadow-2xs transition-all"
                    >
                      {/* Left: Thumbnail & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 shrink-0 relative overflow-hidden flex items-center justify-center">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <Utensils size={20} className="text-slate-300" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <h5 className="font-bold text-slate-900 text-sm leading-snug truncate">
                            {item.name}
                          </h5>
                          <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-amber-600">
                            <Coins size={14} className="text-amber-500" />
                            <span>{requiredPoints.toLocaleString('vi-VN')} điểm</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Button "Đổi" */}
                      <button
                        type="button"
                        disabled={!canRedeem || isProcessing}
                        onClick={() => handlePromptConfirm(item)}
                        className={`shrink-0 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center min-w-[70px] ${
                          canRedeem
                            ? 'bg-[#DA251D] hover:bg-[#b81d16] text-white shadow-xs active:scale-95 cursor-pointer'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                        title={
                          !activeUser
                            ? 'Vui lòng chọn hội viên'
                            : userPoints < requiredPoints
                            ? `Cần thêm ${(requiredPoints - userPoints).toLocaleString('vi-VN')} điểm`
                            : 'Bấm để đổi món ăn này'
                        }
                      >
                        {isProcessing ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          'Đổi món'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog trước khi trừ điểm */}
      {confirmItem && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setConfirmItem(null)}
        >
          <div 
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
                <Gift className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-900">Xác Nhận Đổi Món Bằng Điểm</h4>
              <p className="text-xs text-slate-500">
                Bạn có chắc chắn muốn dùng điểm tích lũy của khách để đổi món ăn này không?
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Món đổi thưởng:</span>
                <span className="font-bold text-slate-900 truncate max-w-[180px]">{confirmItem.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-900">{activeUser?.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Số điểm trừ:</span>
                <span className="font-black text-[#da251d]">-{confirmItem.redemptionPoints?.toLocaleString('vi-VN')} điểm</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">Điểm còn lại:</span>
                <span className="font-black text-emerald-600 font-mono">
                  {Math.max(0, userPoints - (confirmItem.redemptionPoints || 0)).toLocaleString('vi-VN')} điểm
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Lưu ý:</strong> Món đổi điểm sẽ được đưa vào đơn với giá <strong>0đ</strong>. Hệ thống <strong>không hỗ trợ hủy hay hoàn điểm</strong> sau khi đã xác nhận.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={redeemingProductId === confirmItem.id}
                onClick={() => setConfirmItem(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all active:scale-95 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={redeemingProductId === confirmItem.id}
                onClick={() => handleExecuteRedeem(confirmItem)}
                className="w-full py-2.5 rounded-xl bg-[#da251d] hover:bg-[#b81d16] text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                {redeemingProductId === confirmItem.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
