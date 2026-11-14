'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import {
  Activity,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  RefreshCw,
  BookX,
  ArrowRightLeft,
  ClipboardCheck,
  FileWarning,
  ShieldCheck,
  Settings,
  PackageX,
} from 'lucide-react';
import { PageHeader, AdminCard } from '@/app/admin/components/ui';

export default function InventoryOperationalMonitorPage() {
  const { selectedBranchId } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'onboarding' | 'exceptions' | 'readiness' | 'missing_recipes' | 'pending_docs'>(
    'onboarding',
  );

  const fetchMonitor = useCallback(async () => {
    setLoading(true);
    try {
      const bParam = selectedBranchId && selectedBranchId !== 'ALL' ? `?branchId=${selectedBranchId}` : '';
      const res = await fetch(`/api/admin/inventory/monitor${bParam}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error('Error fetching inventory monitor:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchMonitor();
  }, [fetchMonitor]);

  const handleResolveException = async (id: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    const notes =
      status === 'RESOLVED' ? prompt('Ghi chú xử lý ngoại lệ (tùy chọn):') || 'Đã kiểm tra & xử lý' : undefined;
    try {
      const res = await fetch(`/api/admin/inventory/monitor/exceptions/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, resolutionNotes: notes }),
      });
      const json = await res.json();
      if (json.success) {
        fetchMonitor();
      } else {
        alert(json.message || 'Lỗi cập nhật ngoại lệ');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateBranchPolicy = async (
    branchId: string,
    inventoryActivated: boolean,
    inventoryPolicy: 'STRICT_TRACKING' | 'WARN_AND_ALLOW' | 'MANUAL_CONSUMPTION',
  ) => {
    if (
      inventoryActivated &&
      !confirm(
        'Xác nhận kích hoạt trừ kho tự động cho chi nhánh này? Đảm bảo công thức BOM & tồn kho đầu kỳ đã được phê duyệt.',
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/inventory/branch-activation/${branchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inventoryActivated, inventoryPolicy }),
      });
      const json = await res.json();
      if (json.success) {
        fetchMonitor();
      } else {
        alert(json.message || 'Lỗi cập nhật chính sách chi nhánh');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const kpis = data?.kpis || {};

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Trung Tâm Giám Sát Vận Hành & Ngoại Lệ Kho (Inventory Monitor)"
        subtitle="Theo dõi cảnh báo hook POS/KDS, món thiếu công thức BOM, tồn kho âm/thấp, lô hết hạn FEFO, chênh lệch sổ cái và trạng thái kích hoạt từng chi nhánh"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/operations/avo1-onboarding"
              className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
            >
              AVO1 Onboarding Workspace
            </Link>
            <Link
              href="/admin/inventory"
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Tổng Quan Kho
            </Link>
            <button
              onClick={fetchMonitor}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Quét Trạng Thái
            </button>
          </div>
        }
      />

      {/* TOP ALERT KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminCard className="p-5 border-l-4 border-l-rose-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Ngoại Lệ Vận Hành Mở</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">
                {loading ? '...' : kpis.openExceptionsCount || 0}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Nghiêm trọng: {kpis.criticalExceptionsCount || 0} (Âm kho / Hook lỗi)
              </p>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <ShieldAlert size={22} />
            </div>
          </div>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-amber-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Độ Phủ Công Thức BOM</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">
                {loading ? '...' : `${kpis.recipeCoveragePercent || 0}%`}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Thiếu công thức: {kpis.missingRecipeCount || 0} / {kpis.totalTrackedProducts || 0} món
              </p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <BookX size={22} />
            </div>
          </div>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-indigo-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Chênh Lệch Sổ Cái Kho</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-1">
                {loading ? '...' : kpis.ledgerDiscrepancyBranchesCount || 0} Chi Nhánh
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Tồn thấp: {kpis.lowStockCount || 0} • Lô hết hạn: {kpis.expiredBatchesCount || 0}
              </p>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileWarning size={22} />
            </div>
          </div>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Chứng Từ Chờ Duyệt / Xử Lý</p>
              <h3 className="text-2xl font-black text-blue-700 mt-1">
                {loading
                  ? '...'
                  : (kpis.pendingTransfersCount || 0) +
                    (kpis.pendingPOsCount || 0) +
                    (kpis.unapprovedStocktakesCount || 0)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Chuyển kho: {kpis.pendingTransfersCount || 0} • Kiểm kê: {kpis.unapprovedStocktakesCount || 0}
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Activity size={22} />
            </div>
          </div>
        </AdminCard>
      </div>

      {/* LEDGER DISCREPANCY BANNER */}
      {data?.ledgerDiscrepancies?.length > 0 && (
        <AdminCard className="p-4 border border-amber-300 bg-amber-50/70">
          <h4 className="text-xs font-black uppercase text-amber-900 flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            Cảnh Báo Đối Chiếu Sổ Cái (InventoryBalance vs InventoryTransaction)
          </h4>
          <div className="space-y-2 text-xs">
            {data.ledgerDiscrepancies.map((d: any) => (
              <div
                key={d.branchId}
                className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-amber-200"
              >
                <div>
                  <span className="font-bold text-slate-900">{d.branchName}</span>: Tổng InventoryBalance ={' '}
                  <strong className="font-mono">{d.balanceTotalQty.toLocaleString()}</strong> | Net Ledger Transactions ={' '}
                  <strong className="font-mono">{d.ledgerNetQty.toLocaleString()}</strong> (Chênh:{' '}
                  <strong className="text-rose-600 font-mono">{d.varianceQty.toLocaleString()}</strong>)
                  <p className="text-[11px] text-slate-600 mt-0.5">{d.rootCause}</p>
                </div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded">
                  {d.recommendedAction}
                </span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* TABS */}
      <div className="flex flex-wrap items-center border-b border-slate-200 gap-1 bg-white px-4 rounded-xl shadow-xs">
        {[
          { key: 'onboarding', label: 'Tiến Độ Onboarding Phase 3.3', count: data?.blockers?.length || 0 },
          { key: 'exceptions', label: 'Ngoại Lệ POS/KDS & Ledger', count: kpis.openExceptionsCount || 0 },
          { key: 'readiness', label: 'Kích Hoạt & Chính Sách Chi Nhánh', count: data?.branchReadiness?.length || 0 },
          { key: 'missing_recipes', label: 'Sản Phẩm Thiếu Công Thức BOM', count: kpis.missingRecipeCount || 0 },
          {
            key: 'pending_docs',
            label: 'Chứng Từ Chờ & Hết Hạn FEFO',
            count:
              (kpis.lowStockCount || 0) +
              (kpis.expiredBatchesCount || 0) +
              (kpis.pendingTransfersCount || 0) +
              (kpis.unapprovedStocktakesCount || 0),
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
              activeTab === tab.key
                ? 'border-[#da251d] text-[#da251d]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.key ? 'bg-red-50 text-[#da251d]' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* TAB 0: PHASE 3.3 ONBOARDING READINESS & BLOCKERS */}
      {activeTab === 'onboarding' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <AdminCard className="p-4">
              <p className="font-bold text-slate-500 uppercase text-[10px]">1. Công Thức Published</p>
              <p className="text-lg font-black text-slate-900 mt-1">
                {data?.onboardingReadiness?.publishedRecipes || 0} / {data?.onboardingReadiness?.totalTrackedProducts || 0} ({data?.onboardingReadiness?.recipeCompletionPercent || 0}%)
              </p>
            </AdminCard>
            <AdminCard className="p-4">
              <p className="font-bold text-slate-500 uppercase text-[10px]">2. 664 Option Modifiers</p>
              <p className="text-lg font-black text-slate-900 mt-1">
                {data?.onboardingReadiness?.resolvedModifiers || 0} / {data?.onboardingReadiness?.totalOptionItems || 0} ({data?.onboardingReadiness?.modifierCompletionPercent || 0}%)
              </p>
            </AdminCard>
            <AdminCard className="p-4">
              <p className="font-bold text-slate-500 uppercase text-[10px]">3. Danh Mục Nguyên Liệu & NCC</p>
              <p className="text-lg font-black text-slate-900 mt-1">
                {data?.onboardingReadiness?.ingredientMasterCount || 0} NL • {data?.onboardingReadiness?.supplierCompletion?.suppliersWithTaxCode || 0}/{data?.onboardingReadiness?.supplierCompletion?.totalSuppliers || 0} NCC có MST
              </p>
            </AdminCard>
            <AdminCard className="p-4">
              <p className="font-bold text-slate-500 uppercase text-[10px]">4. Seed & Tồn Đầu Kỳ (OPENING)</p>
              <p className="text-sm font-black text-rose-700 mt-1">
                Seed: {data?.onboardingReadiness?.seedRowsRemaining || 0} dòng • Opening Tx: {data?.onboardingReadiness?.openingStocktakeProgress?.openingBalanceTransactions || 0}
              </p>
            </AdminCard>
          </div>

          <AdminCard className="overflow-hidden">
            <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800">
                Danh Sách Hạng Mục Chặn Kích Hoạt Pilot AVO1 (Operational Blockers)
              </h4>
              <span className="text-[11px] font-bold text-slate-500">
                Chỉ số chỉ tính dữ liệu đã phê duyệt — không tính file mẫu trống
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b text-[11px] font-black uppercase text-slate-500">
                    <th className="py-2.5 px-4">Mã</th>
                    <th className="py-2.5 px-4">Mô Tả Vấn Đề</th>
                    <th className="py-2.5 px-4">Chi Nhánh / Phạm Vi</th>
                    <th className="py-2.5 px-4">Chủ Trì (Owner)</th>
                    <th className="py-2.5 px-4">Hành Động Bắt Buộc</th>
                    <th className="py-2.5 px-4">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.blockers || []).map((blk: any) => (
                    <tr key={blk.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-700">{blk.id}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{blk.description}</td>
                      <td className="py-2.5 px-4 text-slate-700">
                        <span className="font-semibold">{blk.affectedBranch}</span>
                        <div className="text-[10px] text-slate-500">{blk.affectedProducts}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{blk.owner}</td>
                      <td className="py-2.5 px-4 text-slate-600">{blk.requiredAction}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                          {blk.approvalStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!data?.blockers || data.blockers.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-emerald-700 font-bold">
                        Không còn blocker kích hoạt kho!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </div>
      )}

      {/* TAB 1: OPERATIONAL EXCEPTIONS */}
      {activeTab === 'exceptions' && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500">
                  <th className="py-3 px-4">Thời Gian</th>
                  <th className="py-3 px-4">Chi Nhánh</th>
                  <th className="py-3 px-4">Loại Ngoại Lệ & Policy</th>
                  <th className="py-3 px-4">Món / Nguyên Liệu / Đơn</th>
                  <th className="py-3 px-4">Nguyên Nhân & Đề Xuất</th>
                  <th className="py-3 px-4">Correlation ID / Actor</th>
                  <th className="py-3 px-4 text-center">Xử Lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.exceptions?.map((ex: any) => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(ex.detectedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{ex.branch?.name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold block w-fit ${
                          ex.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ex.exceptionType}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-1 block">{ex.policyApplied}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{ex.productName || ex.ingredientName || '---'}</p>
                      {ex.orderId && <p className="text-[10px] font-mono text-slate-500">Order: {ex.orderCode || ex.orderId.slice(0, 8)}</p>}
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <p className="text-slate-800 font-medium">{ex.failureReason}</p>
                      {ex.recommendedAction && (
                        <p className="text-[11px] text-indigo-700 mt-0.5">→ {ex.recommendedAction}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-600">
                      <p className="font-mono">{ex.correlationId || '---'}</p>
                      <p>{ex.actorName || 'Hệ thống'}</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {ex.status === 'OPEN' && (
                          <button
                            onClick={() => handleResolveException(ex.id, 'ACKNOWLEDGED')}
                            className="px-2 py-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
                          >
                            Tiếp nhận
                          </button>
                        )}
                        <button
                          onClick={() => handleResolveException(ex.id, 'RESOLVED')}
                          className="px-2 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100"
                        >
                          Đóng / Xong
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data?.exceptions || data.exceptions.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                      Chưa ghi nhận cảnh báo ngoại lệ POS/KDS đang mở
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* TAB 2: BRANCH ACTIVATION & POLICY */}
      {activeTab === 'readiness' && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500">
                  <th className="py-3 px-4">Chi Nhánh</th>
                  <th className="py-3 px-4">Số Kho / Bản Ghi Tồn</th>
                  <th className="py-3 px-4">Giao Dịch Sổ Cái (Opening/Movements)</th>
                  <th className="py-3 px-4">Độ Phủ Công Thức BOM</th>
                  <th className="py-3 px-4">Trạng Thái Sẵn Sàng</th>
                  <th className="py-3 px-4">Chính Sách Vận Hành POS/KDS</th>
                  <th className="py-3 px-4 text-center">Kích Hoạt Chi Nhánh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.branchReadiness?.map((br: any) => (
                  <tr key={br.branchId} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{br.branchName}</p>
                      <p className="text-[10px] font-mono text-slate-500">{br.branchCode}</p>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {br.warehouseCount} kho • {br.balanceCount} dòng tồn
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      {br.ledgerTxCount > 0 ? (
                        <span className="text-emerald-700">{br.ledgerTxCount} giao dịch</span>
                      ) : (
                        <span className="text-rose-600">0 (Chưa kiểm kê đầu kỳ)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {br.publishedRecipeCount}/{br.totalTrackedProducts} ({br.recipeCoveragePercent}%)
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          br.readinessStatus === 'ACTIVATED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : br.readinessStatus === 'READY_FOR_ACTIVATION'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {br.readinessStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={br.inventoryPolicy}
                        onChange={(e) =>
                          handleUpdateBranchPolicy(br.branchId, br.inventoryActivated, e.target.value as any)
                        }
                        className="border rounded-lg px-2 py-1 text-xs font-bold"
                      >
                        <option value="WARN_AND_ALLOW">WARN_AND_ALLOW (Cảnh báo & Cho phép bán)</option>
                        <option value="STRICT_TRACKING">STRICT_TRACKING (Chặn nếu thiếu kho/CT)</option>
                        <option value="MANUAL_CONSUMPTION">MANUAL_CONSUMPTION (Xuất thủ công)</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() =>
                          handleUpdateBranchPolicy(br.branchId, !br.inventoryActivated, br.inventoryPolicy)
                        }
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                          br.inventoryActivated
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {br.inventoryActivated ? 'Tạm Tắt Trừ Kho' : 'Kích Hoạt'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* TAB 3: MISSING RECIPES */}
      {activeTab === 'missing_recipes' && (
        <AdminCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black uppercase text-slate-800">
              Danh Sách Món Đang Bán Chưa Có Công Thức BOM ({kpis.missingRecipeCount || 0} món)
            </h4>
            <Link
              href="/admin/inventory/recipes"
              className="px-3 py-1.5 bg-[#da251d] text-white text-xs font-bold rounded-lg hover:bg-red-700"
            >
              Thiết Lập Công Thức BOM →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {data?.missingRecipeSample?.map((p: any) => (
              <div key={p.id} className="p-3 bg-slate-50 rounded-lg border flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{p.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {p.category} • {p.itemCode}
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                  RECIPE_MISSING
                </span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* TAB 4: PENDING DOCS & FEFO */}
      {activeTab === 'pending_docs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AdminCard className="p-5 space-y-3">
            <h4 className="text-sm font-black uppercase text-slate-800">
              Nguyên Liệu Sắp Hết / Hết Hàng ({data?.lowStockAlerts?.length || 0})
            </h4>
            <div className="space-y-2 text-xs max-h-80 overflow-y-auto">
              {data?.lowStockAlerts?.map((a: any) => (
                <div key={a.balanceId} className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{a.ingredientName}</p>
                    <p className="text-[11px] text-slate-500">
                      {a.warehouseName} ({a.branchName})
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-black text-rose-600">
                      {a.currentStock} {a.unitSymbol}
                    </span>
                    <p className="text-[10px] text-slate-500">Min: {a.minimumStock}</p>
                  </div>
                </div>
              ))}
              {(!data?.lowStockAlerts || data.lowStockAlerts.length === 0) && (
                <p className="text-xs text-slate-400 text-center py-6">Tồn kho an toàn</p>
              )}
            </div>
          </AdminCard>

          <AdminCard className="p-5 space-y-3">
            <h4 className="text-sm font-black uppercase text-slate-800">
              Chứng Từ Chờ Duyệt (Transfers / PO / Stocktakes)
            </h4>
            <div className="space-y-2 text-xs">
              {data?.pendingTransfers?.map((t: any) => (
                <div key={t.id} className="p-2.5 bg-purple-50 rounded-lg flex items-center justify-between">
                  <span>
                    Chuyển kho <strong>{t.transferCode}</strong>: {t.fromBranch?.name} → {t.toBranch?.name}
                  </span>
                  <span className="font-bold text-purple-800">{t.status}</span>
                </div>
              ))}
              {data?.unapprovedStocktakes?.map((s: any) => (
                <div key={s.id} className="p-2.5 bg-cyan-50 rounded-lg flex items-center justify-between">
                  <span>
                    Kiểm kê <strong>{s.stocktakeCode}</strong> ({s.warehouse?.name})
                  </span>
                  <span className="font-bold text-cyan-800">{s.status}</span>
                </div>
              ))}
              {(!data?.pendingTransfers?.length && !data?.unapprovedStocktakes?.length && !data?.pendingPOs?.length) && (
                <p className="text-xs text-slate-400 text-center py-6">Không có chứng từ tồn đọng</p>
              )}
            </div>
          </AdminCard>
        </div>
      )}
    </div>
  );
}

