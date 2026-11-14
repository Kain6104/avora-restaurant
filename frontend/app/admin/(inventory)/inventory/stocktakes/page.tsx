'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import {
  ClipboardCheck,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  TrendingDown,
  Trash2,
  X,
  Scale,
  Calendar,
} from 'lucide-react';
import { PageHeader, AdminCard, StatusBadge } from '@/app/admin/components/ui';

export default function StocktakesAndWastePage() {
  const { selectedBranchId } = useAdmin();
  const [activeTab, setActiveTab] = useState<'stocktake' | 'waste'>('stocktake');
  const [loading, setLoading] = useState(true);

  // Data
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [wasteRecords, setWasteRecords] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);

  // Modals
  const [isStocktakeModalOpen, setIsStocktakeModalOpen] = useState(false);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [selectedStocktake, setSelectedStocktake] = useState<any>(null);

  // Forms
  const [stocktakeForm, setStocktakeForm] = useState<{
    warehouseId: string;
    branchId: string;
    isBlindCount: boolean;
    stocktakeType: 'CYCLE_COUNT' | 'OPENING_BALANCE';
    includeAllIngredients: boolean;
    notes: string;
  }>({
    warehouseId: '',
    branchId: '',
    isBlindCount: false,
    stocktakeType: 'CYCLE_COUNT',
    includeAllIngredients: false,
    notes: '',
  });

  const [wasteForm, setWasteForm] = useState({
    branchId: '',
    warehouseId: '',
    ingredientId: '',
    quantity: 1,
    unitSymbol: 'kg',
    reason: 'PREPARATION_WASTE',
    explanation: '',
    notes: '',
  });

  const [countsData, setCountsData] = useState<{
    [ingId: string]: { actualQuantity: number; batchNumber?: string; expirationDate?: string; unitCost?: number };
  }>({});

  const formatMoney = (val = 0) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const bParam = selectedBranchId && selectedBranchId !== 'ALL' ? `?branchId=${selectedBranchId}` : '';
      const [stkRes, wstRes, whRes, ingRes] = await Promise.all([
        fetch(`/api/admin/inventory/stocktakes${bParam}`, { credentials: 'include' }),
        fetch(`/api/admin/inventory/waste${bParam}`, { credentials: 'include' }),
        fetch(`/api/admin/inventory/warehouses${bParam}`, { credentials: 'include' }),
        fetch('/api/admin/inventory/ingredients', { credentials: 'include' }),
      ]);

      const [stkJson, wstJson, whJson, ingJson] = await Promise.all([
        stkRes.json(),
        wstRes.json(),
        whRes.json(),
        ingRes.json(),
      ]);

      if (stkJson.success) setStocktakes(stkJson.data || []);
      if (wstJson.success) setWasteRecords(wstJson.data || []);
      if (whJson.success) setWarehouses(whJson.data || []);
      if (ingJson.success) setIngredients(ingJson.data?.items || []);
    } catch (e) {
      console.error('Error fetching stocktakes and waste:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create Stocktake Session
  const handleCreateStocktake = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const wh = warehouses.find((w) => w.id === stocktakeForm.warehouseId);
      const res = await fetch('/api/admin/inventory/stocktakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...stocktakeForm,
          branchId: wh?.branchId || selectedBranchId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsStocktakeModalOpen(false);
        alert('Đã tạo phiên kiểm kê thành công!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi tạo phiên kiểm kê');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Open Count Modal
  const openCountModal = async (stocktake: any) => {
    try {
      const res = await fetch(`/api/admin/inventory/stocktakes/${stocktake.id}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setSelectedStocktake(json.data);
        const initialCounts: {
          [ingId: string]: { actualQuantity: number; batchNumber?: string; expirationDate?: string; unitCost?: number };
        } = {};
        json.data.items?.forEach((it: any) => {
          initialCounts[it.ingredientId] = {
            actualQuantity: Number(it.actualQuantity || it.systemQuantity || 0),
            unitCost: Number(it.unitCost || 0),
          };
        });
        setCountsData(initialCounts);
        setIsCountModalOpen(true);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Counts
  const handleSubmitCounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStocktake) return;
    try {
      const counts = Object.entries(countsData).map(([ingredientId, data]) => ({
        ingredientId,
        actualQuantity: Number(data.actualQuantity),
        ...(data.batchNumber ? { batchNumber: data.batchNumber } : {}),
        ...(data.expirationDate ? { expirationDate: data.expirationDate } : {}),
        ...(data.unitCost !== undefined ? { unitCost: Number(data.unitCost) } : {}),
      }));

      const res = await fetch(`/api/admin/inventory/stocktakes/${selectedStocktake.id}/counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ counts }),
      });
      const json = await res.json();
      if (json.success) {
        setIsCountModalOpen(false);
        alert('Đã gửi số liệu đếm thành công! Quản lý có thể phê duyệt cân chỉnh kho.');
        fetchData();
      } else {
        alert(json.message || 'Lỗi gửi số liệu đếm');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Review & Approve Stocktake
  const handleReviewStocktake = async (id: string, approved: boolean) => {
    if (!confirm(approved ? 'Phê duyệt phiên kiểm kê và tự động cân chỉnh tồn kho thực tế?' : 'Từ chối phiên kiểm kê?'))
      return;
    try {
      const res = await fetch(`/api/admin/inventory/stocktakes/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved }),
      });
      const json = await res.json();
      if (json.success) {
        alert('Đã duyệt & cân chỉnh sổ cái tồn kho thành công!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi duyệt kiểm kê');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create Waste Record
  const handleCreateWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const wh = warehouses.find((w) => w.id === wasteForm.warehouseId);
      const res = await fetch('/api/admin/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...wasteForm,
          branchId: wh?.branchId || selectedBranchId,
          quantity: parseFloat(wasteForm.quantity as any) || 0,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsWasteModalOpen(false);
        alert('Đã ghi nhận phiếu hao hụt và cập nhật sổ cái tồn kho thành công!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi lập phiếu hao hụt');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Kiểm Kê Kho & Báo Cáo Hao Hụt (Stocktake & Spoilage)"
        subtitle="Kiểm đếm thực tế, phát hiện chênh lệch thừa/thiếu, cân chỉnh sổ cái kho và kiểm soát hao hụt nhà bếp"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              title="Làm mới"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            {activeTab === 'stocktake' ? (
              <button
                onClick={() => {
                  setStocktakeForm({
                    warehouseId: warehouses[0]?.id || '',
                    branchId: warehouses[0]?.branchId || '',
                    isBlindCount: false,
                    stocktakeType: 'CYCLE_COUNT',
                    includeAllIngredients: false,
                    notes: '',
                  });
                  setIsStocktakeModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition shadow-sm"
              >
                <Plus size={15} />
                Tạo Phiên Kiểm Kê
              </button>
            ) : (
              <button
                onClick={() => {
                  setWasteForm({
                    branchId: warehouses[0]?.branchId || '',
                    warehouseId: warehouses[0]?.id || '',
                    ingredientId: ingredients[0]?.id || '',
                    quantity: 1,
                    unitSymbol: ingredients[0]?.primaryUnit?.symbol || 'kg',
                    reason: 'PREPARATION_WASTE',
                    explanation: '',
                    notes: '',
                  });
                  setIsWasteModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition shadow-sm"
              >
                <Trash2 size={15} />
                Báo Cáo Hao Hụt / Hỏng
              </button>
            )}
          </div>
        }
      />

      {/* TABS */}
      <div className="flex items-center border-b border-slate-200 gap-1 bg-white px-4 rounded-xl shadow-xs">
        <button
          onClick={() => setActiveTab('stocktake')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'stocktake'
              ? 'border-[#da251d] text-[#da251d]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck size={15} />
          Kiểm Kê Định Kỳ (Stocktakes)
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'stocktake' ? 'bg-red-50 text-[#da251d]' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {stocktakes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('waste')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'waste'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Trash2 size={15} />
          Hao Hụt & Hư Hỏng (Waste & Spoilage)
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'waste' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {wasteRecords.length}
          </span>
        </button>
      </div>

      {/* TAB 1: STOCKTAKES */}
      {activeTab === 'stocktake' && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                  <th className="py-3 px-4">Mã Phiên</th>
                  <th className="py-3 px-4">Kho Kiểm Kê</th>
                  <th className="py-3 px-4">Chi Nhánh</th>
                  <th className="py-3 px-4">Số Mặt Hàng</th>
                  <th className="py-3 px-4 text-right">SL Hệ Thống</th>
                  <th className="py-3 px-4 text-right">SL Thực Tế</th>
                  <th className="py-3 px-4 text-right">Chênh Lệch Giá Trị</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {stocktakes.map((stk) => {
                  const varVal = Number(stk.totalVarianceValue || 0);
                  return (
                    <tr key={stk.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{stk.stocktakeCode}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{stk.warehouse?.name}</td>
                      <td className="py-3 px-4 text-slate-600">{stk.branch?.name}</td>
                      <td className="py-3 px-4 font-mono">{stk.items?.length || 0} mã</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {Number(stk.totalSystemQuantity || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {Number(stk.totalActualQuantity || 0).toLocaleString()}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-black ${
                          varVal < 0 ? 'text-rose-600' : varVal > 0 ? 'text-emerald-600' : 'text-slate-600'
                        }`}
                      >
                        {formatMoney(varVal)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            stk.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : stk.status === 'SUBMITTED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {stk.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {stk.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => openCountModal(stk)}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100"
                            >
                              Nhập SL Đếm
                            </button>
                          )}
                          {stk.status === 'SUBMITTED' && (
                            <button
                              onClick={() => handleReviewStocktake(stk.id, true)}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 flex items-center gap-1"
                            >
                              <CheckCircle2 size={12} /> Duyệt & Cân Chỉnh
                            </button>
                          )}
                          {stk.status === 'COMPLETED' && (
                            <span className="text-emerald-600 font-bold text-[11px]">Đã cân chỉnh</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {stocktakes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Chưa có phiên kiểm kê nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* TAB 2: WASTE & SPOILAGE */}
      {activeTab === 'waste' && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                  <th className="py-3 px-4">Mã Phiếu</th>
                  <th className="py-3 px-4">Nguyên Liệu</th>
                  <th className="py-3 px-4">Kho</th>
                  <th className="py-3 px-4">Chi Nhánh</th>
                  <th className="py-3 px-4 text-right">Số Lượng Hỏng</th>
                  <th className="py-3 px-4 text-right">Thiệt Hại Giá Vốn</th>
                  <th className="py-3 px-4">Lý Do Hao Hụt</th>
                  <th className="py-3 px-4">Người Báo Cáo</th>
                  <th className="py-3 px-4">Ngày Báo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {wasteRecords.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{w.wasteCode}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{w.ingredient?.name}</td>
                    <td className="py-3 px-4 text-slate-700">{w.warehouse?.name}</td>
                    <td className="py-3 px-4 text-slate-600">{w.branch?.name}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                      -{Number(w.quantity)} {w.unitSymbol}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-700">
                      {formatMoney(Number(w.totalLossValue))}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        {w.reason}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{w.reportedByName || 'Nhân viên bếp'}</td>
                    <td className="py-3 px-4 text-slate-500">{new Date(w.createdAt).toLocaleDateString('vi-VN')}</td>
                  </tr>
                ))}
                {wasteRecords.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Chưa có phiếu hao hụt nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* MODAL TẠO PHIÊN KIỂM KÊ */}
      {isStocktakeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <ClipboardCheck size={18} className="text-[#da251d]" /> Tạo Phiên Kiểm Kê Định Kỳ
              </h3>
              <button onClick={() => setIsStocktakeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStocktake} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Loại phiên kiểm kê</label>
                <select
                  value={stocktakeForm.stocktakeType}
                  onChange={(e) => {
                    const t = e.target.value as 'CYCLE_COUNT' | 'OPENING_BALANCE';
                    setStocktakeForm({
                      ...stocktakeForm,
                      stocktakeType: t,
                      isBlindCount: t === 'OPENING_BALANCE' ? true : stocktakeForm.isBlindCount,
                      includeAllIngredients: t === 'OPENING_BALANCE',
                    });
                  }}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="CYCLE_COUNT">Kiểm kê định kỳ (CYCLE_COUNT)</option>
                  <option value="OPENING_BALANCE">Kiểm kê mở kỳ / Tồn đầu kỳ (OPENING_BALANCE)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Kho cần kiểm kê *</label>
                <select
                  required
                  value={stocktakeForm.warehouseId}
                  onChange={(e) => {
                    const wh = warehouses.find((w) => w.id === e.target.value);
                    setStocktakeForm({
                      ...stocktakeForm,
                      warehouseId: e.target.value,
                      branchId: wh?.branchId || stocktakeForm.branchId,
                    });
                  }}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="">-- Chọn kho kiểm kê --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.branch?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  id="blindCount"
                  checked={stocktakeForm.isBlindCount}
                  onChange={(e) => setStocktakeForm({ ...stocktakeForm, isBlindCount: e.target.checked })}
                  className="w-4 h-4 text-[#da251d]"
                />
                <label htmlFor="blindCount" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Kiểm đếm mù (Blind Count - Ẩn số lượng tồn hệ thống để nhân viên đếm khách quan)
                </label>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi chú phiên kiểm</label>
                <textarea
                  rows={2}
                  value={stocktakeForm.notes}
                  onChange={(e) => setStocktakeForm({ ...stocktakeForm, notes: e.target.value })}
                  placeholder="Kiểm kê cuối tháng, kiểm ca đóng cửa..."
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsStocktakeModalOpen(false)}
                  className="px-4 py-2 border rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#da251d] text-white font-bold rounded-lg hover:bg-red-700 shadow-sm"
                >
                  Bắt Đầu Kiểm Kê
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NHẬP SỐ LƯỢNG ĐẾM */}
      {isCountModalOpen && selectedStocktake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Scale size={18} className="text-indigo-600" /> Nhập Kết Quả Đếm ({selectedStocktake.stocktakeCode})
              </h3>
              <button onClick={() => setIsCountModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitCounts} className="space-y-4 text-xs">
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto border rounded-xl p-2 bg-slate-50">
                {selectedStocktake.items?.map((it: any) => (
                  <div key={it.id} className="py-2.5 px-3 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{it.ingredient?.name}</p>
                      {!selectedStocktake.isBlindCount && (
                        <p className="text-[11px] text-slate-500">
                          Sổ sách: {Number(it.systemQuantity)} {it.unitSymbol}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-600">Thực tế:</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={countsData[it.ingredientId]?.actualQuantity ?? 0}
                        onChange={(e) =>
                          setCountsData({
                            ...countsData,
                            [it.ingredientId]: {
                              ...(countsData[it.ingredientId] || { actualQuantity: 0 }),
                              actualQuantity: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-24 border rounded p-1.5 font-bold font-mono text-right"
                      />
                      <span className="text-xs font-bold text-slate-600 w-8">{it.unitSymbol}</span>
                      {selectedStocktake.stocktakeCode?.startsWith('STK-OPEN-') && (
                        <>
                          <input
                            type="text"
                            placeholder="Số lô (Lot)"
                            value={countsData[it.ingredientId]?.batchNumber || ''}
                            onChange={(e) =>
                              setCountsData({
                                ...countsData,
                                [it.ingredientId]: {
                                  ...(countsData[it.ingredientId] || { actualQuantity: 0 }),
                                  batchNumber: e.target.value,
                                },
                              })
                            }
                            className="w-28 border rounded p-1.5 text-[11px] font-mono"
                          />
                          <input
                            type="date"
                            title="Hạn sử dụng"
                            value={countsData[it.ingredientId]?.expirationDate || ''}
                            onChange={(e) =>
                              setCountsData({
                                ...countsData,
                                [it.ingredientId]: {
                                  ...(countsData[it.ingredientId] || { actualQuantity: 0 }),
                                  expirationDate: e.target.value,
                                },
                              })
                            }
                            className="w-32 border rounded p-1.5 text-[11px]"
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCountModalOpen(false)}
                  className="px-4 py-2 border rounded-lg font-bold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                >
                  Lưu & Gửi Phê Duyệt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BÁO CÁO HAO HỤT */}
      {isWasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Trash2 size={18} className="text-rose-600" /> Báo Cáo Hao Hụt / Hỏng Hóc
              </h3>
              <button onClick={() => setIsWasteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWaste} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Kho xảy ra hao hụt *</label>
                <select
                  required
                  value={wasteForm.warehouseId}
                  onChange={(e) => {
                    const wh = warehouses.find((w) => w.id === e.target.value);
                    setWasteForm({
                      ...wasteForm,
                      warehouseId: e.target.value,
                      branchId: wh?.branchId || wasteForm.branchId,
                    });
                  }}
                  className="w-full border rounded-lg p-2"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.branch?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nguyên liệu hao hụt *</label>
                <select
                  required
                  value={wasteForm.ingredientId}
                  onChange={(e) => {
                    const ing = ingredients.find((i) => i.id === e.target.value);
                    setWasteForm({
                      ...wasteForm,
                      ingredientId: e.target.value,
                      unitSymbol: ing?.primaryUnit?.symbol || 'kg',
                    });
                  }}
                  className="w-full border rounded-lg p-2"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số lượng hao hụt *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={wasteForm.quantity}
                    onChange={(e) => setWasteForm({ ...wasteForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    disabled
                    value={wasteForm.unitSymbol}
                    className="w-full border rounded-lg p-2 bg-slate-50 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lý do hao hụt *</label>
                <select
                  required
                  value={wasteForm.reason}
                  onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                  className="w-full border rounded-lg p-2 font-bold"
                >
                  <option value="PREPARATION_WASTE">Hao hụt sơ chế (Gọt bỏ, lọc xương, màng mỡ)</option>
                  <option value="KITCHEN_SPOILAGE">Hỏng hóc trong chế biến (Cháy, đổ, hỏng nhiệt)</option>
                  <option value="EXPIRED">Hết hạn sử dụng (FEFO Expired)</option>
                  <option value="DAMAGED">Bể vỡ, rách bao bì, hỏng do bảo quản</option>
                  <option value="CUSTOMER_RETURN">Khách hàng trả món / Hủy món do chế biến sai</option>
                  <option value="STAFF_MEAL">Cơm nhân viên / Thử món nội bộ</option>
                  <option value="OTHER">Lý do khác</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Giải trình chi tiết</label>
                <textarea
                  rows={2}
                  value={wasteForm.explanation}
                  onChange={(e) => setWasteForm({ ...wasteForm, explanation: e.target.value })}
                  placeholder="Mô tả nguyên nhân cụ thể dẫn đến hao hụt..."
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsWasteModalOpen(false)}
                  className="px-4 py-2 border rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 shadow-sm"
                >
                  Lưu & Xuất Kho Hao Hụt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
