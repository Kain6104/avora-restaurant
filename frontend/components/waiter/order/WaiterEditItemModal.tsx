'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  Tag, 
  Percent, 
  Check, 
  Lock, 
  ShieldAlert, 
  MessageSquare, 
  Clock, 
  Flame, 
  CheckCircle2, 
  ChefHat,
  Loader2,
  Sparkles,
  Gift,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';

interface WaiterEditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any | null;
  isSent: boolean;
  activeBranchId?: string | null;
  order?: any;
  onUpdateUnsent?: (updates: {
    quantity?: number;
    note?: string;
    discountAmount?: number;
    discountReason?: string;
  }) => void;
  onRemoveUnsent?: () => void;
  onOrderUpdated?: (updatedOrder: any) => void;
}

const QUICK_NOTES = [
  'Ít cay',
  'Không cay',
  'Không hành',
  'Ít ngọt',
  'Không đường',
  'Đậm đà',
  'Mang ra trước',
  'Ăn kèm tương ớt',
  'Giao nóng',
  'Không lấy đá',
];

const QUICK_DISCOUNT_PERCENTAGES = [5, 10, 15, 20, 30, 50];

const QUICK_DISCOUNT_REASONS = [
  'Món ra chậm / chờ lâu',
  'Khách quen thân thiết',
  'Ưu đãi sinh nhật khách',
  'Món đổi lại / sơ suất phục vụ',
  'Quản lý duyệt tặng',
];

