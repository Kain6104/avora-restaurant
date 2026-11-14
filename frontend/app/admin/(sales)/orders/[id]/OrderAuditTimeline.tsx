'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  ShoppingBag,
  CreditCard,
  XCircle,
  ChefHat,
  Printer,
  Award,
  Shield,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  MinusCircle,
  Edit3,
  Hash,
  UserCheck,
  ArrowLeftRight,
  Scissors,
  GitMerge,
  Percent,
  Bell,
  PauseCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  QrCode,
  Trash2,
  RotateCcw,
  UtensilsCrossed,
  ArrowUpDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface OrderAuditLogItem {
  id: string;
  orderId: string;
  orderCode?: string;
  action: string;
  category: string;
  actorId?: string;
  actorName?: string;
  actorUsername?: string;
  actorAvatarUrl?: string;
  actorRole?: string;
  branchName?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  correlationId?: string;
  createdAt: string;
}

interface ActionVisualConfig {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  dotClass: string;
  iconClass: string;
}

const ACTION_CONFIG_MAP: Record<string, ActionVisualConfig> = {
  ORDER_CREATED: {
    label: 'TẠO ĐƠN HÀNG',
    icon: PlusCircle,
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    dotClass: 'bg-blue-600',
    iconClass: 'text-blue-600',
  },
  CUSTOMER_ORDER_ADDED: {
    label: 'KHÁCH GỌI THÊM',
    icon: UtensilsCrossed,
    badgeClass: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    dotClass: 'bg-cyan-600',
    iconClass: 'text-cyan-600',
  },
  ITEM_ADDED: {
    label: 'THÊM MÓN',
    icon: PlusCircle,
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dotClass: 'bg-emerald-600',
    iconClass: 'text-emerald-600',
  },
  ITEM_REMOVED: {
    label: 'XÓA MÓN',
    icon: MinusCircle,
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    dotClass: 'bg-rose-600',
    iconClass: 'text-rose-600',
  },
  ITEM_UPDATED: {
    label: 'CẬP NHẬT MÓN',
    icon: Edit3,
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    dotClass: 'bg-amber-500',
    iconClass: 'text-amber-600',
  },
  QTY_CHANGED: {
    label: 'ĐỔI SỐ LƯỢNG',
    icon: Hash,
    badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    dotClass: 'bg-indigo-600',
    iconClass: 'text-indigo-600',
  },
  CUSTOMER_UPDATED: {
    label: 'ĐỔI KHÁCH HÀNG',
    icon: UserCheck,
    badgeClass: 'bg-violet-50 text-violet-700 border border-violet-200',
    dotClass: 'bg-violet-600',
    iconClass: 'text-violet-600',
  },
  ORDER_TYPE_CHANGED: {
    label: 'ĐỔI LOẠI ĐƠN',
    icon: ArrowLeftRight,
    badgeClass: 'bg-sky-50 text-sky-700 border border-sky-200',
    dotClass: 'bg-sky-600',
    iconClass: 'text-sky-600',
  },
  ORDER_TABLE_CHANGED: {
    label: 'CHUYỂN BÀN',
    icon: ArrowLeftRight,
    badgeClass: 'bg-teal-50 text-teal-700 border border-teal-200',
    dotClass: 'bg-teal-600',
    iconClass: 'text-teal-600',
  },
  ORDER_SPLIT: {
    label: 'TÁCH ĐƠN',
    icon: Scissors,
    badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
    dotClass: 'bg-orange-500',
    iconClass: 'text-orange-600',
  },
  ORDER_MERGED: {
    label: 'GỘP ĐƠN',
    icon: GitMerge,
    badgeClass: 'bg-orange-50 text-orange-800 border border-orange-200',
    dotClass: 'bg-orange-600',
    iconClass: 'text-orange-600',
  },
  DISCOUNT_APPLIED: {
    label: 'GIẢM GIÁ',
    icon: Percent,
    badgeClass: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
    dotClass: 'bg-fuchsia-600',
    iconClass: 'text-fuchsia-600',
  },
  POINTS_REDEEMED: {
    label: 'ĐỔI QUÀ ĐIỂM THƯỞNG',
    icon: Award,
    badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
    dotClass: 'bg-purple-600',
    iconClass: 'text-purple-600',
  },
  POINTS_USED: {
    label: 'DÙNG ĐIỂM THƯỞNG',
    icon: Award,
    badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
    dotClass: 'bg-purple-600',
    iconClass: 'text-purple-600',
  },
  PAYMENT_REQUESTED: {
    label: 'YÊU CẦU THANH TOÁN',
    icon: Bell,
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    dotClass: 'bg-amber-500',
    iconClass: 'text-amber-600',
  },
  PAYMENT_REQUEST_CANCELLED: {
    label: 'HOÃN THANH TOÁN',
    icon: PauseCircle,
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300',
    dotClass: 'bg-slate-500',
    iconClass: 'text-slate-600',
  },
  PAYMENT_CODE_CREATED: {
    label: 'TẠO MÃ QR THANH TOÁN',
    icon: QrCode,
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    dotClass: 'bg-amber-600',
    iconClass: 'text-amber-600',
  },
  PAYMENT_CONFIRMED: {
    label: 'THANH TOÁN THÀNH CÔNG',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dotClass: 'bg-emerald-600',
    iconClass: 'text-emerald-600',
  },
  PAYMENT_FAILED: {
    label: 'THANH TOÁN THẤT BẠI',
    icon: AlertTriangle,
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    dotClass: 'bg-rose-600',
    iconClass: 'text-rose-600',
  },
  ORDER_STATUS_CHANGED: {
    label: 'ĐỔI TRẠNG THÁI',
    icon: RefreshCw,
    badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    dotClass: 'bg-indigo-600',
    iconClass: 'text-indigo-600',
  },
  ORDER_HELD: {
    label: 'TẠM GIỮ ĐƠN',
    icon: PauseCircle,
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    dotClass: 'bg-amber-500',
    iconClass: 'text-amber-600',
  },
  ORDER_RESUMED: {
    label: 'MỞ LẠI ĐƠN TẠM',
    icon: RotateCcw,
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    dotClass: 'bg-blue-600',
    iconClass: 'text-blue-600',
  },
  HELP_REQUESTED: {
    label: 'KHÁCH GỌI PHỤC VỤ',
    icon: Bell,
    badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
    dotClass: 'bg-orange-500',
    iconClass: 'text-orange-600',
  },
  ORDER_CANCELED: {
    label: 'HỦY ĐƠN HÀNG',
    icon: XCircle,
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    dotClass: 'bg-rose-600',
    iconClass: 'text-rose-600',
  },
  UNPAID_ORDER_CANCELLED: {
    label: 'HỦY ĐƠN CHƯA THANH TOÁN',
    icon: XCircle,
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    dotClass: 'bg-rose-600',
    iconClass: 'text-rose-600',
  },
  ORDER_DELETED: {
    label: 'XÓA LƯU TRỮ',
    icon: Trash2,
    badgeClass: 'bg-red-600 text-white border border-red-700',
    dotClass: 'bg-red-600',
    iconClass: 'text-red-600',
  },
  ORDER_RESTORED: {
    label: 'KHÔI PHỤC ĐƠN',
    icon: RotateCcw,
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dotClass: 'bg-emerald-600',
    iconClass: 'text-emerald-600',
  },
  PRINTED: {
    label: 'IN PHIẾU / HÓA ĐƠN',
    icon: Printer,
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    dotClass: 'bg-slate-500',
    iconClass: 'text-slate-600',
  },
};

