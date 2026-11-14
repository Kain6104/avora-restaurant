'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ArrowRightLeft,
  X,
  CheckCircle2,
  DollarSign,
  Scale,
} from 'lucide-react';
import { PageHeader, AdminCard, StatusBadge } from '@/app/admin/components/ui';

export default function IngredientsCatalogPage() {
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [selectedIngForConversion, setSelectedIngForConversion] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState<any>({
    code: '',
    name: '',
    categoryId: '',
    primaryUnitId: '',
    purchaseUnitId: '',
    purchaseToPrimaryFactor: 1000,
    averagePurchaseCost: 0,
    costPerPrimaryUnit: 0,
    minimumStock: 0,
    reorderThreshold: 0,
    storageCondition: 'AMBIENT',
  });

  const [conversionData, setConversionData] = useState<any>({
    fromUnitId: '',
    toUnitId: '',
    conversionFactor: 1,
    notes: '',
  });

  const formatMoney = (val = 0) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (selectedCategory !== 'ALL') p.set('categoryId', selectedCategory);

      const [ingRes, catRes, unitRes] = await Promise.all([
        fetch(`/api/admin/inventory/ingredients?${p.toString()}`, { credentials: 'include' }),
        fetch('/api/admin/inventory/categories', { credentials: 'include' }),
        fetch('/api/admin/inventory/units', { credentials: 'include' }),
      ]);

      const ingJson = await ingRes.json();
      const catJson = await catRes.json();
      const unitJson = await unitRes.json();

      if (ingJson.success) setIngredients(ingJson.data.items || []);
      if (catJson.success) setCategories(catJson.data || []);
      if (unitJson.success) setUnits(unitJson.data || []);
    } catch (e) {
      console.error('Error loading ingredients:', e);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(json.message || 'Lỗi khi tạo nguyên liệu');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/unit-conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ingredientId: selectedIngForConversion?.id,
          ...conversionData,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsConversionModalOpen(false);
        alert('Đã thiết lập quy đổi đơn vị thành công!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi quy đổi đơn vị');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Danh Mục Nguyên Vật Liệu (Master Ingredients)"
        subtitle="Quản lý toàn bộ danh mục nguyên vật liệu F&B, đơn vị đo lường, quy đổi và giá vốn cơ sở"
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
                setFormData({
                  code: `ING-${Date.now().toString().slice(-4)}`,
                  name: '',
                  categoryId: categories[0]?.id || '',
                  primaryUnitId: units.find((u) => u.symbol === 'g')?.id || units[0]?.id || '',
                  purchaseUnitId: units.find((u) => u.symbol === 'kg')?.id || units[0]?.id || '',
                  purchaseToPrimaryFactor: 1000,
                  averagePurchaseCost: 0,
                  costPerPrimaryUnit: 0,
                  minimumStock: 0,
                  reorderThreshold: 0,
                  storageCondition: 'AMBIENT',
                });
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition shadow-sm"
            >
              <Plus size={15} />
              Thêm Nguyên Liệu
            </button>
          </div>
        }
      />

      {/* FILTERS */}
      <AdminCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã hoặc tên nguyên liệu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#da251d]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#da251d]"
            >
              <option value="ALL">Tất cả danh mục ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c._count?.ingredients || 0})
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminCard>

      {/* TABLE */}
      <AdminCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                <th className="py-3 px-4">Mã</th>
                <th className="py-3 px-4">Tên Nguyên Liệu</th>
                <th className="py-3 px-4">Nhóm</th>
                <th className="py-3 px-4">Đơn Vị Chuẩn</th>
                <th className="py-3 px-4">Đơn Vị Mua</th>
                <th className="py-3 px-4 text-right">Quy Đổi</th>
                <th className="py-3 px-4 text-right">Giá Mua BQ</th>
                <th className="py-3 px-4 text-right">Giá Vốn Cơ Sở</th>
                <th className="py-3 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {ingredients.map((ing) => (
                <tr key={ing.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-700">{ing.code}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {ing.name}
                    {ing.storageCondition && ing.storageCondition !== 'AMBIENT' && (
                      <span className="ml-2 px-1.5 py-0.2 bg-blue-50 text-blue-700 text-[9px] font-extrabold rounded">
                        {ing.storageCondition}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{
                        backgroundColor: `${ing.category?.color || '#da251d'}15`,
                        color: ing.category?.color || '#da251d',
                      }}
                    >
                      {ing.category?.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {ing.primaryUnit?.symbol} ({ing.primaryUnit?.name})
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {ing.purchaseUnit?.symbol || ing.primaryUnit?.symbol}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    1 {ing.purchaseUnit?.symbol || ing.primaryUnit?.symbol} = {Number(ing.purchaseToPrimaryFactor || 1).toLocaleString()} {ing.primaryUnit?.symbol}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-slate-700">
                    {formatMoney(Number(ing.averagePurchaseCost))}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-emerald-700">
                    {formatMoney(Number(ing.costPerPrimaryUnit))}/{ing.primaryUnit?.symbol}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => {
                        setSelectedIngForConversion(ing);
                        setConversionData({
                          fromUnitId: ing.purchaseUnitId || ing.primaryUnitId,
                          toUnitId: ing.primaryUnitId,
                          conversionFactor: ing.purchaseToPrimaryFactor || 1,
                          notes: '',
                        });
                        setIsConversionModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition"
                      title="Quy đổi đơn vị"
                    >
                      <Scale size={12} /> Quy đổi
                    </button>
                  </td>
                </tr>
              ))}
              {ingredients.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Chưa có nguyên liệu nào phù hợp với bộ lọc
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* MODAL THÊM NGUYÊN LIỆU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Package size={18} className="text-[#da251d]" /> Thêm Nguyên Liệu Mới
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateIngredient} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mã nguyên liệu *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full border rounded-lg p-2 focus:border-[#da251d] font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tên nguyên liệu *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded-lg p-2 focus:border-[#da251d]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nhóm nguyên liệu *</label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:border-[#da251d]"
                >
                  <option value="">-- Chọn danh mục --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Đơn vị cơ sở (Công thức) *</label>
                  <select
                    required
                    value={formData.primaryUnitId}
                    onChange={(e) => setFormData({ ...formData, primaryUnitId: e.target.value })}
                    className="w-full border rounded-lg p-2 focus:border-[#da251d]"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.symbol} ({u.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Đơn vị mua hàng</label>
                  <select
                    value={formData.purchaseUnitId}
                    onChange={(e) => setFormData({ ...formData, purchaseUnitId: e.target.value })}
                    className="w-full border rounded-lg p-2 focus:border-[#da251d]"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.symbol} ({u.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tỷ lệ quy đổi (1 ĐV Mua = X ĐV Cơ sở)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.purchaseToPrimaryFactor}
                    onChange={(e) => {
                      const f = parseFloat(e.target.value) || 1;
                      const avg = formData.averagePurchaseCost || 0;
                      setFormData({
                        ...formData,
                        purchaseToPrimaryFactor: f,
                        costPerPrimaryUnit: f > 0 ? avg / f : 0,
                      });
                    }}
                    className="w-full border rounded-lg p-2 focus:border-[#da251d]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá mua dự kiến (VND / ĐV Mua)</label>
                  <input
                    type="number"
                    value={formData.averagePurchaseCost}
                    onChange={(e) => {
                      const avg = parseFloat(e.target.value) || 0;
                      const f = formData.purchaseToPrimaryFactor || 1;
                      setFormData({
                        ...formData,
                        averagePurchaseCost: avg,
                        costPerPrimaryUnit: f > 0 ? avg / f : 0,
                      });
                    }}
                    className="w-full border rounded-lg p-2 focus:border-[#da251d]"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-between">
                <span className="font-bold text-emerald-800">Giá vốn công thức tính toán:</span>
                <span className="font-black text-emerald-700 text-sm">{formatMoney(formData.costPerPrimaryUnit)}</span>
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
                  Lưu Nguyên Liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUY ĐỔI ĐƠN VỊ */}
      {isConversionModalOpen && selectedIngForConversion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Scale size={18} className="text-indigo-600" /> Quy Đổi Đơn Vị ({selectedIngForConversion.name})
              </h3>
              <button onClick={() => setIsConversionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateConversion} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Đơn vị gốc (From Unit)</label>
                <select
                  required
                  value={conversionData.fromUnitId}
                  onChange={(e) => setConversionData({ ...conversionData, fromUnitId: e.target.value })}
                  className="w-full border rounded-lg p-2"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.symbol} ({u.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Đơn vị đích (To Unit)</label>
                <select
                  required
                  value={conversionData.toUnitId}
                  onChange={(e) => setConversionData({ ...conversionData, toUnitId: e.target.value })}
                  className="w-full border rounded-lg p-2"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.symbol} ({u.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Hệ số quy đổi (1 ĐV Gốc = X ĐV Đích)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={conversionData.conversionFactor}
                  onChange={(e) => setConversionData({ ...conversionData, conversionFactor: parseFloat(e.target.value) || 1 })}
                  className="w-full border rounded-lg p-2 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsConversionModalOpen(false)}
                  className="px-4 py-2 border rounded-lg font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                >
                  Xác Nhận Quy Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