export default function WaiterEditItemModal({
  isOpen,
  onClose,
  item,
  isSent,
  activeBranchId,
  order,
  onUpdateUnsent,
  onRemoveUnsent,
  onOrderUpdated,
}: WaiterEditItemModalProps) {
  const { can } = useAdmin();

  // Permissions check
  const hasCancelSentPermission = can('pos.item.cancel_sent', activeBranchId || undefined);
  const hasDiscountPermission = can('pos.discount.apply', activeBranchId || undefined);

  // Local editing states
  const initialQty = item?.quantity || 1;
  const [quantity, setQuantity] = useState<number>(initialQty);
  const [note, setNote] = useState<string>(item?.note || '');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountFixed, setDiscountFixed] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>(item?.discountReason || '');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState<boolean>(
    Boolean(item?.discountAmount && item.discountAmount > 0)
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Nhận diện món đổi điểm thưởng (chống lạm dụng: không xóa / không đổi số lượng, chỉ sửa ghi chú)
  const isRedeemedReward = Boolean(
    item?.priceAtSale === 0 &&
      (item?.discountReason?.includes('đổi điểm') ||
        item?.discountReason?.includes('Đổi điểm') ||
        item?.note?.includes('ĐỔI ĐIỂM') ||
        item?.orderedByName?.includes('Đổi điểm') ||
        Boolean(item?.orderedById && item?.priceAtSale === 0)),
  );

  let redeemedStaffName = '';
  if (item?.note) {
    const staffMatch =
      item.note.match(/NV thực hiện:\s*([^|]+)/i) ||
      item.note.match(/NV:\s*([^|]+)/i) ||
      item.note.match(/Nhân viên.*?:\s*([^|]+)/i);
    if (staffMatch) redeemedStaffName = staffMatch[1].trim();
  }

  // Sync state whenever item opens
  useEffect(() => {
    if (item) {
      setQuantity(item.quantity || 1);
      setNote(item.note || '');
      const initialDiscount = item.discountAmount || 0;
      setIsApplyingDiscount(initialDiscount > 0);
      setDiscountReason(item.discountReason || '');

      const unitPrice = item.originalPriceAtSale || item.priceAtSale || 0;
      if (initialDiscount > 0 && unitPrice > 0) {
        const pct = Math.round((initialDiscount / unitPrice) * 100);
        setDiscountPercent(pct);
        setDiscountFixed(initialDiscount);
      } else {
        setDiscountPercent(10);
        setDiscountFixed(10000);
      }
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const productName = item.productName || item.product?.name || 'Món ăn';
  const baseUnitPrice = item.originalPriceAtSale || item.priceAtSale || 0;

  // Calculated discount per unit
  const calculatedDiscountPerUnit = !isApplyingDiscount || isRedeemedReward
    ? 0
    : discountType === 'PERCENT'
    ? Math.round((baseUnitPrice * Math.min(100, Math.max(0, discountPercent))) / 100)
    : Math.min(baseUnitPrice, Math.max(0, discountFixed));

  const effectiveUnitPrice = Math.max(0, baseUnitPrice - calculatedDiscountPerUnit);
  const totalPrice = isRedeemedReward ? 0 : effectiveUnitPrice * quantity;

  // Handle Note quick chip click
  const handleToggleNoteChip = (chip: string) => {
    if (note.includes(chip)) {
      setNote(
        note
          .replace(chip, '')
          .replace(/,\s*,/g, ',')
          .replace(/^,\s*|,\s*$/g, '')
          .trim()
      );
    } else {
      setNote(note ? `${note.trim()}, ${chip}` : chip);
    }
  };

  // Quantity handlers with RBAC & Redeemed guard
  const handleDecreaseQuantity = () => {
    if (isRedeemedReward) {
      toast.error('Món đổi điểm không được phép thay đổi số lượng!');
      return;
    }

    if (quantity <= 1) {
      handleRemoveItem();
      return;
    }

    if (isSent && quantity <= initialQty && !hasCancelSentPermission) {
      toast.error(
        'Bạn không có quyền giảm số lượng món đã gửi bếp (pos.item.cancel_sent)',
        { icon: <ShieldAlert className="w-4 h-4 text-rose-500" /> }
      );
      return;
    }

    setQuantity((q) => Math.max(1, q - 1));
  };

  const handleIncreaseQuantity = () => {
    if (isRedeemedReward) {
      toast.error('Món đổi điểm không được phép tăng số lượng!');
      return;
    }
    setQuantity((q) => q + 1);
  };

  const handleRemoveItem = () => {
    if (isRedeemedReward) {
      toast.error('Món đổi điểm không được phép xóa hoặc hủy khỏi đơn!');
      return;
    }

    if (isSent) {
      if (!hasCancelSentPermission) {
        toast.error(
          'Bạn không có quyền hủy món đã gửi bếp (pos.item.cancel_sent)',
          { icon: <ShieldAlert className="w-4 h-4 text-rose-500" /> }
        );
        return;
      }

      if (!confirm(`Bạn có chắc muốn hủy toàn bộ món "${productName}" đã gửi bếp?`)) {
        return;
      }

      handleSaveSentItem({ remove: true });
    } else {
      onRemoveUnsent?.();
      toast.success(`Đã xóa món ${productName} khỏi danh sách chờ`);
      onClose();
    }
  };

  const handleDiscountSectionClick = () => {
    if (isRedeemedReward) return;
    if (!hasDiscountPermission) {
      toast.error(
        'Bạn không có quyền áp dụng giảm giá món ăn (pos.discount.apply)',
        { icon: <Lock className="w-4 h-4 text-amber-500" /> }
      );
    }
  };

  // Save changes
  const handleSave = async () => {
    if (isRedeemedReward) {
      // Chỉ cho phép cập nhật ghi chú phục vụ cho món đổi điểm
      if (!isSent) {
        onUpdateUnsent?.({
          quantity: item.quantity,
          note: note.trim() || undefined,
          discountAmount: 0,
        });
        toast.success(`Đã cập nhật ghi chú món ${productName}`);
        onClose();
      } else {
        await handleSaveSentItem({ remove: false });
      }
      return;
    }

    if (isApplyingDiscount && calculatedDiscountPerUnit > 0 && !discountReason.trim()) {
      toast.error('Vui lòng chọn hoặc nhập lý do giảm giá cho món ăn');
      return;
    }

    if (!isSent) {
      // Unsent item: update directly in local cart store
      onUpdateUnsent?.({
        quantity,
        note: note.trim() || undefined,
        discountAmount: isApplyingDiscount ? calculatedDiscountPerUnit : 0,
        discountReason: isApplyingDiscount ? discountReason.trim() : undefined,
      });
      toast.success(`Đã cập nhật món ${productName}`);
      onClose();
    } else {
      // Sent item: update order in backend
      await handleSaveSentItem({ remove: false });
    }
  };

  const handleSaveSentItem = async ({ remove = false }: { remove?: boolean }) => {
    if (!order?.id) {
      toast.error('Không tìm thấy thông tin đơn hàng');
      return;
    }

    if (remove && isRedeemedReward) {
      toast.error('Món đổi điểm không được phép hủy khỏi đơn!');
      return;
    }

    setIsSaving(true);
    try {
      // Construct updated items array
      const existingItems = (order.orderItems || []).map((oi: any) => ({
        id: oi.id,
        productId: oi.productId,
        quantity: oi.quantity,
        note: oi.note,
        discountAmount: oi.discountAmount || 0,
        discountReason: oi.discountReason,
        selectedOptionIds: oi.selectedOptions?.map((so: any) => so.optionItemId) || [],
      }));

      let updatedItems: any[];
      if (remove) {
        updatedItems = existingItems.filter((oi: any) => oi.id !== item.id);
      } else {
        updatedItems = existingItems.map((oi: any) => {
          if (oi.id === item.id) {
            return {
              ...oi,
              quantity: isRedeemedReward ? item.quantity : quantity,
              note: note.trim() || null,
              discountAmount: isRedeemedReward ? 0 : (isApplyingDiscount ? calculatedDiscountPerUnit : 0),
              discountReason: isRedeemedReward ? oi.discountReason : (isApplyingDiscount ? discountReason.trim() : null),
            };
          }
          return oi;
        });
      }

      const res = await fetch(`/api/pos/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: updatedItems,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Không thể cập nhật món đã gửi bếp');
      }

      toast.success(remove ? `Đã hủy món ${productName}` : `Đã cập nhật món ${productName}`);
      if (json.data) {
        onOrderUpdated?.(json.data);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật món');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="fixed inset-0" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col z-[125] max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-[#DA251D] flex items-center justify-center shrink-0">
              <ChefHat size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base text-slate-900 truncate">
                  {productName}
                </h2>
                {isSent ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {item.kitchenStatus === 'READY' ? (
                      <>
                        <CheckCircle2 size={11} className="text-emerald-600" />
                        <span>Sẵn sàng</span>
                      </>
                    ) : item.kitchenStatus === 'PREPARING' ? (
                      <>
                        <Flame size={11} className="text-orange-600" />
                        <span>Đang làm</span>
                      </>
                    ) : (
                      <>
                        <Clock size={11} className="text-amber-600" />
                        <span>Chờ chế biến</span>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="bg-[#DA251D] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Mới chờ gửi
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Đơn giá: <strong>{baseUnitPrice.toLocaleString('vi-VN')} đ</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Card nổi bật cho Món Đổi Điểm Thưởng */}
          {isRedeemedReward && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 text-amber-800">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center font-bold text-amber-700 shrink-0">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider text-amber-900">
                    Món Đổi Điểm Thưởng (0đ)
                  </h4>
                  <p className="text-[11px] text-amber-700">
                    Quy đổi từ điểm tích lũy thành viên • Cố định số lượng
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/70 text-xs">
                <div className="bg-white/85 backdrop-blur-xs p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Khách hàng đổi:</div>
                  <div className="font-bold text-slate-900 mt-0.5 truncate">
                    {item.orderedByName || order?.customerName || 'Hội viên'}
                  </div>
                </div>

                <div className="bg-white/85 backdrop-blur-xs p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Nhân viên thực hiện:</div>
                  <div className="font-bold text-slate-900 mt-0.5 truncate">
                    {redeemedStaffName || 'Nhân viên phục vụ'}
                  </div>
                </div>
              </div>

              {item.discountReason && (
                <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1.5 pt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block shrink-0" />
                  <span>Hình thức: <strong className="text-amber-900">{item.discountReason}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* SECTION 1: QUANTITY */}
          {isRedeemedReward ? (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-800">Số lượng món:</span>
              <span className="font-black text-sm text-slate-900 flex items-center gap-1.5 font-mono">
                <Lock className="w-4 h-4 text-amber-600" /> {quantity} (Món đổi điểm - Cố định 0đ)
              </span>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">Số lượng:</span>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-[11px] text-slate-500">Thành tiền món:</span>
                  <span className="font-extrabold text-sm text-[#DA251D] font-mono">
                    {totalPrice.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleDecreaseQuantity}
                  className="w-12 h-12 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 text-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                >
                  {quantity === 1 ? (
                    <Trash2 size={20} className="text-rose-500" />
                  ) : (
                    <Minus size={20} />
                  )}
                </button>

                <div className="flex-1 text-center">
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1) {
                        if (isSent && val < initialQty && !hasCancelSentPermission) {
                          toast.error(
                            'Bạn không có quyền giảm số lượng món đã gửi bếp (pos.item.cancel_sent)',
                            { icon: <ShieldAlert className="w-4 h-4 text-rose-500" /> }
                          );
                          return;
                        }
                        setQuantity(val);
                      }
                    }}
                    className="w-24 mx-auto text-center font-black text-2xl text-slate-900 bg-white border border-slate-200 rounded-xl py-1 outline-none focus:border-[#DA251D] font-mono shadow-2xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleIncreaseQuantity}
                  className="w-12 h-12 rounded-2xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Quick quantity chips */}
              <div className="flex items-center gap-1.5 justify-center pt-1">
                <span className="text-[10px] text-slate-400 font-medium mr-1">Chọn nhanh:</span>
                {[1, 2, 3, 4, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (isSent && num < initialQty && !hasCancelSentPermission) {
                        toast.error(
                          'Bạn không có quyền giảm số lượng món đã gửi bếp (pos.item.cancel_sent)',
                          { icon: <ShieldAlert className="w-4 h-4 text-rose-500" /> }
                        );
                        return;
                      }
                      setQuantity(num);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      quantity === num
                        ? 'bg-slate-900 text-white'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: KITCHEN NOTE */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={16} className="text-amber-600" />
                <span className="font-bold text-sm text-slate-800">Ghi chú gửi bếp:</span>
              </div>
              {note && (
                <button
                  type="button"
                  onClick={() => setNote('')}
                  className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                >
                  Xóa ghi chú
                </button>
              )}
            </div>

            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Không hành, ít ngọt, mang ra cùng món khai vị..."
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#DA251D] shadow-2xs resize-none"
            />

            {/* Quick note suggestion chips */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-slate-400 font-bold block">
                Gợi ý ghi chú nhanh:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTES.map((chip) => {
                  const isSelected = note.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleToggleNoteChip(chip)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                          : 'bg-white hover:bg-amber-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 3: ITEM DISCOUNT (PROTECTED BY RBAC) */}
          {!isRedeemedReward && (
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                !hasDiscountPermission
                  ? 'bg-slate-100/70 border-slate-200 opacity-90'
                  : 'bg-slate-50 border-slate-200/80'
              }`}
              onClick={!hasDiscountPermission ? handleDiscountSectionClick : undefined}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tag size={16} className="text-[#DA251D]" />
                  <span className="font-bold text-sm text-slate-800">Giảm giá / Chiết khấu món</span>
                </div>

                {!hasDiscountPermission ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                    <Lock size={11} />
                    <span>Khóa quyền</span>
                  </span>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isApplyingDiscount}
                      onChange={(e) => setIsApplyingDiscount(e.target.checked)}
                      className="w-4 h-4 accent-[#DA251D] rounded cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 font-semibold">Áp dụng</span>
                  </label>
                )}
              </div>

              {!hasDiscountPermission ? (
                <div className="mt-2.5 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                  <Lock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Bạn không có quyền áp dụng giảm giá cho món ăn (<strong>pos.discount.apply</strong>). Vui lòng liên hệ Quản lý chi nhánh để thực hiện.
                  </span>
                </div>
              ) : (
                isApplyingDiscount && (
                  <div className="space-y-3 pt-3 mt-2 border-t border-slate-200/80 animate-in fade-in duration-150">
                    {/* Toggle Discount Type */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setDiscountType('PERCENT')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          discountType === 'PERCENT'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Percent size={13} />
                        <span>Theo phần trăm (%)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('FIXED')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          discountType === 'FIXED'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>Theo số tiền (VNĐ)</span>
                      </button>
                    </div>

                    {/* Input value */}
                    {discountType === 'PERCENT' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={discountPercent || ''}
                            onChange={(e) => setDiscountPercent(Number(e.target.value))}
                            placeholder="Nhập % giảm..."
                            className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#DA251D] shadow-2xs"
                          />
                          <span className="text-xs font-bold text-slate-700">%</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {QUICK_DISCOUNT_PERCENTAGES.map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setDiscountPercent(pct)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                discountPercent === pct
                                  ? 'bg-red-600 text-white'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              -{pct}%
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="1000"
                            min="0"
                            value={discountFixed || ''}
                            onChange={(e) => setDiscountFixed(Number(e.target.value))}
                            placeholder="Nhập số tiền giảm..."
                            className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#DA251D] shadow-2xs"
                          />
                          <span className="text-xs font-bold text-slate-700">VNĐ</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[10000, 20000, 30000, 50000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setDiscountFixed(amt)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                discountFixed === amt
                                  ? 'bg-red-600 text-white'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              -{amt / 1000}k
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Discount Reason */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Lý do giảm giá: <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        placeholder="VD: Món ra chậm, Khách VIP..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#DA251D] shadow-2xs"
                      />
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {QUICK_DISCOUNT_REASONS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setDiscountReason(r)}
                            className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Discount summary banner */}
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                      <span className="text-emerald-900 font-medium">Giảm mỗi phần:</span>
                      <span className="font-bold text-emerald-800 font-mono">
                        -{calculatedDiscountPerUnit.toLocaleString('vi-VN')} đ (Đơn giá mới:{' '}
                        {effectiveUnitPrice.toLocaleString('vi-VN')} đ)
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {isRedeemedReward ? (
            <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 select-none">
              <Lock size={14} className="text-amber-600" />
              <span>Món đổi điểm (Cố định)</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleRemoveItem}
              className="px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
              <span>{isSent ? 'Hủy món' : 'Xóa món'}</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
