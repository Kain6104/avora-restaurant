'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import {
  ArrowRightLeft,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  AlertTriangle,
  X,
  Building,
  Warehouse,
  Package,
} from 'lucide-react';
import { PageHeader, AdminCard, StatusBadge } from '@/app/admin/components/ui';

export default function StockTransfersPage() {
  const { selectedBranchId, allBranches } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({
    fromBranchId: '',
    fromWarehouseId: '',
    toBranchId: '',
    toWarehouseId: '',
    notes: '',
    items: [
      {
        ingredientId: '',
        requestedQuantity: 5,
        unitSymbol: 'kg',
        notes: '',
      },
    ],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const bParam = selectedBranchId && selectedBranchId !== 'ALL' ? `?branchId=${selectedBranchId}` : '';
      const [tRes, wRes, iRes] = await Promise.all([
        fetch(`/api/admin/inventory/transfers${bParam}`, { credentials: 'include' }),
        fetch('/api/admin/inventory/warehouses', { credentials: 'include' }),
        fetch('/api/admin/inventory/ingredients', { credentials: 'include' }),
      ]);

      const [tJson, wJson, iJson] = await Promise.all([tRes.json(), wRes.json(), iRes.json()]);

      if (tJson.success) setTransfers(tJson.data || []);
      if (wJson.success) setWarehouses(wJson.data || []);
      if (iJson.success) setIngredients(iJson.data?.items || []);
    } catch (e) {
      console.error('Error fetching stock transfers:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          items: formData.items.map((it: any) => ({
            ...it,
            requestedQuantity: parseFloat(it.requestedQuantity) || 0,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        alert('Đã tạo phiếu điều chuyển kho thành công!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi tạo phiếu điều chuyển');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn duyệt phiếu điều chuyển này?')) return;
    try {
      const res = await fetch(`/api/admin/inventory/transfers/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        alert('Đã duyệt phiếu điều chuyển!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi duyệt');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDispatch = async (t: any) => {
    if (!confirm('Xác nhận xuất kho cho phiếu này? Sổ cái kho xuất sẽ ghi giảm tồn.')) return;
    try {
      const res = await fetch(`/api/admin/inventory/transfers/${t.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dispatchedItems: t.items?.map((it: any) => ({
            transferItemId: it.id,
            dispatchedQuantity: Number(it.requestedQuantity),
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert('Đã xuất kho điều chuyển thành công!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi xuất kho');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReceive = async (t: any) => {
    if (!confirm('Xác nhận đã nhận hàng vào kho đích? Sổ cái kho nhận sẽ ghi tăng tồn.')) return;
    try {
      const res = await fetch(`/api/admin/inventory/transfers/${t.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receivedItems: t.items?.map((it: any) => ({
            transferItemId: it.id,
            receivedQuantity: Number(it.dispatchedQuantity || it.requestedQuantity),
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert('Đã nhập kho đích thành công!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi nhận hàng');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
      case 'REQUESTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">CHỜ DUYỆT</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">ĐÃ DUYỆT</span>;
      case 'IN_TRANSIT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">ĐANG VẬN CHUYỂN</span>;
      case 'RECEIVED':
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">HOÀN TẤT</span>;
      case 'CANCELLED':
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">ĐÃ HỦY</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Điều Chuyển Kho Liên Chi Nhánh (Stock Transfers)"
        subtitle="Quy trình điều chuyển kho 4 bước: Yêu cầu → Phê duyệt → Xuất kho vận chuyển → Nhập kho đích"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              title="Làm mới"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => {
                const b1 = allBranches[0]?.id || '';
                const b2 = allBranches[1]?.id || b1;
                const wh1 = warehouses.find((w) => w.branchId === b1)?.id || warehouses[0]?.id || '';
                const wh2 = warehouses.find((w) => w.branchId === b2 && w.id !== wh1)?.id || warehouses[1]?.id || wh1;

                setFormData({
                  fromBranchId: b1,
                  fromWarehouseId: wh1,
                  toBranchId: b2,
                  toWarehouseId: wh2,
                  notes: '',
                  items: [
                    {
                      ingredientId: ingredients[0]?.id || '',
                      requestedQuantity: 5,
                      unitSymbol: ingredients[0]?.primaryUnit?.symbol || 'kg',
                      notes: '',
                    },
                  ],
                });
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition shadow-sm"
            >
              <Plus size={15} />
              Tạo Lệnh Điều Chuyển
            </button>
          </div>
        }
      />

      {/* TABLE */}
      <AdminCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                <th className="py-3 px-4">Mã Lệnh</th>
                <th className="py-3 px-4">Kho Xuất (Nguồn)</th>
                <th className="py-3 px-4 text-center">Hướng</th>
                <th className="py-3 px-4">Kho Nhận (Đích)</th>
                <th className="py-3 px-4">Chi Tiết Mặt Hàng</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{t.transferCode || t.id.slice(0, 8)}</td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-800">{t.fromWarehouse?.name}</p>
                    <p className="text-[10px] text-slate-500">{t.fromBranch?.name}</p>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-400">
                    <ArrowRight size={16} className="inline text-slate-400" />
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-800">{t.toWarehouse?.name}</p>
                    <p className="text-[10px] text-slate-500">{t.toBranch?.name}</p>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      {t.items?.map((it: any) => (
                        <div key={it.id} className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{it.ingredient?.name}:</span>
                          <span className="font-mono text-emerald-700 font-bold">
                            {Number(it.requestedQuantity)} {it.unitSymbol}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {(t.status === 'DRAFT' || t.status === 'REQUESTED') && (
                        <button
                          onClick={() => handleApprove(t.id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                        >
                          Duyệt
                        </button>
                      )}
                      {t.status === 'APPROVED' && (
                        <button
                          onClick={() => handleDispatch(t)}
                          className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 flex items-center gap-1"
                        >
                          <Truck size={12} /> Xuất Kho
                        </button>
                      )}
                      {t.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => handleReceive(t)}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 flex items-center gap-1"
                        >
                          <CheckCircle2 size={12} /> Nhận Hàng
                        </button>
                      )}
                      {(t.status === 'COMPLETED' || t.status === 'RECEIVED') && (
                        <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle2 size={13} /> Hoàn tất
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Chưa có lệnh điều chuyển kho nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* MODAL TẠO LỆNH ĐIỀU CHUYỂN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-[#da251d]" /> Tạo Lệnh Điều Chuyển Kho
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Kho xuất (Nguồn) *</label>
                  <select
                    required
                    value={formData.fromWarehouseId}
                    onChange={(e) => {
                      const wh = warehouses.find((w) => w.id === e.target.value);
                      setFormData({
                        ...formData,
                        fromWarehouseId: e.target.value,
                        fromBranchId: wh?.branchId || formData.fromBranchId,
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
                  <label className="font-bold text-slate-700 block mb-1">Kho nhận (Đích) *</label>
                  <select
                    required
                    value={formData.toWarehouseId}
                    onChange={(e) => {
                      const wh = warehouses.find((w) => w.id === e.target.value);
                      setFormData({
                        ...formData,
                        toWarehouseId: e.target.value,
                        toBranchId: wh?.branchId || formData.toBranchId,
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
              </div>

              {/* ITEMS */}
              <div className="border rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase">Nguyên Liệu Cần Chuyển</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        items: [
                          ...formData.items,
                          {
                            ingredientId: ingredients[0]?.id || '',
                            requestedQuantity: 1,
                            unitSymbol: ingredients[0]?.primaryUnit?.symbol || 'kg',
                            notes: '',
                          },
                        ],
                      });
                    }}
                    className="text-xs font-bold text-[#da251d] hover:underline"
                  >
                    + Thêm nguyên liệu
                  </button>
                </div>

                {formData.items.map((it: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg">
                    <div className="col-span-6">
                      <select
                        value={it.ingredientId}
                        onChange={(e) => {
                          const ing = ingredients.find((i) => i.id === e.target.value);
                          const newItems = [...formData.items];
                          newItems[idx].ingredientId = e.target.value;
                          newItems[idx].unitSymbol = ing?.primaryUnit?.symbol || 'kg';
                          setFormData({ ...formData, items: newItems });
                        }}
                        className="w-full border rounded p-1.5"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-4 flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        value={it.requestedQuantity}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].requestedQuantity = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        className="w-full border rounded p-1.5 font-mono"
                      />
                      <span className="font-bold text-slate-600 text-[11px]">{it.unitSymbol}</span>
                    </div>

                    <div className="col-span-2 text-right">
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              items: formData.items.filter((_: any, i: number) => i !== idx),
                            });
                          }}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lý do / Ghi chú</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Điều chuyển bổ sung nguyên liệu thiếu hụt cho ca tối..."
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#da251d] text-white font-bold rounded-lg hover:bg-red-700 shadow-sm"
                >
                  Gửi Yêu Cầu Điều Chuyển
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
