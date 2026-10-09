"use client";

import React from 'react';
import {
  X,
  Clock,
  User,
  ChefHat,
  Printer,
  FileText,
  Tag,
  DollarSign,
  Utensils,
  MapPin,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Gift,
} from 'lucide-react';
import { PosCartItem } from './pos-types';
import { getItemPriceBreakdown } from './pos-item-price-helper';
import { OrderItemPriceBreakdown } from './OrderItemPriceBreakdown';

interface ItemDetailModalProps {
  isOpen: boolean;
  item: PosCartItem | null;
  orderCode?: string;
  tableName?: string;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  item,
  orderCode,
  tableName,
  onClose,
}) => {
  if (!isOpen || !item) return null;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Chưa gửi bếp',
          cls: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: Clock,
        };
      case 'SENT':
        return {
          label: 'Đã gửi bếp',
          cls: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: ChefHat,
        };
      case 'ACKNOWLEDGED':
      case 'PREPARING':
        return {
          label: 'Đang chế biến',
          cls: 'bg-purple-50 text-purple-800 border-purple-200',
          icon: ChefHat,
        };
      case 'READY':
        return {
          label: 'Bếp xong - Chờ mang ra',
          cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: CheckCircle2,
        };
      case 'SERVED':
        return {
          label: 'Đã phục vụ',
          cls: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: CheckCircle2,
        };
      case 'CANCELLED':
        return {
          label: 'Đã hủy món',
          cls: 'bg-red-50 text-red-800 border-red-200',
          icon: AlertCircle,
        };
      default:
        return {
          label: 'Chờ xử lý',
          cls: 'bg-slate-100 text-slate-600 border-slate-200',
          icon: HelpCircle,
        };
    }
  };

  const statusInfo = getStatusBadge(item.kitchenStatus);
  const StatusIcon = statusInfo.icon;

  const formatSource = (src?: string) => {
    switch (src) {
      case 'POS':
        return 'Thu ngân POS quầy';
      case 'QR_ORDER':
      case 'QR_TABLE':
        return 'Khách tự gọi tại bàn (QR)';
      case 'WAITER':
        return 'Nhân viên phục vụ (Tablet)';
      case 'CHATBOT':
        return 'Trợ lý AI Chatbot';
      case 'WEB':
        return 'Website đặt món';
      default:
        return src || 'Hệ thống POS';
    }
  };

  const formatStation = (stationId?: string, stationName?: string) => {
    if (stationName) return stationName;
    switch (stationId) {
      case 'HOT_KITCHEN':
        return 'Bếp Nóng & Món Chính';
      case 'SUSHI':
        return 'Bếp Lạnh & Sushi/Sashimi';
      case 'BAR':
        return 'Quầy Pha Chế & Đồ Uống';
      case 'DESSERT':
        return 'Tráng Miệng & Bánh Ngọt';
      default:
        return stationId || 'Bếp Tổng Hợp';
    }
  };

  const sentTimeStr = item.sentToKitchenAt
    ? new Date(item.sentToKitchenAt).toLocaleString('vi-VN')
    : item.createdAt
    ? new Date(item.createdAt).toLocaleString('vi-VN')
    : 'Chưa gửi';

  const totalQty = Number(item.quantity || 1);
  const isItemSent = item.kitchenStatus === 'SENT' || item.kitchenStatus === 'ACKNOWLEDGED' || item.kitchenStatus === 'PREPARING' || item.kitchenStatus === 'READY' || item.kitchenStatus === 'SERVED';
  const printedQty = Math.min(
    totalQty,
    item.printedQuantity !== undefined
      ? Number(item.printedQuantity)
      : item.sentQuantity !== undefined
      ? Number(item.sentQuantity)
      : isItemSent
      ? totalQty
      : 0,
  );
  const unprintedQty = Math.max(0, totalQty - printedQty);
  const isRedeemedReward = Boolean(
    item.priceAtSale === 0 &&
      (item.discountReason?.includes('đổi điểm') ||
        item.discountReason?.includes('Đổi điểm') ||
        item.note?.includes('ĐỔI ĐIỂM') ||
        item.orderedByName?.includes('Đổi điểm') ||
        Boolean(item.orderedById && item.priceAtSale === 0)),
  );

  let redeemedStaffName = '';
  if (item.note) {
    const staffMatch =
      item.note.match(/NV thực hiện:\s*([^|]+)/i) ||
      item.note.match(/NV:\s*([^|]+)/i) ||
      item.note.match(/Nhân viên.*?:\s*([^|]+)/i);
    if (staffMatch) redeemedStaffName = staffMatch[1].trim();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-[#da251d] flex items-center justify-center font-bold">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Chi Tiết Mặt Hàng Trong Đơn
              </h3>
              <p className="text-xs text-slate-500">
                {orderCode ? `Đơn ${orderCode}` : 'Đơn hàng POS'} • {tableName || 'Mang về'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
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
                  <div className="text-[10px] text-slate-500 font-medium">Khách hàng đổi món:</div>
                  <div className="font-bold text-slate-900 mt-0.5 truncate">
                    {item.orderedByName || item.orderedBy || 'Hội viên'}
                  </div>
                </div>

                <div className="bg-white/85 backdrop-blur-xs p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Nhân viên thực hiện:</div>
                  <div className="font-bold text-slate-900 mt-0.5 truncate">
                    {redeemedStaffName || 'Thu ngân POS'}
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

          {/* Main Item Badge */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-bold text-slate-900">
                {item.product.name}
              </h4>
              <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                Mã: {item.product.itemCode} • Đơn vị: {item.product.unit || 'phần'}
              </p>
              <p className="text-slate-600 font-medium text-[11px] mt-0.5 select-text">
                {getItemPriceBreakdown(item).addedByFormatted}
              </p>
            </div>
            <div className="text-right">
              <div className="text-base font-black text-[#da251d]">
                {(item.priceAtSale * item.quantity).toLocaleString('vi-VN')}đ
              </div>
              <div className="text-[11px] text-slate-500">
                {item.quantity} × {item.priceAtSale.toLocaleString('vi-VN')}đ
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Trạng thái chế biến:
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold border ${statusInfo.cls}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {statusInfo.label}
            </span>
          </div>

          {/* Detailed Info Grid */}
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white">
            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-slate-400" /> Trạm bếp đảm nhiệm:
              </span>
              <span className="font-bold text-slate-800">
                {formatStation(item.stationId, item.stationName)}
              </span>
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" /> Người gọi món:
              </span>
              <span className="font-bold text-slate-800">
                {item.orderedByName || item.orderedBy || 'HTP Official'}
              </span>
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Nguồn gọi món:
              </span>
              <span className="font-bold text-slate-800">
                {formatSource(item.orderSource)}
              </span>
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Thời gian gửi bếp:
              </span>
              <span className="font-bold text-slate-800">{sentTimeStr}</span>
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-slate-400" /> Trạng thái in bếp:
              </span>
              <div className="flex items-center gap-1.5">
                {printedQty >= totalQty && totalQty > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Đã in đủ: {printedQty}/{totalQty}
                  </span>
                ) : printedQty > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Đã in: {printedQty}/{totalQty} (Chờ gửi +{unprintedQty})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
                    Chưa in: 0/{totalQty}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Options & Notes */}
          {(item.selectedOptions?.length > 0 || item.note) && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              {item.selectedOptions?.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-700 mb-1">
                    Cấu trúc giá món & Tùy chọn (Options):
                  </div>
                  <OrderItemPriceBreakdown item={item} showAddedBy={false} />
                </div>
              )}

              {item.note && (
                <div className="pt-1.5 border-t border-slate-200">
                  <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-amber-500" /> Ghi chú phục vụ:
                  </div>
                  <p className="text-slate-800 font-semibold italic mt-0.5">
                    "{item.note}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Discount Info */}
          {(item.discountAmount || 0) > 0 && (
            <div className="p-2.5 rounded-xl bg-red-50/70 border border-red-200/80 flex items-start gap-2 text-red-900">
              <Tag className="w-4 h-4 text-[#da251d] mt-0.5 shrink-0" />
              <div>
                <div className="font-bold">
                  Giảm giá: -{(item.discountAmount || 0).toLocaleString('vi-VN')}đ / phần
                </div>
                <div className="text-[11px] text-red-700 mt-0.5">
                  Lý do: {item.discountReason || 'Chiết khấu mặt hàng'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs active:scale-95 transition-all shadow-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
