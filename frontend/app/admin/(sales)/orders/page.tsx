'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Search,
  Eye,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  Package,
  XCircle,
  FileText,
  RotateCw,
  Store,
  CreditCard,
  Printer,
  SlidersHorizontal,
  Globe,
  Receipt,
  Lock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  PageHeader,
  FilterBar,
  SearchInput,
  StatusBadge,
  DataTable,
  MobileDataCard,
  Pagination,
} from '@/app/admin/components/ui';
import { buildApiUrl } from '@/lib/utils/api';
import { printOrderInvoice } from '@/lib/utils/print-order';
import {
  OrderFilterModal,
  OrderFilterValues,
  DEFAULT_FILTER_VALUES,
} from './OrderFilterModal';

interface Order {
  id: string;
  orderCode: string;
  totalAmount: number;
  subTotal: number;
  shippingFee: number;
  discountAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  transactionId?: string;
  status: string;
  orderSource?: string;
  orderType?: string;
  createdAt: string;
  note: string;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string;
  table?: { id: string; name: string };
  branch?: { id: string; name: string; street?: string; ward?: string; district?: string; province?: string };
  orderItems?: any[];
  voucher?: { code: string; discountType: string; discountValue: number };
  isViewedByAdmin?: boolean;
  isInvoiceRequested?: boolean;
  invoiceCompanyName?: string;
  invoiceTaxCode?: string;
  invoiceAddress?: string;
  invoiceEmail?: string;
  cancelReason?: string;
  canceledBy?: string;
  user?: { id?: string; fullName?: string; email?: string; phone?: string };
  cashierName?: string | null;
}

interface Meta {
  total: number;
  totalPages: number;
  page: number;
}

const STATUS_KEYS = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'DELIVERING',
  'COMPLETED',
  'CANCELLED',
] as const;

