'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Zap,
  ChevronRight,
  ChevronLeft,
  Edit,
  BarChart3,
  Flame,
  Clock,
  Calendar,
  Store,
  ShoppingBag,
  Users,
  Percent,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Copy,
  TrendingUp,
  Tag,
  FileText,
  History,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  FlashSaleCampaign,
  FlashSaleRuntimeStatus,
  FlashSaleAuditLog,
} from '@/types/flash-sale';

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [campaign, setCampaign] = useState<FlashSaleCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'slots' | 'products' | 'orders' | 'customers' | 'report' | 'logs'
  >('overview');
  const [actionLoading, setActionLoading] = useState(false);

  // Orders drill-down and audit logs
  const [orders, setOrders] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<FlashSaleAuditLog[]>([]);

  const fetchCampaignDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/flash-sales/${id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setCampaign(json.data);
          setAuditLogs(json.data.auditLogs || []);
        }
      }

      // Also fetch report data to get orders and customers drill-down
      const repRes = await fetch(`/api/admin/flash-sales/${id}/report`, {
        credentials: 'include',
      });
      if (repRes.ok) {
        const repJson = await repRes.json();
        if (repJson.success && repJson.data) {
          setOrders(repJson.data.orders || []);
          setTopCustomers(repJson.data.topCustomers || []);
        }
      }
    } catch (err) {
      console.error('Error fetching campaign detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaignDetail();
  }, [fetchCampaignDetail]);

  const handleAction = async (action: 'publish' | 'pause' | 'resume' | 'cancel') => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/flash-sales/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const resJson = await res.json();
      if (res.ok && resJson.success) {
        fetchCampaignDetail();
      } else {
        alert(resJson?.error?.message || 'Có lỗi xảy ra.');
      }
    } catch (e) {
      console.error('Action error:', e);
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val?: number) => {
    return (val || 0).toLocaleString('vi-VN') + ' đ';
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    );
  };

  if (loading || !campaign) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Zap className="w-10 h-10 text-[#da251d] animate-bounce mx-auto mb-3" />
          <p className="font-bold text-slate-700">Đang tải thông tin chiến dịch Flash Sale...</p>
        </div>
      </div>
    );
  }

  const soldPercent =
    campaign.totalStock && campaign.totalStock > 0
      ? Math.min(100, Math.round(((campaign.totalSold || 0) / campaign.totalStock) * 100))
      : 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-20">
      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/flash-sales"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Link href="/admin/flash-sales" className="hover:underline">
                    Flash Sale
                  </Link>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="font-mono text-slate-700 font-bold">{campaign.code}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 mt-0.5">
                  <Zap className="w-6 h-6 text-[#da251d] fill-[#da251d]" />
                  <span>{campaign.name}</span>
                </h1>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={fetchCampaignDetail}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                title="Làm mới"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <Link
                href={`/admin/flash-sales/${id}/edit`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                <Edit className="w-4 h-4" />
                <span>Chỉnh sửa</span>
              </Link>

              <Link
                href={`/admin/flash-sales/${id}/report`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-xs"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Báo cáo hiệu quả</span>
              </Link>

              {campaign.runtimeStatus === 'DRAFT' && (
                <button
                  onClick={() => handleAction('publish')}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Xuất bản</span>
                </button>
              )}

              {campaign.runtimeStatus === 'ACTIVE' && (
                <button
                  onClick={() => handleAction('pause')}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-white" />
                  <span>Tạm dừng</span>
                </button>
              )}

              {campaign.runtimeStatus === 'PAUSED' && (
                <button
                  onClick={() => handleAction('resume')}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Tiếp tục</span>
                </button>
              )}
            </div>
          </div>

          {/* ── 7 TABS NAVIGATION ── */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'overview', label: 'Tổng quan', icon: Zap },
              { id: 'slots', label: `Khung giờ (${campaign.slots?.length || 0})`, icon: Clock },
              { id: 'products', label: `Sản phẩm (${campaign.items?.length || 0})`, icon: ShoppingBag },
              { id: 'orders', label: `Đơn hàng (${orders.length})`, icon: FileText },
              { id: 'customers', label: `Khách hàng (${topCustomers.length})`, icon: Users },
              { id: 'report', label: 'Báo cáo nhanh', icon: BarChart3 },
              { id: 'logs', label: `Nhật ký (${auditLogs.length})`, icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-red-50 text-[#da251d] border border-red-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* ── TAB 1: TỔNG QUAN ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <div className="text-xs text-slate-500 font-semibold">Doanh thu Flash Sale</div>
                <div className="text-xl font-black text-slate-900 mt-1">
                  {formatCurrency(campaign.totalRevenue)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Từ {campaign.totalOrders || 0} đơn hàng
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <div className="text-xs text-slate-500 font-semibold">Món đã bán</div>
                <div className="text-xl font-black text-[#da251d] mt-1">
                  {campaign.totalSold || 0} / {campaign.totalStock || 0}
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-[#da251d] h-full rounded-full"
                    style={{ width: `${soldPercent}%` }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <div className="text-xs text-slate-500 font-semibold">Tỷ lệ bán hết</div>
                <div className="text-xl font-black text-emerald-600 mt-1">
                  {soldPercent}%
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Sell-through rate
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <div className="text-xs text-slate-500 font-semibold">Trạng thái runtime</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {campaign.runtimeStatus}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {formatDateTime(campaign.startTime)}
                </div>
              </div>
            </div>

            {/* Campaign Meta & Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Cấu hình chiến dịch
                </h3>
                <div className="divide-y divide-slate-100 text-xs space-y-2.5">
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Mã chương trình:</span>
                    <span className="font-mono font-bold text-slate-800">{campaign.code}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Thời gian bắt đầu:</span>
                    <span className="font-bold text-slate-800">{formatDateTime(campaign.startTime)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Thời gian kết thúc:</span>
                    <span className="font-bold text-slate-800">{formatDateTime(campaign.endTime)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Chi nhánh áp dụng:</span>
                    <span className="font-bold text-slate-800">
                      {!campaign.branches || campaign.branches.length === 0
                        ? 'Toàn bộ chi nhánh'
                        : campaign.branches.map((b) => b.name).join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Kênh áp dụng:</span>
                    <span className="font-bold text-slate-800">
                      {campaign.applyOnline ? 'Online ' : ''}
                      {campaign.applyPos ? 'POS Tại Bàn' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Quy tắc mua & Trợ giá
                </h3>
                <div className="divide-y divide-slate-100 text-xs space-y-2.5">
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Tối đa mỗi khách:</span>
                    <span className="font-bold text-slate-800">
                      {campaign.maxQuantityPerUser || 'Không giới hạn'} suất
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Tối đa mỗi đơn:</span>
                    <span className="font-bold text-slate-800">
                      {campaign.maxQuantityPerOrder || 'Không giới hạn'} suất
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Dùng chung Voucher:</span>
                    <span className={`font-bold ${campaign.allowVouchers ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {campaign.allowVouchers ? 'Cho phép' : 'Không'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Dùng chung Freeship:</span>
                    <span className={`font-bold ${campaign.allowFreeship ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {campaign.allowFreeship ? 'Cho phép' : 'Không'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Chiết khấu VIP:</span>
                    <span className={`font-bold ${campaign.allowMembershipDiscount ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {campaign.allowMembershipDiscount ? 'Cho phép' : 'Không'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: KHUNG GIỜ (SLOTS) ── */}
        {activeTab === 'slots' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(campaign.slots || []).map((slot, idx) => (
                <div
                  key={slot.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-[#da251d] font-black text-xs">
                      Khung {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {slot.runtimeStatus || 'SCHEDULED'}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900">{slot.name}</h4>

                  <div className="text-xs text-slate-500 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDateTime(slot.startTime)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5" />
                      <span>đến {formatDateTime(slot.endTime)}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Số món trong slot:</span>
                    <span className="text-slate-900">{slot.items?.length || 0} món</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: SẢN PHẨM (PRODUCTS) ── */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Món ăn</th>
                    <th className="py-3 px-3">Khung giờ</th>
                    <th className="py-3 px-3 text-right">Giá thường</th>
                    <th className="py-3 px-3 text-right">Giá Flash Sale</th>
                    <th className="py-3 px-3 text-center">% Giảm</th>
                    <th className="py-3 px-3 text-right">Tồn kho / Đã bán</th>
                    <th className="py-3 px-3 text-right">Giới hạn/người</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(campaign.items || []).map((it) => {
                    const discountAmt = (it.product?.price || 0) - it.flashSalePrice;
                    const pct =
                      it.product?.price && it.product.price > 0
                        ? Math.round((discountAmt / it.product.price) * 100)
                        : 0;

                    return (
                      <tr key={it.id} className="hover:bg-slate-50/60">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{it.product?.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {it.product?.category?.name || 'Món ăn'}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 font-medium text-slate-600">
                          {it.slot?.name || 'Mặc định'}
                        </td>

                        <td className="py-3.5 px-3 text-right text-slate-500">
                          {formatCurrency(it.product?.price)}
                        </td>

                        <td className="py-3.5 px-3 text-right font-black text-[#da251d]">
                          {formatCurrency(it.flashSalePrice)}
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#da251d] font-bold text-[11px]">
                            -{pct}%
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                          {it.sold} / {it.stock}
                        </td>

                        <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                          {it.maxQuantityPerUser || 2} suất
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: ĐƠN HÀNG DRILL-DOWN ── */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Mã đơn</th>
                    <th className="py-3 px-3">Khách hàng</th>
                    <th className="py-3 px-3">Chi nhánh</th>
                    <th className="py-3 px-3 text-right">Tổng tiền</th>
                    <th className="py-3 px-3 text-right">Trợ giá Flash Sale</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Chưa có đơn hàng nào mua qua Flash Sale này
                      </td>
                    </tr>
                  ) : (
                    orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-[#da251d]">
                          {ord.orderCode}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {ord.customer?.fullName || 'Khách vãng lai'}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {ord.branch?.name || '--'}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(ord.totalAmount)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-600">
                          {formatCurrency(ord.flashSaleDiscount)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {formatDateTime(ord.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 5: KHÁCH HÀNG ── */}
        {activeTab === 'customers' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Top khách hàng tham gia Flash Sale
            </h3>

            <div className="divide-y divide-slate-100">
              {topCustomers.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Chưa có dữ liệu khách hàng
                </div>
              ) : (
                topCustomers.map((c, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">{c.fullName}</div>
                        <div className="text-[11px] text-slate-400">{c.email || c.phone}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-[#da251d]">
                        {formatCurrency(c.totalSpent)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {c.itemsCount} món • {c.ordersCount} đơn
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB 6: BÁO CÁO NHANH ── */}
        {activeTab === 'report' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs text-center space-y-4">
            <BarChart3 className="w-12 h-12 text-[#da251d] mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">
              Trung tâm Báo cáo Phân tích Chuyên sâu
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Xem Conversion Funnel, biểu đồ doanh thu theo giờ, hiệu quả từng khung giờ và xếp hạng sản phẩm bán chạy
            </p>
            <Link
              href={`/admin/flash-sales/${id}/report`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#da251d] hover:bg-red-700 text-white text-xs font-bold shadow-sm shadow-red-600/25 transition"
            >
              <span>Mở Báo Cáo Chiến Dịch Chi Tiết</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* ── TAB 7: NHẬT KÝ (AUDIT LOGS) ── */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Nhật ký thay đổi & Hoạt động (Audit Trail)
            </h3>

            <div className="divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Chưa có nhật ký hoạt động nào
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between text-xs">
                    <div className="flex items-start gap-3">
                      <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600 mt-0.5">
                        <History className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">
                          {log.action}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Thực hiện bởi: <strong className="text-slate-700">{log.user?.fullName || 'Hệ thống'}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
