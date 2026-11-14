'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import {
  FileText,
  RefreshCw,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { PageHeader, AdminCard } from '@/app/admin/components/ui';

export default function InventoryTransactionsPage() {
  const { selectedBranchId } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 30, totalPages: 1 });
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);

  // Filters
  const [warehouseId, setWarehouseId] = useState('ALL');
  const [ingredientId, setIngredientId] = useState('ALL');
  const [txType, setTxType] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const formatMoney = (val = 0) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const fetchMeta = useCallback(async () => {
    try {
      const bParam = selectedBranchId && selectedBranchId !== 'ALL' ? `?branchId=${selectedBranchId}` : '';
      const [whRes, ingRes] = await Promise.all([
        fetch(`/api/admin/inventory/warehouses${bParam}`, { credentials: 'include' }),
        fetch('/api/admin/inventory/ingredients', { credentials: 'include' }),
      ]);
      const [whJson, ingJson] = await Promise.all([whRes.json(), ingRes.json()]);
      if (whJson.success) setWarehouses(whJson.data || []);
      if (ingJson.success) setIngredients(ingJson.data?.items || []);
    } catch (e) {
      console.error(e);
    }
  }, [selectedBranchId]);

  const fetchTransactions = useCallback(
    async (pageNumber = 1) => {
      setLoading(true);
      try {
        const p = new URLSearchParams();
        p.set('page', String(pageNumber));
        p.set('limit', '30');
        if (selectedBranchId && selectedBranchId !== 'ALL') p.set('branchId', selectedBranchId);
        if (warehouseId !== 'ALL') p.set('warehouseId', warehouseId);
        if (ingredientId !== 'ALL') p.set('ingredientId', ingredientId);
        if (txType !== 'ALL') p.set('type', txType);
        if (startDate) p.set('startDate', startDate);
        if (endDate) p.set('endDate', endDate);

        const res = await fetch(`/api/admin/inventory/transactions?${p.toString()}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success) {
          setTransactions(json.data?.items || []);
          setPagination(json.data?.pagination || { total: 0, page: 1, limit: 30, totalPages: 1 });
        }
      } catch (e) {
        console.error('Error fetching transactions:', e);
      } finally {
        setLoading(false);
      }
    },
    [selectedBranchId, warehouseId, ingredientId, txType, startDate, endDate],
  );

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  const txTypeLabels: Record<string, { label: string; color: string }> = {
    OPENING_BALANCE: { label: 'Khởi Tạo Tồn Đầu', color: 'bg-blue-100 text-blue-800' },
    PURCHASE_RECEIPT: { label: 'Nhập Hàng NCC (GRN)', color: 'bg-emerald-100 text-emerald-800' },
    PURCHASE_RETURN: { label: 'Trả Hàng Nhập', color: 'bg-orange-100 text-orange-800' },
    SUPPLIER_RETURN: { label: 'Trả Nhà Cung Cấp', color: 'bg-orange-100 text-orange-800' },
    STOCK_TRANSFER_OUT: { label: 'Xuất Điều Chuyển Kho', color: 'bg-purple-100 text-purple-800' },
    STOCK_TRANSFER_IN: { label: 'Nhập Điều Chuyển Kho', color: 'bg-indigo-100 text-indigo-800' },
    ORDER_RESERVATION: { label: 'Giữ Chỗ Nguyên Liệu (KDS)', color: 'bg-sky-100 text-sky-800' },
    ORDER_RESERVATION_RELEASE: { label: 'Giải Phóng Giữ Chỗ (Hủy Đơn)', color: 'bg-cyan-100 text-cyan-800' },
    RECIPE_CONSUMPTION: { label: 'Xuất Chế Biến Bếp/POS', color: 'bg-amber-100 text-amber-800' },
    STOCK_COUNT_GAIN: { label: 'Kiểm Kê Tăng (Thừa)', color: 'bg-teal-100 text-teal-800' },
    STOCK_COUNT_LOSS: { label: 'Kiểm Kê Giảm (Thiếu)', color: 'bg-rose-100 text-rose-800' },
    WASTE: { label: 'Xuất Hủy / Hao Hụt', color: 'bg-red-100 text-red-800' },
    SPOILAGE: { label: 'Hư Hỏng / Hết Hạn', color: 'bg-red-100 text-red-800' },
    PREPARATION_LOSS: { label: 'Hao Hụt Sơ Chế', color: 'bg-pink-100 text-pink-800' },
    STOCK_ADJUSTMENT: { label: 'Điều Chỉnh Kho Thủ Công', color: 'bg-slate-100 text-slate-800' },
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Sổ Cái Biến Động Kho (Immutable Ledger)"
        subtitle="Nhật ký bất biến ghi lại mọi giao dịch nhập, xuất, tiêu hao bếp, điều chuyển, kiểm kê và hao hụt theo thời gian thực"
        actions={
          <button
            onClick={() => fetchTransactions(pagination.page)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        }
      />

      {/* FILTERS */}
      <AdminCard className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-600 block mb-1">Kho lưu trữ</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 focus:border-[#da251d]"
            >
              <option value="ALL">Tất cả kho</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Nguyên liệu</label>
            <select
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 focus:border-[#da251d]"
            >
              <option value="ALL">Tất cả nguyên liệu</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Loại giao dịch</label>
            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 focus:border-[#da251d]"
            >
              <option value="ALL">Tất cả loại giao dịch</option>
              {Object.entries(txTypeLabels).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Từ ngày</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Đến ngày</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2"
            />
          </div>
        </div>
      </AdminCard>

      {/* LEDGER TABLE */}
      <AdminCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                <th className="py-3 px-4">Mã Giao Dịch</th>
                <th className="py-3 px-4">Thời Gian</th>
                <th className="py-3 px-4">Loại Giao Dịch</th>
                <th className="py-3 px-4">Nguyên Liệu</th>
                <th className="py-3 px-4">Kho / Chi Nhánh</th>
                <th className="py-3 px-4 text-right">Biến Động SL</th>
                <th className="py-3 px-4 text-right">Trước → Sau</th>
                <th className="py-3 px-4 text-right">Giá Trị Vốn</th>
                <th className="py-3 px-4">Chứng Từ Nguồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {transactions.map((tx) => {
                const qtyIn = Number(tx.quantityIn || 0);
                const qtyOut = Number(tx.quantityOut || 0);
                const isIn = qtyIn > 0;
                const meta = txTypeLabels[tx.type] || { label: tx.type, color: 'bg-slate-100 text-slate-700' };

                return (
                  <tr key={tx.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{tx.transactionCode}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{tx.ingredient?.name || tx.ingredientNameSnapshot}</p>
                      {tx.batch && (
                        <p className="text-[10px] font-mono text-slate-500">Lô: {tx.batch.batchNumber}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-700">{tx.warehouse?.name}</p>
                      <p className="text-[10px] text-slate-500">{tx.branch?.name}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black">
                      {isIn ? (
                        <span className="text-emerald-600 inline-flex items-center gap-0.5">
                          <ArrowDownLeft size={13} />+{qtyIn.toLocaleString()} {tx.unitSymbol}
                        </span>
                      ) : (
                        <span className="text-rose-600 inline-flex items-center gap-0.5">
                          <ArrowUpRight size={13} />-{qtyOut.toLocaleString()} {tx.unitSymbol}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {Number(tx.beforeQuantity).toLocaleString()} →{' '}
                      <span className="font-bold text-slate-900">{Number(tx.afterQuantity).toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatMoney(Number(tx.totalCost))}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={tx.sourceReference || tx.notes}>
                      {tx.sourceReference || tx.notes || '---'}
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Không có giao dịch sổ cái nào phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>
            Tổng cộng <strong>{pagination.total}</strong> giao dịch (Trang {pagination.page}/{pagination.totalPages || 1})
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchTransactions(pagination.page - 1)}
              className="p-1.5 border rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchTransactions(pagination.page + 1)}
              className="p-1.5 border rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}