const CATEGORY_TABS = [
  { key: 'ALL', label: 'Tất cả hoạt động', icon: Clock },
  { key: 'ORDER', label: 'Đơn hàng', icon: ShoppingBag },
  { key: 'ITEM', label: 'Món ăn', icon: UtensilsCrossed },
  { key: 'PAYMENT', label: 'Thanh toán', icon: CreditCard },
  { key: 'POINTS', label: 'Điểm thưởng', icon: Award },
  { key: 'CANCEL', label: 'Hủy đơn', icon: XCircle },
  { key: 'KITCHEN', label: 'Bếp', icon: ChefHat },
  { key: 'PRINT', label: 'In ấn', icon: Printer },
  { key: 'ADMIN', label: 'Quản trị', icon: Shield },
];

function formatVnd(amount: unknown): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '';
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))}đ`;
}

function buildAuditSummary(log: OrderAuditLogItem): string {
  if (log.reason && log.reason.trim().length > 0) {
    return log.reason.trim();
  }

  const oldVal = (log.oldValue || {}) as Record<string, unknown>;
  const newVal = (log.newValue || {}) as Record<string, unknown>;
  const meta = (log.metadata || {}) as Record<string, unknown>;

  if (typeof meta.summary === 'string' && meta.summary.trim()) {
    return meta.summary.trim();
  }

  switch (log.action) {
    case 'ORDER_CREATED':
      return `Tạo đơn ${newVal.orderCode || log.orderCode || ''} ${newVal.totalAmount ? `- Tổng ${formatVnd(newVal.totalAmount)}` : ''}`.trim();
    case 'ORDER_STATUS_CHANGED':
      return `Trạng thái đơn chuyển từ ${String(oldVal.status || '—')} sang ${String(newVal.status || '—')}`;
    case 'ORDER_TABLE_CHANGED':
      return `Chuyển từ ${String(oldVal.tableName || oldVal.tableId || '—')} sang ${String(newVal.tableName || newVal.tableId || '—')}`;
    case 'ORDER_TYPE_CHANGED':
      return `Đổi loại đơn từ ${String(oldVal.orderType || '—')} sang ${String(newVal.orderType || '—')}`;
    case 'PAYMENT_CONFIRMED':
      return `Xác nhận thanh toán thành công${newVal.totalAmount ? ` (${formatVnd(newVal.totalAmount)})` : ''}`;
    case 'PAYMENT_FAILED':
      return `Thanh toán thất bại${meta.errorMessage ? `: ${String(meta.errorMessage)}` : ''}`;
    case 'POINTS_REDEEMED':
      return `Đổi quà bằng ${String(newVal.pointsUsed ?? meta.pointsUsed ?? 0)} điểm thưởng`;
    default:
      return 'Cập nhật thông tin đơn hàng';
  }
}

function AuditDiffView({ oldValue, newValue, metadata }: { oldValue: any; newValue: any; metadata: any }) {
  const oldObj = oldValue && typeof oldValue === 'object' ? oldValue : null;
  const newObj = newValue && typeof newValue === 'object' ? newValue : null;

  // Gather keys to compare
  const allKeys = Array.from(
    new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})])
  ).filter(
    (k) =>
      k !== 'items' &&
      k !== 'orderItems' &&
      k !== 'password' &&
      k !== 'token' &&
      k !== 'id' &&
      k !== 'branchId' &&
      k !== 'orderId'
  );

  const formatVal = (val: any, key: string) => {
    if (val === undefined || val === null) return <span className="text-slate-300 italic">—</span>;
    if (typeof val === 'boolean') return val ? 'Có' : 'Không';
    if (typeof val === 'number') {
      if (
        key.toLowerCase().includes('amount') ||
        key.toLowerCase().includes('price') ||
        key.toLowerCase().includes('total')
      ) {
        return <strong className="font-mono text-emerald-600">{val.toLocaleString('vi-VN')}đ</strong>;
      }
      return <span className="font-mono font-bold">{val}</span>;
    }
    if (typeof val === 'string') {
      if (val.length === 0) return <span className="text-slate-300 italic">—</span>;
      return <span>{val}</span>;
    }
    return <span className="font-mono text-[10px]">{JSON.stringify(val)}</span>;
  };

  const getFieldLabel = (key: string): string => {
    const labels: Record<string, string> = {
      status: 'Trạng thái đơn',
      paymentStatus: 'Trạng thái thanh toán',
      kitchenStatus: 'Trạng thái bếp',
      totalAmount: 'Tổng tiền',
      subtotal: 'Tiền hàng',
      finalAmount: 'Khách cần trả',
      discountAmount: 'Giảm giá',
      paidAmount: 'Tiền đã trả',
      tableName: 'Bàn phục vụ',
      tableCode: 'Mã bàn',
      customerName: 'Tên khách',
      customerPhone: 'Số ĐT khách',
      guestCount: 'Số lượng khách',
      orderType: 'Hình thức phục vụ',
      note: 'Ghi chú',
      reason: 'Lý do',
      cancelReason: 'Lý do hủy',
    };
    return labels[key] || key;
  };

  const oldItems = Array.isArray(oldObj?.items || oldObj?.orderItems)
    ? oldObj?.items || oldObj?.orderItems
    : null;
  const newItems = Array.isArray(newObj?.items || newObj?.orderItems)
    ? newObj?.items || newObj?.orderItems
    : null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-3">
      {/* Before / After Comparison Table */}
      {allKeys.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white text-xs shadow-2xs">
          <div className="grid grid-cols-3 bg-slate-100/80 px-3 py-2 font-bold text-slate-600 border-b border-slate-200 text-[11px]">
            <span>Thông tin thay đổi</span>
            <span className="text-rose-600">Trước khi sửa</span>
            <span className="text-emerald-600">Sau khi sửa</span>
          </div>
          <div className="divide-y divide-slate-100">
            {allKeys.map((key) => {
              const oldV = oldObj ? oldObj[key] : undefined;
              const newV = newObj ? newObj[key] : undefined;
              const isDifferent = JSON.stringify(oldV) !== JSON.stringify(newV);
              return (
                <div
                  key={key}
                  className={`grid grid-cols-3 px-3 py-2 items-center text-[11px] ${
                    isDifferent ? 'bg-amber-50/40' : ''
                  }`}
                >
                  <span className="font-semibold text-slate-700">{getFieldLabel(key)}</span>
                  <div className="pr-2">{formatVal(oldV, key)}</div>
                  <div className="pl-2">{formatVal(newV, key)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dishes Diff List if items were changed */}
      {(oldItems || newItems) && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 text-xs">
          <span className="font-bold text-slate-700 block">Chi tiết món ăn trong đơn:</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {oldItems && (
              <div className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-100 space-y-1">
                <span className="font-bold text-rose-700 block">Danh sách món trước:</span>
                {oldItems.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center py-0.5">
                    <span>
                      {it.quantity || 1}x {it.productName || it.name || it.product?.name || 'Món ăn'}
                    </span>
                    <span className="font-mono">{formatVnd(it.price || it.priceAtSale || 0)}</span>
                  </div>
                ))}
              </div>
            )}
            {newItems && (
              <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 space-y-1">
                <span className="font-bold text-emerald-700 block">Danh sách món sau:</span>
                {newItems.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center py-0.5">
                    <span>
                      {it.quantity || 1}x {it.productName || it.name || it.product?.name || 'Món ăn'}
                    </span>
                    <span className="font-mono">{formatVnd(it.price || it.priceAtSale || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technical raw JSON drawer */}
      <details className="text-[11px] group">
        <summary className="font-mono text-slate-400 hover:text-slate-600 cursor-pointer select-none">
          ▸ Xem dữ liệu kỹ thuật thô (Raw JSON)
        </summary>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[10px]">
          <div>
            <span className="text-rose-400 block font-bold mb-1">// Giá trị trước:</span>
            <pre className="overflow-x-auto whitespace-pre-wrap">
              {oldValue ? JSON.stringify(oldValue, null, 2) : 'null'}
            </pre>
          </div>
          <div>
            <span className="text-emerald-400 block font-bold mb-1">// Giá trị sau:</span>
            <pre className="overflow-x-auto whitespace-pre-wrap">
              {newValue ? JSON.stringify(newValue, null, 2) : 'null'}
            </pre>
          </div>
          {metadata && (
            <div className="md:col-span-2 mt-2 pt-2 border-t border-slate-800">
              <span className="text-amber-400 block font-bold mb-1">// Dữ liệu bổ sung:</span>
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

export function OrderAuditTimeline({ orderId }: { orderId: string }) {
  const [logs, setLogs] = useState<OrderAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const url = `/api/admin/orders/${orderId}/timeline${activeCategory !== 'ALL' ? `?category=${activeCategory}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setLogs(Array.isArray(json.data) ? json.data : []);
        }
      } catch (e) {
        console.error('Error fetching order audit logs:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [orderId, activeCategory]);

  const sortedLogs = useMemo(() => {
    const cloned = [...logs];
    cloned.sort((a, b) => {
      const tA = new Date(a.createdAt).getTime();
      const tB = new Date(b.createdAt).getTime();
      return sortOrder === 'ASC' ? tA - tB : tB - tA;
    });
    return cloned;
  }, [logs, sortOrder]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatVietnamTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getVisualConfig = (action: string): ActionVisualConfig => {
    return (
      ACTION_CONFIG_MAP[action] || {
        label: action,
        icon: Clock,
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
        dotClass: 'bg-slate-500',
        iconClass: 'text-slate-600',
      }
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden mt-6">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-red-600 shrink-0" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Lịch sử hoạt động đơn hàng (Audit Timeline)
            </h3>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
              {logs.length} sự kiện
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowUpDown size={13} className="text-slate-500" />
            <span>{sortOrder === 'ASC' ? 'Theo thứ tự thời gian (Cũ → Mới)' : 'Mới nhất trước'}</span>
          </button>
        </div>

        {/* Categories Tab Pill Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveCategory(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm animate-pulse">
            Đang nạp lịch sử hoạt động đơn hàng...
          </div>
        ) : sortedLogs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            Chưa có bản ghi hoạt động nào trong phân mục này
          </div>
        ) : (
          <div className="relative pl-7 sm:pl-9 space-y-4 before:absolute before:left-3.5 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {sortedLogs.map((log) => {
              const isExpanded = expandedIds.has(log.id);
              const visual = getVisualConfig(log.action);
              const ActionIcon = visual.icon;
              const summaryText = buildAuditSummary(log);

              return (
                <div key={log.id} className="relative group">
                  {/* Timeline icon node */}
                  <div
                    className={`absolute -left-7 sm:-left-9 top-2 w-7 h-7 rounded-full border-2 border-white bg-white shadow-xs flex items-center justify-center ring-1 ring-slate-200 ${visual.iconClass}`}
                  >
                    <ActionIcon size={14} strokeWidth={2.3} />
                  </div>

                  <div className="bg-slate-50/75 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${visual.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${visual.dotClass}`} />
                          {visual.label}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {log.actorName || 'Hệ thống'}
                        </span>
                        {log.actorRole && (
                          <span className="text-[10px] bg-slate-200/80 text-slate-600 font-semibold px-1.5 py-0.5 rounded uppercase">
                            {log.actorRole}
                          </span>
                        )}
                        {log.actorUsername && (
                          <span className="text-xs text-slate-400 hidden sm:inline">
                            ({log.actorUsername})
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-medium tabular-nums">
                        {formatVietnamTime(log.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-[13px] text-slate-700 mt-2 font-medium leading-relaxed bg-white px-3 py-2 rounded-lg border border-slate-100">
                      {summaryText}
                    </p>

                    {/* Metadata & Collapsible technical diff */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        {log.branchName && (
                          <span>
                            Chi nhánh: <strong className="text-slate-700">{log.branchName}</strong>
                          </span>
                        )}
                        {log.ipAddress && <span className="hidden md:inline">IP: {log.ipAddress}</span>}
                      </div>

                      {(log.oldValue || log.newValue || log.metadata) && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(log.id)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span>{isExpanded ? 'Thu gọn dữ liệu' : 'Xem trước / sau'}</span>
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <AuditDiffView
                        oldValue={log.oldValue}
                        newValue={log.newValue}
                        metadata={{ ...log.metadata, correlationId: log.correlationId }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