export default function AdminOrdersPage() {
  const router = useRouter();
  const { selectedBranchId, role } = useAdmin();
  const { t, locale } = useLanguage();

  // 1. Order Data & Pagination State
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  // 2. Main Order Classification Tab: TẤT CẢ | ĐƠN HÀNG POS | ĐƠN HÀNG ONLINE
  const [orderTab, setOrderTab] = useState<'ALL' | 'POS' | 'ONLINE'>('ALL');
  const [tabCounts, setTabCounts] = useState<{ ALL: number; POS: number; ONLINE: number }>({
    ALL: 0,
    POS: 0,
    ONLINE: 0,
  });

  // 3. Status KPI Quick Filter
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // 4. Search & Quick Filters
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState<string>('');

  // 5. Professional Filter Modal State & Filter Options
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [modalFilters, setModalFilters] = useState<OrderFilterValues>(DEFAULT_FILTER_VALUES);
  const [filterOptions, setFilterOptions] = useState<{
    branches: Array<{ id: string; name: string }>;
    cashiers: string[];
    paymentMethods: Array<{ id: string; name: string; methodCode: string }>;
  }>({
    branches: [],
    cashiers: [],
    paymentMethods: [],
  });

  // Load filter options (branches, cashiers, payment methods) once on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const url = buildApiUrl('/api/admin/orders/filter-options', {});
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setFilterOptions(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    fetchOptions();
  }, []);

  // Fetch orders from API
  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const queryParams: Record<string, any> = {
          page,
          limit: 12,
          tab: orderTab,
        };

        // Chi nhánh
        if (modalFilters.branchId && modalFilters.branchId !== 'ALL') {
          queryParams.branchId = modalFilters.branchId;
        } else if (selectedBranchId && selectedBranchId !== 'ALL') {
          queryParams.branchId = selectedBranchId;
        }

        // Trạng thái đơn
        const effectiveStatus = modalFilters.status || filterStatus;
        if (effectiveStatus) queryParams.status = effectiveStatus;

        // Tìm kiếm
        if (search.trim()) queryParams.search = search.trim();

        // Trạng thái thanh toán
        if (paymentStatus) queryParams.paymentStatus = paymentStatus;

        // Thu ngân
        if (modalFilters.cashierName && modalFilters.cashierName !== 'ALL') {
          queryParams.cashierName = modalFilters.cashierName;
        }

        // Trạng thái hóa đơn điện tử
        if (modalFilters.isInvoiceRequested) {
          queryParams.isInvoiceRequested = modalFilters.isInvoiceRequested;
        }

        // Phương thức thanh toán
        if (modalFilters.paymentMethod && modalFilters.paymentMethod !== 'ALL') {
          queryParams.paymentMethod = modalFilters.paymentMethod;
        }

        // Sắp xếp
        if (modalFilters.sortBy) {
          queryParams.sortBy = modalFilters.sortBy;
        }

        // Khoảng ngày
        if (modalFilters.dateFrom) queryParams.from = modalFilters.dateFrom;
        if (modalFilters.dateTo) queryParams.to = modalFilters.dateTo;

        const url = buildApiUrl('/api/admin/orders', queryParams);
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setOrders(json.data || []);
          if (json.meta) setMeta(json.meta);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderTab, selectedBranchId, filterStatus, search, paymentStatus, modalFilters, page]
  );

  // Fetch status counts and tab counts
  const fetchStatusCounts = useCallback(async () => {
    try {
      const queryParams: Record<string, any> = {
        tab: orderTab,
      };

      if (modalFilters.branchId && modalFilters.branchId !== 'ALL') {
        queryParams.branchId = modalFilters.branchId;
      } else if (selectedBranchId && selectedBranchId !== 'ALL') {
        queryParams.branchId = selectedBranchId;
      }

      if (modalFilters.dateFrom) queryParams.from = modalFilters.dateFrom;
      if (modalFilters.dateTo) queryParams.to = modalFilters.dateTo;

      const url = buildApiUrl('/api/admin/orders/status-counts', queryParams);
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setStatusCounts(json.data);
          if (json.data.tabCounts) {
            setTabCounts(json.data.tabCounts);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching status counts:', err);
    }
  }, [orderTab, selectedBranchId, modalFilters]);

  useEffect(() => {
    fetchOrders(false);
    fetchStatusCounts();
  }, [fetchOrders, fetchStatusCounts]);

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const getStatusLabel = (key: string) => {
    switch (key) {
      case 'PENDING':
        return t('status.PENDING', 'Chờ xác nhận');
      case 'CONFIRMED':
        return t('status.CONFIRMED', 'Đã xác nhận');
      case 'PREPARING':
        return t('status.PREPARING', 'Đang chuẩn bị');
      case 'DELIVERING':
        return t('status.DELIVERING', 'Đang giao');
      case 'COMPLETED':
        return t('status.COMPLETED', 'Hoàn thành');
      case 'CANCELLED':
        return t('status.CANCELLED', 'Đã hủy');
      default:
        return key;
    }
  };

  // Count how many filters in the modal are active
  const activeModalFiltersCount = [
    modalFilters.branchId !== 'ALL',
    modalFilters.cashierName !== 'ALL',
    Boolean(modalFilters.status),
    Boolean(modalFilters.isInvoiceRequested),
    modalFilters.paymentMethod !== 'ALL',
    modalFilters.sortBy !== 'date_desc',
    Boolean(modalFilters.dateFrom),
    Boolean(modalFilters.dateTo),
  ].filter(Boolean).length;

  const hasAnyFilters = Boolean(
    filterStatus ||
    paymentStatus ||
    search ||
    activeModalFiltersCount > 0
  );

  const handleClearAllFilters = () => {
    setFilterStatus('');
    setPaymentStatus('');
    setSearch('');
    setModalFilters(DEFAULT_FILTER_VALUES);
    setPage(1);
  };

  const columns = [
    {
      key: 'orderCode',
      header: t('table.orderCode', 'Mã đơn'),
      render: (order: Order) => (
        <div className="flex items-center gap-2">
          {!order.isViewedByAdmin && (
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-slate-900 block text-xs sm:text-sm">
                #{order.orderCode}
              </span>
              {order.orderSource === 'POS' ? (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 text-orange-700 border border-orange-200">
                  POS
                </span>
              ) : (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200">
                  Online
                </span>
              )}
            </div>
            {order.branch && (
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                <Store size={11} /> {order.branch.name}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t('table.customer', 'Khách hàng'),
      render: (order: Order) => (
        <div>
          <p className="font-bold text-xs sm:text-sm text-slate-800">
            {order.customerName || order.user?.fullName || (order.table ? `Bàn: ${order.table.name}` : 'Khách vãng lai')}
          </p>
          <span className="text-[11px] text-slate-400">
            {order.customerPhone || order.user?.phone || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: t('table.totalAmount', 'Tổng tiền'),
      align: 'right' as const,
      render: (order: Order) => (
        <div className="text-right">
          <p className="font-black text-xs sm:text-sm text-slate-900">
            {formatMoney(order.totalAmount)}
          </p>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                order.paymentStatus === 'PAID'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {order.paymentStatus === 'PAID'
                ? t('status.PAID', 'Đã TT')
                : t('status.UNPAID', 'Chưa TT')}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'payment',
      header: 'Thanh toán & Tiền về',
      render: (order: Order) => {
        const isSepayAutoPaid =
          order.paymentMethod === 'SEPAY' &&
          order.paymentStatus === 'PAID';

        return (
          <div className="flex flex-col gap-1 min-w-[155px]">
            {isSepayAutoPaid ? (
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit select-none shadow-2xs">
                  <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                  Tiền đã về TK (SePay)
                </span>
                {order.transactionId && (
                  <span className="text-[10px] font-mono text-slate-500 font-semibold truncate max-w-[160px]" title={order.transactionId}>
                    Mã GD: {order.transactionId}
                  </span>
                )}
                <span className="text-[9px] text-emerald-700 font-medium flex items-center gap-1 select-none">
                  <Lock size={9} className="text-emerald-600" />
                  Khóa sửa thủ công
                </span>
              </div>
            ) : order.paymentStatus === 'PAID' ? (
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit select-none">
                  <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                  {order.paymentMethod === 'CASH' ? 'Tiền mặt' : order.paymentMethod} (Đã TT)
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 w-fit select-none">
                  <Clock size={11} className="text-amber-500 shrink-0" />
                  {order.paymentMethod === 'CASH' ? 'Tiền mặt' : (order.paymentMethod || 'Chưa TT')} (Chưa TT)
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: t('table.status', 'Trạng thái'),
      align: 'center' as const,
      render: (order: Order) => (
        <div className="flex flex-col items-center justify-center gap-1">
          <StatusBadge status={order.status} size="sm" />
          {/* Huy hiệu YCXHĐCT nếu đơn có yêu cầu xuất hóa đơn công ty */}
          {order.isInvoiceRequested && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-800 border border-amber-300 tracking-wider shadow-2xs select-none"
              title={`Yêu cầu xuất hóa đơn công ty (VAT)${order.invoiceCompanyName ? `: ${order.invoiceCompanyName}` : ''}`}
            >
              YCXHĐCT
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('table.time', 'Thời gian'),
      render: (order: Order) => (
        <div>
          <span className="text-xs text-slate-500 font-medium block">
            {new Date(order.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
          {order.cashierName && (
            <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
              Thu ngân: {order.cashierName}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('table.action', 'Thao tác'),
      align: 'right' as const,
      render: (order: Order) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            disabled={printingOrderId === order.id}
            onClick={(e) => {
              e.stopPropagation();
              printOrderInvoice(
                order,
                () => setPrintingOrderId(order.id),
                () => setPrintingOrderId(null),
              );
            }}
            title="In hóa đơn"
            aria-label="In hóa đơn"
            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Printer
              size={17}
              strokeWidth={2.2}
              className={printingOrderId === order.id ? 'animate-spin text-red-600' : ''}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/admin/orders/${order.id}`);
            }}
            aria-label={t('common.details', 'Xem chi tiết đơn hàng')}
            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Eye size={17} strokeWidth={2.2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t('orders.title', 'Quản lý Đơn hàng')}
        subtitle={t('orders.subtitle', 'Theo dõi, xác nhận và xử lý đơn đặt món trực tiếp & giao hàng')}
        breadcrumbs={[
          { label: t('nav.sales', 'Bán hàng') },
          { label: t('nav.orders', 'Đơn hàng') },
        ]}
        badge={
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            {t('common.total', 'Tổng')} {meta.total} {t('common.results', 'đơn')}
          </span>
        }
        actions={
          <button
            type="button"
            onClick={() => {
              fetchOrders(false);
              fetchStatusCounts();
            }}
            aria-label={t('common.refresh', 'Làm mới danh sách')}
            className="flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{t('common.refresh', 'Làm mới')}</span>
          </button>
        }
      />

      {/* 3 Main Order Source Tabs: TẤT CẢ | ĐƠN HÀNG POS | ĐƠN HÀNG ONLINE */}
      <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-200/70 rounded-xl sm:rounded-2xl border border-slate-200/80 w-full sm:w-fit max-w-full overflow-x-auto scrollbar-none shadow-inner py-1 shrink-0">
        {[
          {
            id: 'ALL',
            label: 'Tất cả',
            icon: FileText,
            count: tabCounts.ALL,
          },
          {
            id: 'POS',
            label: 'Đơn POS',
            icon: Store,
            count: tabCounts.POS,
          },
          {
            id: 'ONLINE',
            label: 'Đơn Online',
            icon: ShoppingBag,
            count: tabCounts.ONLINE,
          },
        ].map((tab) => {
          const isActive = orderTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setOrderTab(tab.id as any);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer select-none shrink-0 ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icon size={13} className={isActive ? 'text-[#5b3eb8]' : 'text-slate-400'} />
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black ${
                  isActive
                    ? 'bg-purple-100 text-[#5b3eb8]'
                    : 'bg-slate-300/60 text-slate-600'
                }`}
              >
                {tab.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status KPI Filter Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2.5 md:gap-3">
        {STATUS_KEYS.map((key) => {
          const isActive = (modalFilters.status || filterStatus) === key;
          const count = statusCounts[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                const nextStatus = isActive ? '' : key;
                setFilterStatus(nextStatus);
                setModalFilters((prev) => ({ ...prev, status: nextStatus }));
                setPage(1);
              }}
              className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                isActive
                  ? 'bg-red-50/90 border-red-300 text-red-700 shadow-xs'
                  : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200 shadow-2xs'
              }`}
            >
              <span className="text-[10px] sm:text-[11px] font-bold block truncate">
                {getStatusLabel(key)}
              </span>
              <span
                className={`text-sm sm:text-base md:text-lg font-black block mt-0.5 ${
                  isActive ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar with Search & Professional Filter Modal Trigger */}
      <FilterBar
        actions={
          hasAnyFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
            >
              {t('common.clearFilter', 'Xóa bộ lọc')}
            </button>
          )
        }
      >
        {/* Quick Search */}
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder={t('common.search', 'Tìm mã đơn, tên khách, SĐT...')}
          />
        </div>

        {/* Professional Filter Modal Trigger Button */}
        <button
          type="button"
          onClick={() => setIsFilterModalOpen(true)}
          className={`h-10 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all shadow-2xs cursor-pointer ${
            activeModalFiltersCount > 0
              ? 'bg-purple-50 border-purple-300 text-[#5b3eb8] hover:bg-purple-100/80 font-extrabold'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal size={14} className={activeModalFiltersCount > 0 ? 'text-[#5b3eb8]' : 'text-slate-400'} />
          <span>Bộ lọc tìm kiếm</span>
          {activeModalFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#5b3eb8] text-white text-[10px] font-black flex items-center justify-center">
              {activeModalFiltersCount}
            </span>
          )}
        </button>

        {/* Quick Payment Status Dropdown */}
        <select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-purple-600 shadow-2xs cursor-pointer"
        >
          <option value="">{t('common.all', 'Tất cả TT')}</option>
          <option value="PAID">{t('status.PAID', 'Đã thanh toán')}</option>
          <option value="UNPAID">{t('status.UNPAID', 'Chưa thanh toán')}</option>
        </select>
      </FilterBar>

      {/* Professional Filter Modal Component */}
      <OrderFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        initialValues={modalFilters}
        branches={filterOptions.branches}
        cashiers={filterOptions.cashiers}
        paymentMethods={filterOptions.paymentMethods}
        onApply={(newFilters) => {
          setModalFilters(newFilters);
          if (newFilters.status) setFilterStatus(newFilters.status);
          setPage(1);
        }}
        onReset={() => {
          setModalFilters(DEFAULT_FILTER_VALUES);
          setFilterStatus('');
          setPage(1);
        }}
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={orders}
        keyExtractor={(o) => o.id}
        loading={loading}
        onRowClick={(o) => router.push(`/admin/orders/${o.id}`)}
        emptyTitle={t('common.noData', 'Không tìm thấy đơn hàng nào')}
        emptyDescription="Thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm."
        mobileCardRender={(order) => (
          <MobileDataCard
            title={
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded">
                  #{order.orderCode}
                </span>
                {order.orderSource === 'POS' ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 text-orange-700 border border-orange-200">
                    POS
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200">
                    Online
                  </span>
                )}
              </div>
            }
            subtitle={order.customerName || (order.table ? `Bàn: ${order.table.name}` : 'Khách vãng lai')}
            badge={
              <div className="flex items-center gap-1">
                <StatusBadge status={order.status} size="sm" />
                {order.isInvoiceRequested && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-800 border border-amber-300">
                    YCXHĐCT
                  </span>
                )}
              </div>
            }
            details={[
              {
                label: t('table.totalAmount', 'Tổng tiền'),
                value: <strong className="text-red-600">{formatMoney(order.totalAmount)}</strong>,
              },
              {
                label: t('table.branch', 'Chi nhánh'),
                value: order.branch?.name || '-',
              },
              {
                label: t('table.paymentStatus', 'Thanh toán'),
                value:
                  order.paymentMethod === 'SEPAY' && order.paymentStatus === 'PAID' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 size={10} className="text-emerald-600" />
                      SePay Tự Động (Khóa)
                    </span>
                  ) : order.paymentStatus === 'PAID' ? (
                    <span className="text-emerald-600 font-bold text-xs">Đã TT ({order.paymentMethod === 'CASH' ? 'Tiền mặt' : order.paymentMethod})</span>
                  ) : (
                    <span className="text-amber-600 font-bold text-xs">Chưa TT</span>
                  ),
              },
              {
                label: t('table.time', 'Thời gian'),
                value: new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                }),
              },
            ]}
            actions={
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  disabled={printingOrderId === order.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    printOrderInvoice(
                      order,
                      () => setPrintingOrderId(order.id),
                      () => setPrintingOrderId(null),
                    );
                  }}
                  className="flex-1 min-h-[40px] py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Printer size={14} className={printingOrderId === order.id ? 'animate-spin' : ''} />
                  <span>{printingOrderId === order.id ? 'Đang tải...' : 'In hóa đơn'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                  className="flex-1 min-h-[40px] py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye size={14} />
                  <span>{t('common.details', 'Xem chi tiết')}</span>
                </button>
              </div>
            }
          />
        )}
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        pageSize={12}
        onPageChange={setPage}
        itemName={t('nav.orders', 'đơn hàng')}
      />
    </div>
  );
}
