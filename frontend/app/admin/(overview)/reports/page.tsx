'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Wallet,
  CreditCard,
  Percent,
  DollarSign,
  Package,
  Tags,
  Gift,
  Flame,
  ChefHat,
  Ticket,
  Zap,
  Users,
  Crown,
  Clock,
  CalendarCheck,
  History,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  TrendingUp,
  ShoppingBag,
  Target,
  Layers,
  PieChart as PieChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  AdminCard,
  StatCard,
  PageHeader,
  DateRangeFilter,
  SearchInput,
} from '@/app/admin/components/ui';

export default function AdminReportsPage() {
  const { selectedBranchId, can } = useAdmin();
  const { t, locale } = useLanguage();

  // State điều khiển các Accordion nhóm báo cáo
  // Khởi tạo mở sẵn nhóm DOANH THU & TÀI CHÍNH và MẶT HÀNG giống ảnh 5
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    revenue: true,
    products: false,
    promotions: false,
    customers: false,
    operations: false,
  });

  // State toggle xem biểu đồ phân tích trực quan
  const [showOverviewCharts, setShowOverviewCharts] = useState(false);

  // Dữ liệu API biểu đồ
  const [summary, setSummary] = useState<any>(null);
  const [revenueComparison, setRevenueComparison] = useState<any[]>([]);
  const [dishStats, setDishStats] = useState<any>(null);
  const [paymentStats, setPaymentStats] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dishSearch, setDishSearch] = useState('');

  // Khởi tạo khoảng ngày mặc định: 6 tháng gần nhất
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }, []);

  const defaultTo = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [revenueFromDate, setRevenueFromDate] = useState(defaultFrom);
  const [revenueToDate, setRevenueToDate] = useState(defaultTo);

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, revenueFromDate, revenueToDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchQuery =
        selectedBranchId && selectedBranchId !== 'ALL' ? `branchId=${selectedBranchId}` : '';
      const dateQuery = `?${branchQuery}${branchQuery ? '&' : ''}from=${revenueFromDate}&to=${revenueToDate}`;

      const [sumRes, revRes, dishRes, payRes, peakRes, catRes] = await Promise.all([
        fetch(`/api/admin/reports/summary${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/revenue-comparison${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/dish-stats${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/payment-stats${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/peak-hours${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/category-stats${dateQuery}`, { credentials: 'include' }),
      ]);

      if (sumRes.ok) setSummary((await sumRes.json()).data);
      if (revRes.ok) setRevenueComparison((await revRes.json()).data || []);
      if (dishRes.ok) setDishStats((await dishRes.json()).data || null);
      if (payRes.ok) setPaymentStats((await payRes.json()).data || []);
      if (peakRes.ok) setPeakHours((await peakRes.json()).data || []);
      if (catRes.ok) setCategoryStats((await catRes.json()).data || []);
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const PAYMENT_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

  // Định nghĩa các nhóm báo cáo tổng hợp toàn diện chuẩn giao diện AVORA
  const reportSections = useMemo(() => {
    return [
      {
        id: 'revenue',
        title: 'BÁO CÁO DOANH THU & TÀI CHÍNH',
        icon: Wallet,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        items: [
          {
            id: 'revenue_overview',
            title: 'Báo cáo doanh thu tổng quan',
            subtitle: 'Biến động doanh thu, chu kỳ tăng trưởng và chỉ số kinh doanh',
            icon: PieChartIcon,
            isInteractiveAction: true,
            onClick: () => setShowOverviewCharts((prev) => !prev),
            permission: 'reports.view',
          },
          {
            id: 'payment_methods',
            title: 'Theo phương thức thanh toán',
            subtitle: 'Tỷ trọng dòng tiền qua Tiền mặt, Chuyển khoản QR, VNPay, Thẻ',
            icon: CreditCard,
            href: '/admin/reports/payment-methods',
            permission: 'reports.revenue.view',
          },
          {
            id: 'financial_report',
            title: 'Báo cáo tài chính P&L',
            subtitle: 'Đối soát doanh thu thuần, chi phí món, hoàn hủy & lợi nhuận gộp',
            icon: DollarSign,
            href: '/admin/reports/financial',
            permission: 'reports.revenue.view',
          },
          {
            id: 'tax_report',
            title: 'Báo cáo thuế / VAT',
            subtitle: 'Phân rã thuế suất GTGT 0%, 5%, 8%, 10% theo quy định hóa đơn',
            icon: Percent,
            href: '/admin/reports/tax',
            permission: 'reports.revenue.view',
          },
        ],
      },
      {
        id: 'products',
        title: 'BÁO CÁO MẶT HÀNG & THỰC ĐƠN',
        icon: Package,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        items: [
          {
            id: 'dish_performance',
            title: 'Báo cáo hiệu suất mặt hàng',
            subtitle: 'Sản lượng bán chi tiết, món bán chạy nhất & giảm giá món ăn',
            icon: Flame,
            href: '/admin/reports/products',
            permission: 'reports.products.view',
          },
          {
            id: 'category_performance',
            title: 'Hiệu suất theo danh mục món',
            subtitle: 'Tỷ trọng đóng góp doanh thu của các nhóm món ăn và đồ uống',
            icon: Tags,
            href: '/admin/categories',
            permission: 'categories.view',
          },
          {
            id: 'combo_performance',
            title: 'Hiệu suất Combo món ẩm thực',
            subtitle: 'Sản lượng tiêu thụ các set combo và thực đơn ưu đãi đặc biệt',
            icon: Gift,
            href: '/admin/combos',
            permission: 'combos.view',
          },
        ],
      },
      {
        id: 'promotions',
        title: 'BÁO CÁO VOUCHER & KHUYẾN MÃI',
        icon: Ticket,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        items: [
          {
            id: 'voucher_analytics',
            title: 'Phân tích Voucher & Mã giảm giá',
            subtitle: 'Số lượt áp dụng, chi phí discount, tỷ lệ ROI doanh thu & phát hiện gian lận',
            icon: Ticket,
            href: '/admin/reports/vouchers',
            permission: 'reports.revenue.view',
          },
          {
            id: 'flash_sale_reports',
            title: 'Báo cáo chiến dịch Flash Sale',
            subtitle: 'Doanh số khung giờ vàng, tỷ lệ bán hết (Sell-through) và đối soát tồn kho',
            icon: Zap,
            href: '/admin/reports/flash-sales',
            permission: 'reports.revenue.view',
          },
        ],
      },
      {
        id: 'customers',
        title: 'BÁO CÁO KHÁCH HÀNG & THÀNH VIÊN',
        icon: Users,
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
        items: [
          {
            id: 'customer_analytics',
            title: 'Báo cáo phân khúc khách hàng (RFM & Retention)',
            subtitle: 'Khách mới (First Order), khách quay lại, tỷ lệ lặp lại & ma trận Cohort',
            icon: Users,
            href: '/admin/reports/customers',
            permission: 'reports.revenue.view',
          },
          {
            id: 'membership_loyalty',
            title: 'Membership & Điểm thưởng Avora Rewards',
            subtitle: 'Hiệu suất hạng thẻ, biến động điểm, nghĩa vụ nợ (Liability) & đối soát sổ cái',
            icon: Crown,
            href: '/admin/reports/membership-points',
            permission: 'reports.revenue.view',
          },
        ],
      },
      {
        id: 'operations',
        title: 'BÁO CÁO VẬN HÀNH & BÀN TIỆC',
        icon: Clock,
        iconBg: 'bg-rose-50',
        iconColor: 'text-[#800020]',
        items: [
          {
            id: 'reservation_analytics',
            title: 'Phân tích đặt bàn & Khung giờ vàng',
            subtitle: 'Khung giờ đón khách cao điểm, tỷ lệ lấp đầy bàn tiệc',
            icon: CalendarCheck,
            href: '/admin/reservations/analytics',
            permission: 'reservations.view',
          },
          {
            id: 'audit_logs',
            title: 'Nhật ký hoạt động & Kiểm toán (Audit Logs)',
            subtitle: 'Lịch sử thao tác đơn hàng, hủy món, phân quyền và bảo mật hệ thống',
            icon: History,
            href: '/admin/audit-logs',
            permission: 'audit_logs.view',
          },
        ],
      },
    ];
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 select-none">
      {/* Tiêu đề trang và bộ lọc */}
      <PageHeader
        title={t('reports.title', 'Trung tâm Báo cáo')}
        subtitle={t(
          'reports.subtitle',
          'Hệ thống báo cáo toàn diện về doanh thu, thanh toán, mặt hàng, marketing và vận hành'
        )}
        breadcrumbs={[
          { label: t('nav.overview', 'Tổng quan') },
          { label: t('nav.reports', 'Báo cáo') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DateRangeFilter
              fromDate={revenueFromDate}
              toDate={revenueToDate}
              onChange={(from, to) => {
                setRevenueFromDate(from);
                setRevenueToDate(to);
              }}
            />
            <button
              type="button"
              onClick={() => setShowOverviewCharts((prev) => !prev)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                showOverviewCharts
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-2xs'
              }`}
            >
              <BarChart3 size={15} />
              <span>{showOverviewCharts ? 'Ẩn biểu đồ' : 'Xem biểu đồ'}</span>
            </button>
          </div>
        }
      />

      {/* KPI Thống kê nhanh */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          title={t('reports.periodRevenue', 'DOANH THU TÍCH LŨY')}
          value={formatMoney(summary?.totalRevenue || 0)}
          changePeriod={t('reports.periodRevenueSub', 'trong kỳ báo cáo')}
          icon={<DollarSign size={20} strokeWidth={2.5} />}
          color="red"
          loading={loading}
        />
        <StatCard
          title={t('reports.completedOrders', 'ĐƠN HOÀN THÀNH')}
          value={summary?.completedOrders || 0}
          changePeriod={t('reports.completedOrdersSub', 'đơn thành công')}
          icon={<ShoppingBag size={20} strokeWidth={2.5} />}
          color="blue"
          loading={loading}
        />
        <StatCard
          title={t('reports.successRate', 'TỶ LỆ THÀNH CÔNG')}
          value={summary?.successRate ? `${summary.successRate.toFixed(1)}%` : '0%'}
          changePeriod={t('reports.successRateSub', 'trên tổng đơn')}
          icon={<Target size={20} strokeWidth={2.5} />}
          color="green"
          loading={loading}
        />
        <StatCard
          title={t('reports.totalCustomers', 'KHÁCH HÀNG')}
          value={summary?.totalUsers || 0}
          changePeriod={t('reports.totalCustomersSub', 'đã đăng ký')}
          icon={<Users size={20} strokeWidth={2.5} />}
          color="purple"
          loading={loading}
        />
      </div>

      {/* KHU VỰC ACCORDION DANH MỤC TẤT CẢ BÁO CÁO (CHUẨN ẢNH 5) */}
      <div className="space-y-3 sm:space-y-4">
        {reportSections.map((group) => {
          const isOpen = !!openGroups[group.id];
          const GroupIcon = group.icon;

          // Lọc các item có quyền truy cập
          const accessibleItems = group.items.filter((item) =>
            can(item.permission, selectedBranchId)
          );

          if (accessibleItems.length === 0) return null;

          return (
            <div
              key={group.id}
              className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden transition-all duration-200"
            >
              {/* Tiêu đề nhóm Accordion (nhấp để thu gọn / mở rộng) */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50/60 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9.5 h-9.5 sm:w-10 sm:h-10 rounded-xl ${group.iconBg} ${group.iconColor} flex items-center justify-center shrink-0 shadow-2xs`}
                  >
                    <GroupIcon size={19} strokeWidth={2.4} />
                  </div>
                  <h3 className="font-extrabold text-[13px] sm:text-sm text-slate-900 tracking-tight uppercase">
                    {group.title}
                  </h3>
                </div>
                <div className="text-slate-400 p-1">
                  {isOpen ? (
                    <ChevronUp size={18} strokeWidth={2.5} />
                  ) : (
                    <ChevronDown size={18} strokeWidth={2.5} />
                  )}
                </div>
              </button>

              {/* Danh sách các báo cáo con trong nhóm */}
              {isOpen && (
                <div className="border-t border-slate-100 divide-y divide-slate-100/80">
                  {accessibleItems.map((item) => {
                    const ItemIcon = item.icon;

                    if (item.isInteractiveAction) {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={item.onClick}
                          className="w-full flex items-center justify-between px-3.5 sm:px-4.5 py-3 hover:bg-slate-50/80 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                              <ItemIcon size={16} strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] sm:text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                                {item.title}
                              </p>
                              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-blue-600 shrink-0 ml-2">
                            <span className="text-[11px] font-semibold hidden sm:inline">
                              {showOverviewCharts ? 'Thu gọn' : 'Xem biểu đồ'}
                            </span>
                            <ChevronRight
                              size={16}
                              className={`transition-transform duration-150 ${
                                showOverviewCharts ? 'rotate-90 text-blue-600' : 'group-hover:translate-x-0.5'
                              }`}
                            />
                          </div>
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.id}
                        href={item.href || '#'}
                        className="flex items-center justify-between px-3.5 sm:px-4.5 py-3 hover:bg-slate-50/80 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            <ItemIcon size={16} strokeWidth={2} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] sm:text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                              {item.title}
                            </p>
                            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
                        />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* KHU VỰC BIỂU ĐỒ TRỰC QUAN (Mở rộng khi nhấp "Báo cáo doanh thu tổng quan" hoặc nút Xem biểu đồ) */}
      {showOverviewCharts && (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between pt-2">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-600" />
              <span>Biểu đồ phân tích doanh thu & vận hành</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowOverviewCharts(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
            >
              Thu gọn biểu đồ
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
            {/* Tăng trưởng doanh thu Line Chart */}
            <AdminCard
              title={t('reports.revenueGrowth', 'Tăng trưởng doanh thu')}
              subtitle={t('reports.revenueGrowthSub', 'Biến động doanh thu theo chu kỳ')}
              icon={<TrendingUp size={16} />}
            >
              <div className="h-56 sm:h-80 w-full mt-2">
                {!revenueComparison || revenueComparison.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                    {t('common.noData', 'Chưa có dữ liệu so sánh doanh thu')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={revenueComparison}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(val: any) => {
                          if (typeof val === 'string') {
                            if (val.includes('-') && val.split('-').length === 2)
                              return `${locale === 'en' ? 'M' : 'Tháng '}${val.split('-')[1]}`;
                            return val.split('-').slice(1).join('/');
                          }
                          return String(val);
                        }}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        dy={8}
                      />
                      <YAxis
                        tickFormatter={(val: any) => `${Number(val) / 1000000}M`}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        dx={-8}
                      />
                      <Tooltip
                        formatter={(value: any) => [formatMoney(Number(value) || 0), 'Doanh thu']}
                        labelFormatter={(label: any) => {
                          if (
                            typeof label === 'string' &&
                            label.includes('-') &&
                            label.split('-').length === 2
                          )
                            return `${locale === 'en' ? 'Month ' : 'Tháng '}${label}`;
                          return `Ngày: ${label}`;
                        }}
                        contentStyle={{ borderRadius: '14px', fontSize: '12px', fontWeight: 600 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#ef4444"
                        strokeWidth={3.5}
                        dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#ffffff' }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </AdminCard>

            {/* Tỷ trọng phương thức thanh toán */}
            <AdminCard
              title={t('reports.paymentMethods', 'Phương thức thanh toán')}
              subtitle={t('reports.paymentMethodsSub', 'Tỷ trọng doanh thu theo kênh thanh toán')}
              icon={<CreditCard size={16} />}
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 h-auto sm:h-80">
                <div className="w-full sm:w-1/2 h-44 sm:h-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="revenue"
                      >
                        {paymentStats.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [formatMoney(Number(value) || 0), 'Doanh thu']}
                        contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-1.5 sm:space-y-2 text-xs overflow-y-auto max-h-56">
                  {paymentStats.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-1.5 sm:p-2 rounded-xl bg-slate-50 border border-slate-100/80"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PAYMENT_COLORS[idx % PAYMENT_COLORS.length] }}
                        />
                        <span className="font-semibold text-slate-700 truncate text-[11px] sm:text-xs">
                          {entry.method}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900 text-[11px] sm:text-xs">
                          {formatMoney(entry.revenue)}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-slate-400">{entry.count} đơn</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AdminCard>
          </div>

          {/* Hiệu suất món ăn */}
          <AdminCard
            title={t('reports.dishPerformance', 'Hiệu suất món ăn')}
            subtitle={t('reports.dishPerformanceSub', 'Thống kê chi tiết số lượng và doanh thu từng món')}
            icon={<Flame size={16} />}
            action={
              <div className="w-full sm:w-60">
                <SearchInput
                  value={dishSearch}
                  onChange={setDishSearch}
                  placeholder={t('common.search', 'Tìm món ăn...')}
                  size="sm"
                />
              </div>
            }
          >
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {dishStats?.allSelling
                ?.filter((d: any) => d.name.toLowerCase().includes(dishSearch.toLowerCase()))
                .map((dish: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 sm:p-2.5 bg-slate-50/70 rounded-xl sm:rounded-2xl border border-slate-100 hover:bg-red-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg sm:rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] sm:text-xs shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0">
                        {dish.imageUrl ? (
                          <img
                            src={dish.imageUrl}
                            alt={dish.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ChefHat size={16} className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {dish.name}
                        </p>
                        <span className="text-[10px] sm:text-[11px] text-slate-400">
                          {t('dashboard.soldCount', 'Đã bán')}:{' '}
                          <strong className="text-red-600 font-bold">{dish.totalQuantity}</strong>
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-xs sm:text-sm text-slate-900 shrink-0">
                      {formatMoney(dish.revenue)}
                    </span>
                  </div>
                ))}
            </div>
          </AdminCard>

          {/* Khung giờ vàng & Doanh thu theo danh mục */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
            <AdminCard
              title={t('reports.goldenHours', 'Khung giờ vàng (Peak Hours)')}
              subtitle={t(
                'reports.goldenHoursSub',
                'Phân bố lượt đặt món theo các khung giờ trong ngày'
              )}
              icon={<Clock size={16} />}
            >
              <div className="h-56 sm:h-72 w-full mt-2">
                {peakHours.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                    {t('common.noData', 'Chưa có dữ liệu khung giờ')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={peakHours}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="hour"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        dx={-8}
                      />
                      <Tooltip
                        formatter={(value: any) => [`${value} đơn`, 'Số lượng đơn']}
                        labelFormatter={(label: any) => `Khung giờ: ${label}`}
                        contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorPeak)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </AdminCard>

            <AdminCard
              title={t('reports.categoryRevenue', 'Doanh thu theo danh mục')}
              subtitle={t(
                'reports.categoryRevenueSub',
                'Tỷ trọng đóng góp doanh số từng nhóm thực đơn'
              )}
              icon={<Layers size={16} />}
            >
              <div className="h-56 sm:h-72 w-full mt-2">
                {categoryStats.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                    {t('common.noData', 'Chưa có dữ liệu danh mục')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryStats}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        dy={8}
                      />
                      <YAxis
                        tickFormatter={(val: any) => `${Number(val) / 1000000}M`}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        dx={-8}
                      />
                      <Tooltip
                        formatter={(value: any) => [formatMoney(Number(value) || 0), 'Doanh thu']}
                        contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                      />
                      <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </AdminCard>
          </div>
        </div>
      )}
    </div>
  );
}
