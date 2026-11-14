'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import {
  Warehouse,
  Search,
  RefreshCw,
  Plus,
  AlertTriangle,
  Building2,
  DollarSign,
  Package,
} from 'lucide-react';
import { PageHeader, AdminCard } from '@/app/admin/components/ui';

export default function WarehousesPage() {
  const { selectedBranchId } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWhId, setSelectedWhId] = useState<string>('');
  const [balances, setBalances] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const formatMoney = (val = 0) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const bParam = selectedBranchId && selectedBranchId !== 'ALL' ? `?branchId=${selectedBranchId}` : '';
      const res = await fetch(`/api/admin/inventory/warehouses${bParam}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setWarehouses(json.data);
        if (!selectedWhId || !json.data.some((w: any) => w.id === selectedWhId)) {
          setSelectedWhId(json.data[0].id);
        }
      } else if (json.success) {
        setWarehouses([]);
        setSelectedWhId('');
        setBalances([]);
      }
    } catch (e) {
      console.error('Error fetching warehouses:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, selectedWhId]);

  const fetchBalances = useCallback(async (whId: string) => {
    if (!whId) return;
    try {
      const res = await fetch(`/api/admin/inventory/warehouses/${whId}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setBalances(json.data.balances || []);
      }
    } catch (e) {
      console.error('Error fetching warehouse balances:', e);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  useEffect(() => {
    if (selectedWhId) {
      fetchBalances(selectedWhId);
    }
  }, [selectedWhId, fetchBalances]);

  const filteredBalances = balances.filter(
    (b) =>
      b.ingredient?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.ingredient?.code?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalWhValue = balances.reduce((sum, b) => sum + Number(b.valuation || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Quản Lý Kho Hàng & Tồn Kho (Multi-Warehouse)"
        subtitle="Theo dõi chi tiết số lượng tồn thực tế, số lượng giữ chỗ và giá trị tồn theo từng kho chi nhánh"
        actions={
          <button
            onClick={() => {
              fetchWarehouses();
              if (selectedWhId) fetchBalances(selectedWhId);
            }}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* WAREHOUSE TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {warehouses.map((wh) => {
          const isSelected = selectedWhId === wh.id;
          return (
            <button
              key={wh.id}
              onClick={() => setSelectedWhId(wh.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                isSelected
                  ? 'bg-[#da251d] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Warehouse size={15} />
              <span>{wh.name}</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded text-[10px] ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {wh._count?.balances || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* KPI & SEARCH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard className="p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Tổng Giá Trị Kho Hiện Tại</p>
            <h4 className="text-xl font-black text-slate-900 mt-0.5">{formatMoney(totalWhValue)}</h4>
          </div>
          <DollarSign size={20} className="text-emerald-500" />
        </AdminCard>

        <AdminCard className="p-4 flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Số Lượng Mặt Hàng</p>
            <h4 className="text-xl font-black text-slate-900 mt-0.5">{balances.length}</h4>
          </div>
          <Package size={20} className="text-blue-500" />
        </AdminCard>

        <AdminCard className="p-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm nguyên liệu trong kho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:border-[#da251d]"
            />
          </div>
        </AdminCard>
      </div>

      {/* BALANCES TABLE */}
      <AdminCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500">
                <th className="py-3 px-4">Mã</th>
                <th className="py-3 px-4">Tên Nguyên Liệu</th>
                <th className="py-3 px-4">Nhóm</th>
                <th className="py-3 px-4 text-right">Tồn Thực Tế</th>
                <th className="py-3 px-4 text-right">Đang Giữ Chỗ (POS/KDS)</th>
                <th className="py-3 px-4 text-right">Khả Dụng (Available)</th>
                <th className="py-3 px-4 text-right">Giá Vốn Cơ Sở</th>
                <th className="py-3 px-4 text-right">Giá Trị Tồn Kho</th>
                <th className="py-3 px-4 text-center">Tình Trạng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBalances.map((b) => {
                const curr = Number(b.currentStock);
                const reserved = Number(b.reservedStock);
                const avail = Number(b.availableStock);
                const min = Number(b.ingredient?.minimumStock || 0);
                const isOutOfStock = curr <= 0;
                const isLowStock = curr > 0 && curr <= min;

                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{b.ingredient?.code}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{b.ingredient?.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {b.ingredient?.category?.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {curr.toLocaleString()} {b.ingredient?.primaryUnit?.symbol}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-600">
                      {reserved > 0 ? `${reserved.toLocaleString()} ${b.ingredient?.primaryUnit?.symbol}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700">
                      {avail.toLocaleString()} {b.ingredient?.primaryUnit?.symbol}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {formatMoney(Number(b.ingredient?.costPerPrimaryUnit))}/{b.ingredient?.primaryUnit?.symbol}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {formatMoney(Number(b.valuation))}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isOutOfStock ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded text-[10px]">
                          HẾT HÀNG
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">
                          SẮP HẾT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                          AN TOÀN
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredBalances.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Kho hiện chưa có nguyên liệu nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}
