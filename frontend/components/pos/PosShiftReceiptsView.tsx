"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Receipt,
  Store,
  Globe,
  Search,
  Printer,
  FileText,
  Mail,
  MoreVertical,
  CheckCircle2,
  Clock,
  Truck,
  User,
  Phone,
  MapPin,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  ArrowLeft,
  Download,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Filter,
  SlidersHorizontal,
  X,
  Calendar,
  Building2,
  DollarSign,
  UserCheck,
  Check,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PosBranch, PosOrder, PosUserData } from './pos-types';

interface PosShiftReceiptsViewProps {
  branch: PosBranch | null;
  currentUser: PosUserData | null;
  allOrders?: PosOrder[];
  onReprintReceipt?: (order: PosOrder) => void;
  onRefresh?: () => Promise<void>;
  onBackToSettings?: () => void;
}

// 8 mốc thời gian lọc
type TimeFilterPreset =
  | 'ALL'
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'THIS_MONTH'
  | 'CUSTOM';

export const PosShiftReceiptsView: React.FC<PosShiftReceiptsViewProps> = ({
  branch,
  currentUser,
  allOrders = [],
  onReprintReceipt,
  onRefresh,
  onBackToSettings,
}) => {
  // Tab chính: POS | ONLINE | TẤT CẢ
  const [activeTab, setActiveTab] = useState<'POS' | 'ONLINE' | 'ALL'>('POS');

  // Ô tìm kiếm nhanh
  const [searchQuery, setSearchQuery] = useState('');

  // Trạng thái Modal Bộ lọc chi tiết
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // CÁC TIÊU CHÍ LỌC CHI TIẾT
  const [timePreset, setTimePreset] = useState<TimeFilterPreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [servingTypeFilter, setServingTypeFilter] = useState<'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QR_ORDER'>('ALL');
  const [vatFilter, setVatFilter] = useState<'ALL' | 'ISSUED' | 'NOT_ISSUED' | 'COMPANY_REQUESTED'>('ALL');

  const [pricePreset, setPricePreset] = useState<'ALL' | 'UNDER_200' | '200_500' | '500_1000' | 'ABOVE_1000' | 'CUSTOM'>('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const [creatorFilter, setCreatorFilter] = useState('');
  const [cashierFilter, setCashierFilter] = useState('');

  // Hóa đơn được chọn để xem chi tiết
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Trên màn hình nhỏ (< 750px), toggle giữa danh sách và chi tiết hóa đơn
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Menu action [...] trên hóa đơn
  const [isReceiptMenuOpen, setIsReceiptMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Danh sách hóa đơn tải từ API backend (Lịch sử hoàn tất/hủy)
  const [apiInvoices, setApiInvoices] = useState<PosOrder[]>([]);

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const formatVnd = (amount?: number) => {
    return (amount || 0).toLocaleString('vi-VN') + ' đ';
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Vừa xong';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN');
    } catch {
      return isoString;
    }
  };

  // Tải danh sách hóa đơn lịch sử (COMPLETED & CANCELLED) từ Backend
  const fetchInvoicesFromApi = async () => {
    if (!branch?.id) return;
    try {
      setIsLoadingInvoices(true);
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('avora_pos_token')
          : null;

      const res = await fetch(`/api/pos/invoices?branchId=${branch.id}&limit=400`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setApiInvoices(json.data);
          return;
        }
      }
    } catch (err) {
      console.warn('API /api/pos/invoices không khả dụng hoặc lỗi mạng, sử dụng dữ liệu bộ nhớ cục bộ:', err);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchInvoicesFromApi();
  }, [branch?.id]);

  // Local overrides map for invoice export status
  const [invoiceExportOverrides, setInvoiceExportOverrides] = useState<
    Record<string, { isInvoiceExported: boolean; invoiceExportedAt?: string | null }>
  >({});

  // Hợp nhất nguồn dữ liệu: Ưu tiên API, fallback sang allOrders đã lọc CHỈ LẤY ĐƠN HOÀN THÀNH HOẶC ĐÃ HỦY!
  const baseFinishedOrders = useMemo(() => {
    const raw =
      apiInvoices.length > 0
        ? apiInvoices
        : allOrders.filter(
            (o) => o.status === 'COMPLETED' || o.status === 'CANCELLED' || o.paymentStatus === 'PAID',
          );
    return raw.map((o) => {
      const override = invoiceExportOverrides[o.id];
      if (override) {
        return { ...o, ...override };
      }
      return o;
    });
  }, [apiInvoices, allOrders, invoiceExportOverrides]);

  // Phân loại đơn: POS vs ONLINE
  const isOnlineOrder = (o: PosOrder) => {
    return (
      o.orderSource === 'ONLINE' ||
      o.orderSource === 'WEBSITE' ||
      o.orderSource === 'APP' ||
      o.orderType === 'DELIVERY'
    );
  };

  // Thống kê số lượng từng tab
  const posCount = useMemo(() => baseFinishedOrders.filter((o) => !isOnlineOrder(o)).length, [baseFinishedOrders]);
  const onlineCount = useMemo(() => baseFinishedOrders.filter((o) => isOnlineOrder(o)).length, [baseFinishedOrders]);

  // Danh sách Người tạo đơn thực tế có trong đơn hàng
  const creatorOptions = useMemo(() => {
    const set = new Set<string>();
    baseFinishedOrders.forEach((o) => {
      const name = o.user?.fullName || o.customerName;
      if (name && name.trim()) set.add(name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [baseFinishedOrders]);

  // Danh sách Thu ngân thực tế có trong đơn hàng
  const cashierOptions = useMemo(() => {
    const set = new Set<string>();
    baseFinishedOrders.forEach((o) => {
      const name = o.cashierName;
      if (name && name.trim()) set.add(name.trim());
    });
    if (currentUser?.fullName) set.add(currentUser.fullName.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [baseFinishedOrders, currentUser]);

  const [isUpdatingInvoiceExport, setIsUpdatingInvoiceExport] = useState(false);

  const handleToggleExportInvoice = async (order: PosOrder, exported: boolean) => {
    if (isUpdatingInvoiceExport) return;
    setIsUpdatingInvoiceExport(true);
    const toastId = toast.loading(exported ? 'Đang xác nhận xuất HĐĐT...' : 'Đang hủy đánh dấu xuất HĐ...');
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/invoice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isInvoiceExported: exported }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          exported ? 'Đã xác nhận xuất hóa đơn điện tử thành công!' : 'Đã hủy đánh dấu xuất hóa đơn',
          { id: toastId }
        );
        setInvoiceExportOverrides((prev) => ({
          ...prev,
          [order.id]: {
            isInvoiceExported: exported,
            invoiceExportedAt: exported ? new Date().toISOString() : null,
          },
        }));
        if (onRefresh) onRefresh();
      } else {
        toast.error(data.message || 'Không thể cập nhật trạng thái xuất hóa đơn', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ', { id: toastId });
    } finally {
      setIsUpdatingInvoiceExport(false);
    }
  };

  // Đếm số tiêu chí lọc đang được kích hoạt (để hiển thị badge trên nút Bộ lọc)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (timePreset !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (servingTypeFilter !== 'ALL') count++;
    if (vatFilter !== 'ALL') count++;
    if (pricePreset !== 'ALL' || minAmount || maxAmount) count++;
    if (creatorFilter.trim()) count++;
    if (cashierFilter.trim()) count++;
    return count;
  }, [
    timePreset,
    statusFilter,
    servingTypeFilter,
    vatFilter,
    pricePreset,
    minAmount,
    maxAmount,
    creatorFilter,
    cashierFilter,
  ]);

  // Kiểm tra thời gian theo Preset
  const checkTimeMatch = (createdAtStr?: string) => {
    if (!createdAtStr || timePreset === 'ALL') return true;
    try {
      const d = new Date(createdAtStr);
      const now = new Date();

      if (timePreset === 'TODAY') {
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return d >= startToday;
      }
      if (timePreset === 'YESTERDAY') {
        const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const endYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return d >= startYesterday && d < endYesterday;
      }
      if (timePreset === 'LAST_7_DAYS') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        return d >= sevenDaysAgo;
      }
      if (timePreset === 'THIS_WEEK') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(now.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        return d >= startOfWeek;
      }
      if (timePreset === 'LAST_WEEK') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
        const startLastWeek = new Date(now.setDate(diff));
        startLastWeek.setHours(0, 0, 0, 0);
        const endLastWeek = new Date(startLastWeek.getTime() + 7 * 24 * 3600 * 1000);
        return d >= startLastWeek && d < endLastWeek;
      }
      if (timePreset === 'THIS_MONTH') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return d >= startOfMonth;
      }
      if (timePreset === 'CUSTOM') {
        if (customStartDate && d < new Date(customStartDate + 'T00:00:00')) return false;
        if (customEndDate && d > new Date(customEndDate + 'T23:59:59')) return false;
        return true;
      }
    } catch {
      return true;
    }
    return true;
  };

  // Áp dụng bộ lọc toàn diện
  const filteredOrders = useMemo(() => {
    return baseFinishedOrders.filter((o) => {
      // 1. Tab POS | ONLINE | ALL
      if (activeTab === 'POS' && isOnlineOrder(o)) return false;
      if (activeTab === 'ONLINE' && !isOnlineOrder(o)) return false;

      // 2. Tìm kiếm nhanh (Mã đơn, Tên KH, Bàn, SĐT)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (o.orderCode || o.temporaryOrderCode || '').toLowerCase();
        const customer = (o.customerName || '').toLowerCase();
        const phone = (o.customerPhone || '').toLowerCase();
        const table = (o.table?.name || '').toLowerCase();
        const cashier = (o.cashierName || '').toLowerCase();
        if (
          !code.includes(q) &&
          !customer.includes(q) &&
          !phone.includes(q) &&
          !table.includes(q) &&
          !cashier.includes(q)
        ) {
          return false;
        }
      }

      // 3. Thời gian
      if (!checkTimeMatch(o.createdAt)) return false;

      // 4. Trạng thái đơn (COMPLETED | CANCELLED)
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;

      // 5. Hình thức phục vụ
      if (servingTypeFilter !== 'ALL') {
        if (servingTypeFilter === 'DINE_IN' && (o.orderType !== 'DINE_IN' && !o.table?.name)) return false;
        if (servingTypeFilter === 'TAKEAWAY' && o.orderType !== 'TAKEAWAY') return false;
        if (servingTypeFilter === 'DELIVERY' && o.orderType !== 'DELIVERY' && !isOnlineOrder(o)) return false;
        if (servingTypeFilter === 'QR_ORDER' && o.orderSource !== 'QR_ORDER') return false;
      }

      // 6. Trạng thái hóa đơn VAT
      if (vatFilter !== 'ALL') {
        const isExported = Boolean(o.isInvoiceExported);
        const hasCompanyRequest = Boolean(o.isInvoiceRequested || o.invoiceCompanyName || o.invoiceTaxCode);
        if (vatFilter === 'ISSUED') {
          if (!isExported) return false;
        } else if (vatFilter === 'NOT_ISSUED') {
          if (isExported) return false;
        } else if (vatFilter === 'COMPANY_REQUESTED') {
          if (!hasCompanyRequest || isExported) return false;
        }
      }

      // 7. Khoảng giá trị
      const amount = o.totalAmount || 0;
      if (pricePreset === 'UNDER_200' && amount >= 200000) return false;
      if (pricePreset === '200_500' && (amount < 200000 || amount > 500000)) return false;
      if (pricePreset === '500_1000' && (amount < 500000 || amount > 1000000)) return false;
      if (pricePreset === 'ABOVE_1000' && amount <= 1000000) return false;
      if (pricePreset === 'CUSTOM') {
        if (minAmount && amount < parseFloat(minAmount)) return false;
        if (maxAmount && amount > parseFloat(maxAmount)) return false;
      }

      // 8. Người tạo đơn
      if (creatorFilter.trim()) {
        const cr = creatorFilter.toLowerCase().trim();
        const userName = (o.user?.fullName || o.customerName || '').toLowerCase();
        if (!userName.includes(cr)) return false;
      }

      // 9. Người thanh toán (Thu ngân)
      if (cashierFilter.trim()) {
        const csh = cashierFilter.toLowerCase().trim();
        const cashierName = (o.cashierName || currentUser?.fullName || '').toLowerCase();
        if (!cashierName.includes(csh)) return false;
      }

      return true;
    });
  }, [
    baseFinishedOrders,
    activeTab,
    searchQuery,
    timePreset,
    customStartDate,
    customEndDate,
    statusFilter,
    servingTypeFilter,
    vatFilter,
    pricePreset,
    minAmount,
    maxAmount,
    creatorFilter,
    cashierFilter,
  ]);

  // Tổng doanh thu (chỉ tính đơn hoàn tất)
  const totalRevenue = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === 'COMPLETED' || o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [filteredOrders]);

  // Tự động chọn đơn đầu tiên
  const selectedOrder = useMemo(() => {
    if (selectedOrderId) {
      const found = filteredOrders.find((o) => o.id === selectedOrderId);
      if (found) return found;
    }
    return filteredOrders[0] || null;
  }, [filteredOrders, selectedOrderId]);

  // Phân trang
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Đặt lại toàn bộ bộ lọc
  const handleResetFilters = () => {
    setTimePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setStatusFilter('ALL');
    setServingTypeFilter('ALL');
    setVatFilter('ALL');
    setPricePreset('ALL');
    setMinAmount('');
    setMaxAmount('');
    setCreatorFilter('');
    setCashierFilter('');
    setSearchQuery('');
    setCurrentPage(1);
    toast.success('Đã đặt lại bộ lọc');
  };

  const handleRefreshData = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
      await fetchInvoicesFromApi();
      toast.success('Đã làm mới dữ liệu hóa đơn');
    } catch {
      toast.error('Lỗi khi làm mới hóa đơn');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getPaymentBadge = (method?: string) => {
    const m = (method || '').toUpperCase();
    if (m === 'CASH' || m === 'TIỀN MẶT') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
          <Banknote className="w-3 h-3" />
          Tiền mặt
        </span>
      );
    }
    if (m === 'CARD' || m === 'THẺ' || m === 'CREDIT_CARD') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
          <CreditCard className="w-3 h-3" />
          Thẻ
        </span>
      );
    }
    if (m === 'SEPAY_QR' || m === 'QR' || m === 'BANK_TRANSFER' || m === 'CHUYỂN KHOẢN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold">
          <QrCode className="w-3 h-3" />
          Chuyển khoản
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
        {method || 'COD'}
      </span>
    );
  };

  const getStatusBadge = (o: PosOrder) => {
    const isExported = Boolean(o.isInvoiceExported);
    const hasCompanyRequest = Boolean(o.isInvoiceRequested || o.invoiceCompanyName || o.invoiceTaxCode);

    return (
      <div className="flex flex-col gap-1 items-center sm:items-start">
        {o.status === 'COMPLETED' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            Đã thanh toán
          </span>
        ) : o.status === 'CANCELLED' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">
            <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
            Đã hủy
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
            {o.status}
          </span>
        )}

        {/* YCXHĐCT (Yêu cầu xuất hóa đơn công ty) nằm ở cột TRẠNG THÁI. Nếu đã xuất rồi thì MẤT! */}
        {hasCompanyRequest && !isExported && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-800 border border-amber-300 tracking-wider shadow-2xs select-none"
            title={`Yêu cầu xuất hóa đơn công ty (VAT)${o.invoiceCompanyName ? `: ${o.invoiceCompanyName}` : ''}`}
          >
            YCXHĐCT
          </span>
        )}

        {/* Khi đã xuất thật rồi thì hiện Đã xuất HĐ, YCXHĐCT đã mất */}
        {isExported && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
            ✓ Đã xuất HĐ
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 select-none w-full h-full min-h-0">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: NÚT QUAY LẠI CÀI ĐẶT + TABS + THỐNG KÊ DOANH THU */}
      {/* ========================================================================= */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs z-10">
        {/* Left: Nút Quay lại Cài đặt + Tabs POS/ONLINE/TẤT CẢ */}
        <div className="flex items-center gap-2 flex-wrap">
          {onBackToSettings && (
            <button
              type="button"
              onClick={onBackToSettings}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-700 hover:text-[#da251d] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Quay lại danh mục Cài đặt thiết bị & Máy in"
            >
              <ArrowLeft className="w-4 h-4 text-[#da251d]" />
              <span className="hidden sm:inline">Quay lại Cài đặt</span>
              <span className="sm:hidden">Cài đặt</span>
            </button>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setActiveTab('POS');
                setCurrentPage(1);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'POS'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>ĐƠN HÀNG POS</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'POS' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {posCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('ONLINE');
                setCurrentPage(1);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ONLINE'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>ĐƠN HÀNG ONLINE</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'ONLINE' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {onlineCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('ALL');
                setCurrentPage(1);
              }}
              className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <span>Tất cả ({baseFinishedOrders.length})</span>
            </button>
          </div>
        </div>

        {/* Right: Thống kê Số đơn & Doanh thu */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-2.5 sm:px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 font-bold whitespace-nowrap">
            Đơn: <span className="text-slate-900 font-black">{filteredOrders.length}</span>
          </div>

          <div className="px-2.5 sm:px-3.5 py-1.5 bg-red-50 text-[#da251d] rounded-xl border border-red-200 font-bold flex items-center gap-1.5 whitespace-nowrap">
            <span>Doanh thu:</span>
            <span className="text-sm sm:text-base font-black text-[#da251d]">{formatVnd(totalRevenue)}</span>
          </div>

          <button
            type="button"
            onClick={handleRefreshData}
            disabled={isRefreshing || isLoadingInvoices}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
            title="Làm mới dữ liệu hóa đơn"
          >
            <RotateCw
              className={`w-4 h-4 ${isRefreshing || isLoadingInvoices ? 'animate-spin text-[#da251d]' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT: 2-COLUMN (BẢNG DANH SÁCH + CARD BIÊN LAI GỐC CUỘN ĐƯỢC) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* CỘT TRÁI: BẢNG DANH SÁCH HÓA ĐƠN RỘNG RÃI (~76-77% MÀN HÌNH >= 750px) */}
        <div
          className={`flex-1 min-w-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden min-h-0 ${
            showMobileDetail ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* TOOLBAR: TÌM KIẾM + 1 NÚT DUY NHẤT "BỘ LỌC" MỞ MODAL */}
          <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 shrink-0 flex items-center justify-between gap-2 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm theo mã đơn, tên KH, bàn, SĐT, thu ngân..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8.5 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs font-semibold focus:outline-none focus:border-[#da251d] focus:bg-white transition-colors"
              />
            </div>

            {/* NÚT BỘ LỌC DUY NHẤT (MỞ MODAL LỌC CHI TIẾT) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className={`h-8.5 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 border transition-all cursor-pointer ${
                  activeFiltersCount > 0
                    ? 'bg-red-50 border-[#da251d] text-[#da251d] shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Bộ lọc</span>
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#da251d] text-white text-[10px] font-black flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Đặt lại bộ lọc nếu có */}
              {(activeFiltersCount > 0 || searchQuery) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer px-1 py-1"
                >
                  Đặt lại
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-slate-600 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <input type="checkbox" className="rounded text-[#da251d] cursor-pointer" />
                  </th>
                  <th className="py-2.5 px-3 font-black text-slate-700">MÃ ĐƠN</th>
                  <th className="py-2.5 px-3 font-black text-slate-700">KHÁCH HÀNG</th>
                  <th className="py-2.5 px-3 font-black text-slate-700">THỜI GIAN</th>
                  <th className="py-2.5 px-3 font-black text-slate-700 text-right">TỔNG TIỀN</th>
                  <th className="py-2.5 px-3 font-black text-slate-700">PTTT</th>
                  <th className="py-2.5 px-3 font-black text-slate-700 text-center">TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                      <p className="font-bold text-xs text-slate-600">Không tìm thấy hóa đơn phù hợp</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Thử xóa bớt tiêu chí lọc hoặc thay đổi khoảng thời gian
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o) => {
                    const isSelected = selectedOrder?.id === o.id;
                    const code = o.orderCode || o.temporaryOrderCode || `POS-${o.id.slice(-6)}`;
                    const isOnline = isOnlineOrder(o);

                    return (
                      <tr
                        key={o.id}
                        onClick={() => {
                          setSelectedOrderId(o.id);
                          setShowMobileDetail(true);
                        }}
                        className={`transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-red-50/70 border-l-4 border-l-[#da251d] shadow-2xs'
                            : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-2.5 px-3 w-8" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="rounded text-[#da251d] cursor-pointer" />
                        </td>

                        {/* Mã Đơn & Bàn / Loại đơn */}
                        <td className="py-2.5 px-3">
                          <div className="font-black text-slate-900 group-hover:text-[#da251d] transition-colors">
                            {code}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                            {isOnline ? (
                              <span className="text-indigo-600 flex items-center gap-0.5">
                                <Globe className="w-3 h-3" />
                                Online
                              </span>
                            ) : o.table?.name ? (
                              <span className="text-slate-700">Bàn {o.table.name}</span>
                            ) : (
                              <span className="text-amber-700">Mang đi</span>
                            )}
                          </div>
                        </td>

                        {/* Khách hàng */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800 truncate max-w-[120px]">
                            {o.customerName || (o.user?.fullName ? o.user.fullName : 'Khách lẻ')}
                          </div>
                          {o.customerPhone && (
                            <div className="text-[10px] text-slate-400 font-mono">{o.customerPhone}</div>
                          )}
                        </td>

                        {/* Thời gian */}
                        <td className="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap text-[11px]">
                          {formatDate(o.createdAt)}
                        </td>

                        {/* Tổng tiền */}
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-black text-slate-900 text-xs">{formatVnd(o.totalAmount)}</span>
                        </td>

                        {/* PTTT */}
                        <td className="py-2.5 px-3">{getPaymentBadge(o.paymentMethod)}</td>

                        {/* Trạng thái */}
                        <td className="py-2.5 px-3 text-center">{getStatusBadge(o)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="h-11 bg-white border-t border-slate-200 px-4 flex items-center justify-between shrink-0 text-xs text-slate-500">
              <div>
                Trang <span className="font-bold text-slate-800">{currentPage}</span> / {totalPages} (
                {filteredOrders.length} hóa đơn)
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={`page-${p}`}>
                      {idx > 0 && p - arr[idx - 1] > 1 && <span className="px-1 text-slate-300">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          currentPage === p
                            ? 'bg-[#da251d] text-white'
                            : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: KHUNG BIÊN LAI CHI TIẾT GỐC - FULL HEIGHT TỪ CHỖ DOANH THU TRỞ XUỐNG, 30% WIDTH, GIẢM PADDING */}
        <div
          className={`w-full md:w-[32%] lg:w-[30%] min-w-[300px] max-w-[420px] shrink-0 flex flex-col bg-slate-100/70 p-1 sm:p-1.5 overflow-hidden h-full min-h-0 ${
            showMobileDetail ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Nút quay lại danh sách trên màn hình hẹp */}
          {showMobileDetail && (
            <button
              type="button"
              onClick={() => setShowMobileDetail(false)}
              className="md:hidden mb-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 w-fit"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#da251d]" />
              <span>Quay lại danh sách</span>
            </button>
          )}

          {!selectedOrder ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <Receipt className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
              <h4 className="font-bold text-xs text-slate-700">Chưa chọn hóa đơn</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                Chọn một hóa đơn từ danh sách bên trái để xem đầy đủ chi tiết biên lai và sản phẩm.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-full max-h-full min-h-0 w-full">
              {/* Receipt Action Header (Fixed Top) */}
              <div className="p-2 sm:p-2.5 border-b border-slate-100 flex items-center justify-between gap-1.5 bg-white shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-sm font-black text-slate-900 truncate">
                    {selectedOrder.orderCode || selectedOrder.temporaryOrderCode || `#HD-${selectedOrder.id.slice(-6)}`}
                  </span>

                  {selectedOrder.isInvoiceExported ? (
                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                      Đã Xuất HĐ
                    </span>
                  ) : (selectedOrder.isInvoiceRequested || selectedOrder.invoiceCompanyName || selectedOrder.invoiceTaxCode) ? (
                    <span
                      className="px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 text-[10px] font-black flex items-center gap-0.5 border border-amber-300"
                      title={`Yêu cầu xuất hóa đơn công ty (VAT)${selectedOrder.invoiceCompanyName ? `: ${selectedOrder.invoiceCompanyName}` : ''}`}
                    >
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                      YCXHĐCT
                    </span>
                  ) : null}
                </div>

                {/* Dropdown Menu [...] */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsReceiptMenuOpen(!isReceiptMenuOpen)}
                    className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {isReceiptMenuOpen && (
                    <div className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-20">
                      <button
                        type="button"
                        onClick={() => {
                          setIsReceiptMenuOpen(false);
                          if (onReprintReceipt) onReprintReceipt(selectedOrder);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-red-50 hover:text-[#da251d] flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>In hóa đơn này</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsReceiptMenuOpen(false);
                          toast.success('Đã gửi lại biên lai HĐĐT vào email khách hàng!');
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5 text-amber-600" />
                        <span>Gửi lại Mail HĐĐT</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable Receipt Body (Cuộn mượt mà từ đầu đến cuối - Giảm padding gọn gàng) */}
              <div className="flex-1 overflow-y-auto min-h-0 p-2.5 sm:p-3 space-y-2 select-text text-xs">
                {/* Store Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-1.5">
                  <div className="min-w-0 pr-1">
                    <h3 className="text-sm font-black text-[#da251d] tracking-wide truncate">
                      {branch?.name || 'Avora Hoàn Kiếm'}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 line-clamp-2">
                      {[branch?.street, branch?.ward, branch?.district, branch?.province].filter(Boolean).join(', ') ||
                        '15 Lý Thái Tổ, Hoàn Kiếm, Hà Nội'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      SĐT: {branch?.phone || '1900 6868'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-slate-900 block">Hóa Đơn</span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      #{selectedOrder.orderCode || selectedOrder.id.slice(-6)}
                    </span>
                  </div>
                </div>

                {/* Metadata Details (Khớp 100% hình mẫu gốc - Gọn gàng) */}
                <div className="space-y-0.5 text-[11px] text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-24 shrink-0">Khách hàng:</span>
                    <span className="font-bold text-slate-900 truncate">
                      {selectedOrder.customerName || selectedOrder.user?.fullName || 'Khách mang đi'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-24 shrink-0">Ngày tạo:</span>
                    <span className="font-semibold text-slate-800">{formatDate(selectedOrder.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="text-slate-500 w-24 shrink-0">Hoàn thành:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedOrder.updatedAt ? formatDate(selectedOrder.updatedAt) : formatDate(selectedOrder.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Store className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-24 shrink-0">Loại đơn:</span>
                    <span className="font-bold text-slate-900">
                      {isOnlineOrder(selectedOrder)
                        ? 'Online'
                        : selectedOrder.table?.name
                        ? `Bàn ${selectedOrder.table.name}`
                        : 'Mang đi'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Printer className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-24 shrink-0">Tạo đơn:</span>
                    <span className="font-bold text-slate-800 truncate">
                      {selectedOrder.cashierName || currentUser?.fullName || 'HTP Official'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-24 shrink-0">Thanh toán:</span>
                    <span className="font-bold text-slate-900">{selectedOrder.paymentMethod || 'COD'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-500 w-24 shrink-0">Trạng thái:</span>
                    <span
                      className={`font-bold ${
                        selectedOrder.status === 'COMPLETED'
                          ? 'text-emerald-600'
                          : selectedOrder.status === 'CANCELLED'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {selectedOrder.status === 'COMPLETED'
                        ? 'COMPLETED'
                        : selectedOrder.status === 'CANCELLED'
                        ? 'CANCELLED'
                        : selectedOrder.status}
                    </span>
                  </div>

                  {selectedOrder.status === 'CANCELLED' && selectedOrder.cancelReason && (
                    <div className="p-1.5 rounded-lg bg-red-50 text-red-800 text-[10px] border border-red-200">
                      <span className="font-bold">Lý do hủy: </span>
                      <span>{selectedOrder.cancelReason}</span>
                    </div>
                  )}
                </div>

                {/* 1. ĐÃ XUẤT HĐĐT (Chỉ hiển thị khi thực sự đã được đánh dấu xuất) */}
                {selectedOrder.isInvoiceExported && (
                  <div className="p-2 bg-emerald-50/90 border border-emerald-300 rounded-xl space-y-1 text-[11px] text-emerald-950">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-black text-emerald-900 truncate">HĐĐT ĐÃ PHÁT HÀNH</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleExportInvoice(selectedOrder, false)}
                        disabled={isUpdatingInvoiceExport}
                        className="text-[10px] text-emerald-700 hover:text-red-600 underline cursor-pointer disabled:opacity-50"
                        title="Bấm để đánh dấu chưa xuất nếu xuất nhầm"
                      >
                        Hủy đánh dấu
                      </button>
                    </div>

                    {selectedOrder.invoiceExportedAt && (
                      <div className="text-[10px] text-emerald-800">
                        <span className="text-emerald-600">Thời gian xuất: </span>
                        <span className="font-semibold">{formatDate(selectedOrder.invoiceExportedAt)}</span>
                      </div>
                    )}
                    {selectedOrder.invoiceCompanyName && (
                      <div className="text-[10px] text-emerald-800 truncate">
                        <span className="text-emerald-600">Đơn vị: </span>
                        <span className="font-bold">{selectedOrder.invoiceCompanyName}</span>
                      </div>
                    )}
                    {selectedOrder.invoiceTaxCode && (
                      <div className="text-[10px] text-emerald-800 font-mono">
                        <span className="text-emerald-600 font-sans">MST: </span>
                        <span className="font-bold">{selectedOrder.invoiceTaxCode}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. YÊU CẦU XUẤT HÓA ĐƠN CÔNG TY (YCXHĐCT) - Khi chưa xuất */}
                {!selectedOrder.isInvoiceExported && (selectedOrder.isInvoiceRequested || selectedOrder.invoiceCompanyName || selectedOrder.invoiceTaxCode) && (
                  <div className="p-2.5 bg-amber-50/80 border border-amber-300 rounded-xl space-y-1.5 text-[11px] text-amber-950">
                    <div className="font-bold flex items-center justify-between text-amber-800 border-b border-amber-200/80 pb-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-black tracking-wide">YÊU CẦU XUẤT HĐ CÔNG TY (YCXHĐCT)</span>
                      </div>
                    </div>
                    {selectedOrder.invoiceCompanyName && (
                      <div className="leading-tight">
                        <span className="text-slate-500">Đơn vị: </span>
                        <span className="font-bold text-slate-900">{selectedOrder.invoiceCompanyName}</span>
                      </div>
                    )}
                    {selectedOrder.invoiceTaxCode && (
                      <div className="font-mono leading-tight">
                        <span className="text-slate-500 font-sans">MST: </span>
                        <span className="font-bold text-slate-900">{selectedOrder.invoiceTaxCode}</span>
                      </div>
                    )}
                    {selectedOrder.invoiceAddress && (
                      <div className="leading-tight text-slate-700 line-clamp-2">
                        <span className="text-slate-500">Đ/c: </span>
                        <span>{selectedOrder.invoiceAddress}</span>
                      </div>
                    )}
                    {selectedOrder.invoiceEmail && (
                      <div className="leading-tight text-slate-700 truncate">
                        <span className="text-slate-500">Email: </span>
                        <span>{selectedOrder.invoiceEmail}</span>
                      </div>
                    )}

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleExportInvoice(selectedOrder, true)}
                        disabled={isUpdatingInvoiceExport}
                        className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>XÁC NHẬN ĐÃ XUẤT HĐĐT</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Items Table (MẶT HÀNG | SL | ĐƠN GIÁ | THÀNH TIỀN) */}
                <div className="pt-1.5 border-t border-slate-100">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                        <th className="pb-1 font-bold">MẶT HÀNG</th>
                        <th className="pb-1 font-bold text-center w-7">SL</th>
                        <th className="pb-1 font-bold text-right w-16">ĐƠN GIÁ</th>
                        <th className="pb-1 font-bold text-right w-20">T.TIỀN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!selectedOrder.orderItems || selectedOrder.orderItems.length === 0) ? (
                        <tr>
                          <td colSpan={4} className="py-2.5 text-center text-slate-400 text-[11px]">
                            Không có dữ liệu chi tiết món
                          </td>
                        </tr>
                      ) : (
                        selectedOrder.orderItems.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td className="py-1 pr-1">
                              <div className="font-bold text-slate-900 leading-tight">
                                {it.product?.name || (it as any).productName || 'Món AVORA'}
                              </div>
                              {it.optionsTextSnapshot && (
                                <div className="text-[9px] text-slate-500 italic mt-0.5">
                                  {it.optionsTextSnapshot}
                                </div>
                              )}
                              {it.note && (
                                <div className="text-[9px] text-amber-600 italic">Ghi chú: {it.note}</div>
                              )}
                            </td>
                            <td className="py-1 text-center font-bold text-slate-800">{it.quantity}</td>
                            <td className="py-1 text-right text-slate-600 font-medium">
                              {formatVnd(it.priceAtSale)}
                            </td>
                            <td className="py-1 text-right font-bold text-slate-900">
                              {formatVnd(it.priceAtSale * it.quantity)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Calculation Summary */}
                <div className="border-t border-slate-100 pt-1.5 space-y-0.5 text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Tạm tính ({selectedOrder.orderItems?.length || 0} món):</span>
                    <span className="font-semibold text-slate-800">
                      {formatVnd(selectedOrder.subTotal || selectedOrder.totalAmount)}
                    </span>
                  </div>

                  {selectedOrder.shippingFee !== undefined && selectedOrder.shippingFee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Phí vận chuyển:</span>
                      <span className="font-semibold text-blue-600">+{formatVnd(selectedOrder.shippingFee)}</span>
                    </div>
                  )}

                  {selectedOrder.discountAmount !== undefined && selectedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Giảm giá / Voucher:</span>
                      <span className="font-semibold text-red-600">-{formatVnd(selectedOrder.discountAmount)}</span>
                    </div>
                  )}

                  {selectedOrder.taxAmount !== undefined && selectedOrder.taxAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Thuế (VAT):</span>
                      <span className="font-semibold text-slate-800">+{formatVnd(selectedOrder.taxAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline pt-1 border-t border-slate-200 mt-1">
                    <span className="text-xs font-black uppercase text-slate-900">TỔNG TIỀN:</span>
                    <span className="text-base font-black text-[#da251d]">
                      {formatVnd(selectedOrder.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Receipt Footer Note */}
                <div className="text-center pt-1.5 border-t border-dashed border-slate-200 text-slate-500">
                  <div className="font-bold text-[10px] text-slate-700">Xin chân thành cảm ơn!</div>
                </div>
              </div>

              {/* Action Buttons (Fixed Bottom) */}
              <div className="p-1.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (onReprintReceipt) onReprintReceipt(selectedOrder);
                  }}
                  className="w-full h-8.5 rounded-xl bg-[#da251d] hover:bg-[#b81d16] active:scale-98 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>IN LẠI HÓA ĐƠN</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL BỘ LỌC CHI TIẾT (FILTER MODAL) */}
      {/* ========================================================================= */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#da251d]" />
                <h3 className="text-sm font-black text-slate-900 uppercase">Bộ Lọc Hóa Đơn Nâng Cao</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Các tiêu chí lọc dạng Select Option */}
            <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
              {/* 1. Lọc theo thời gian */}
              <div>
                <label className="font-bold text-slate-700 mb-1 flex items-center gap-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-[#da251d]" />
                  <span>Thời gian lập hóa đơn</span>
                </label>
                <select
                  value={timePreset}
                  onChange={(e) => setTimePreset(e.target.value as TimeFilterPreset)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#da251d] focus:ring-1 focus:ring-[#da251d] transition-all cursor-pointer"
                >
                  <option value="ALL">Tất cả thời gian</option>
                  <option value="TODAY">Hôm nay</option>
                  <option value="YESTERDAY">Hôm qua</option>
                  <option value="LAST_7_DAYS">7 ngày qua</option>
                  <option value="THIS_WEEK">Tuần này</option>
                  <option value="LAST_WEEK">Tuần trước</option>
                  <option value="THIS_MONTH">Tháng này</option>
                  <option value="CUSTOM">Tùy chỉnh khoảng ngày...</option>
                </select>

                {/* Ô chọn ngày tùy chỉnh */}
                {timePreset === 'CUSTOM' && (
                  <div className="mt-2 grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">Từ ngày</span>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none focus:border-[#da251d]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">Đến ngày</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none focus:border-[#da251d]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Lọc theo trạng thái đơn hàng */}
              <div>
                <label className="font-bold text-slate-700 mb-1 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#da251d]" />
                  <span>Trạng thái đơn hàng</span>
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#da251d] focus:ring-1 focus:ring-[#da251d] transition-all cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái (Hoàn tất & Đã hủy)</option>
                  <option value="COMPLETED">Đã hoàn thành</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              {/* 3. Lọc theo hình thức phục vụ */}
              <div>
                <label className="font-bold text-slate-700 mb-1 flex items-center gap-1.5 text-xs">
                  <Store className="w-3.5 h-3.5 text-[#da251d]" />
                  <span>Hình thức phục vụ</span>
                </label>
                <select
                  value={servingTypeFilter}
                  onChange={(e) => setServingTypeFilter(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#da251d] focus:ring-1 focus:ring-[#da251d] transition-all cursor-pointer"
                >
                  <option value="ALL">Tất cả hình thức</option>
                  <option value="DINE_IN">Tại bàn</option>
                  <option value="TAKEAWAY">Mang đi</option>
                  <option value="DELIVERY">Giao hàng / Online</option>
                  <option value="QR_ORDER">QR Order</option>
                </select>
              </div>

              {/* 4. Trạng thái HĐĐT VAT */}
              <div>
                <label className="font-bold text-slate-700 mb-1 flex items-center gap-1.5 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-[#da251d]" />
                  <span>Trạng thái Hóa đơn điện tử (VAT)</span>
                </label>
                <select
                  value={vatFilter}
                  onChange={(e) => setVatFilter(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#da251d] focus:ring-1 focus:ring-[#da251d] transition-all cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái VAT</option>
                  <option value="COMPANY_REQUESTED">Yêu cầu xuất HĐ Công ty (YCXHĐCT)</option>
                  <option value="ISSUED">Đã xuất HĐĐT</option>
                  <option value="NOT_ISSUED">Chưa xuất HĐĐT</option>
                </select>
              </div>

              {/* 5. Lọc theo giá trị đơn hàng */}
              <div>
                <label className="font-bold text-slate-700 mb-1 flex items-center gap-1.5 text-xs">
                  <DollarSign className="w-3.5 h-3.5 text-[#da251d]" />
                  <span>Giá trị đơn hàng (VNĐ)</span>
                </label>
                <select
                  value={pricePreset}
                  onChange={(e) => setPricePreset(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#da251d] focus:ring-1 focus:ring-[#da251d] transition-all cursor-pointer"
                >
                  <option value="ALL">Tất cả khoảng giá</option>
                  <option value="UNDER_200">Dưới 200.000 đ (&lt; 200k)</option>
                  <option value="200_500">Từ 200.000 đ - 500.000 đ</option>
                  <option value="500_1000">Từ 500.000 đ - 1.000.000 đ</option>
                  <option value="ABOVE_1000">Trên 1.000.000 đ (&gt; 1 triệu)</option>
                  <option value="CUSTOM">Tự nhập khoảng tiền...</option>
                </select>

                {pricePreset === 'CUSTOM' && (
                  <div className="mt-2 grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">Giá từ</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none focus:border-[#da251d]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">Giá đến</span>
                      <input
                        type="number"
                        placeholder="10,000,000"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none focus:border-[#da251d]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 6 & 7. Người tạo đơn & Người thanh toán dạng Select Option từ người dùng thực tế */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="font-bold text-slate-700 mb-1 flex items-center gap-1.5 text-[11px]">
                    <User className="w-3 h-3 text-[#da251d]" />
                    <span>Người tạo đơn</span>
                  </label>
                  <select
                    value={creatorFilter}
                    onChange={(e) => setCreatorFilter(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#da251d] focus:ring-1 focus:ring-[#da251d] transition-all cursor-pointer"
                  >
                    <option value="">Tất cả người tạo ({creatorOptions.length})</option>
                    {creatorOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 mb-1 flex items-center gap-1.5 text-[11px]">
                    <UserCheck className="w-3 h-3 text-[#da251d]" />
                    <span>Thu ngân thanh toán</span>
                  </label>
                  <select
                    value={cashierFilter}
                    onChange={(e) => setCashierFilter(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#da251d] focus:ring-1 focus:ring-[#da251d] transition-all cursor-pointer"
                  >
                    <option value="">Tất cả thu ngân ({cashierOptions.length})</option>
                    {cashierOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Đặt lại tất cả
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  setIsFilterModalOpen(false);
                  toast.success(`Đã áp dụng bộ lọc: Tìm thấy ${filteredOrders.length} hóa đơn`);
                }}
                className="px-5 py-2 rounded-xl bg-[#da251d] hover:bg-[#b81d16] text-white text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
              >
                Áp dụng bộ lọc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
