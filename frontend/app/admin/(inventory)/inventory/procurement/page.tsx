'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import {
  Truck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  FileText,
  DollarSign,
  Calendar,
  X,
  PackageCheck,
  ChevronRight,
} from 'lucide-react';
import { PageHeader, AdminCard, StatusBadge } from '@/app/admin/components/ui';

export default function ProcurementPage() {
  const { selectedBranchId } = useAdmin();
  const [activeTab, setActiveTab] = useState<'grn' | 'po' | 'pr' | 'suppliers'>('grn');
  const [loading, setLoading] = useState(true);

  // Data states
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);

  // Modals
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isPrModalOpen, setIsPrModalOpen] = useState(false);

  // Forms
  const [grnForm, setGrnForm] = useState<any>({
    purchaseOrderId: '',
    supplierInvoiceNumber: '',
    deliveryNoteNumber: '',
    warehouseId: '',
    branchId: '',
    notes: '',
    items: [
      {
        ingredientId: '',
        receivedQuantity: 10,
        unitSymbol: 'kg',
        unitCost: 50000,
        batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
        expirationDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      },
    ],
  });

  const [supplierForm, setSupplierForm] = useState({
    code: `SUP-${Date.now().toString().slice(-4)}`,
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxCode: '',
  });

  const formatMoney = (val = 0) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const bParam = selectedBranchId && selectedBranchId !== 'ALL' ? `?branchId=${selectedBranchId}` : '';
      const [grnRes, poRes, prRes, supRes, whRes, ingRes] = await Promise.all([
        fetch(`/api/admin/inventory/goods-receipts${bParam}`, { credentials: 'include' }),
        fetch(`/api/admin/inventory/purchase-orders${bParam}`, { credentials: 'include' }),
        fetch(`/api/admin/inventory/purchase-requests${bParam}`, { credentials: 'include' }),
        fetch('/api/admin/inventory/suppliers', { credentials: 'include' }),
        fetch(`/api/admin/inventory/warehouses${bParam}`, { credentials: 'include' }),
        fetch('/api/admin/inventory/ingredients', { credentials: 'include' }),
      ]);

      const [grnJson, poJson, prJson, supJson, whJson, ingJson] = await Promise.all([
        grnRes.json(),
        poRes.json(),
        prRes.json(),
        supRes.json(),
        whRes.json(),
        ingRes.json(),
      ]);

      if (grnJson.success) setGoodsReceipts(grnJson.data || []);
      if (poJson.success) setPurchaseOrders(poJson.data || []);
      if (prJson.success) setPurchaseRequests(prJson.data || []);
      if (supJson.success) setSuppliers(supJson.data || []);
      if (whJson.success) setWarehouses(whJson.data || []);
      if (ingJson.success) setIngredients(ingJson.data?.items || []);
    } catch (e) {
      console.error('Error fetching procurement data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Create GRN (Goods Receipt Note)
  const handleCreateGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedWh = warehouses.find((w) => w.id === grnForm.warehouseId);
      const branchId = selectedWh?.branchId || selectedBranchId;

      const res = await fetch('/api/admin/inventory/goods-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          purchaseOrderId: grnForm.purchaseOrderId || undefined,
          warehouseId: grnForm.warehouseId,
          branchId: branchId && branchId !== 'ALL' ? branchId : warehouses[0]?.branchId,
          supplierInvoiceNumber: grnForm.supplierInvoiceNumber || undefined,
          deliveryNoteNumber: grnForm.deliveryNoteNumber || undefined,
          notes: grnForm.notes || undefined,
          items: grnForm.items.map((it: any) => ({
            ingredientId: it.ingredientId,
            receivedQuantity: parseFloat(it.receivedQuantity) || 0,
            unitSymbol: it.unitSymbol || 'kg',
            unitCost: parseFloat(it.unitCost) || 0,
            batchNumber: it.batchNumber || undefined,
            expirationDate: it.expirationDate || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsGrnModalOpen(false);
        alert('Đã lập phiếu nhập kho & cập nhật tồn kho FEFO thành công!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi lập phiếu nhập kho');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Create Supplier
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(supplierForm),
      });
      const json = await res.json();
      if (json.success) {
        setIsSupplierModalOpen(false);
        alert('Đã thêm nhà cung cấp mới thành công!');
        fetchData();
      } else {
        alert(json.message || 'Lỗi thêm nhà cung cấp');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Quản Lý Mua Hàng & Chuỗi Cung Ứng (Procurement)"
        subtitle="Quản lý nhà cung cấp, đề xuất mua hàng (PR), đơn đặt hàng (PO) và phiếu nhập kho (GRN)"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              title="Làm mới"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            {activeTab === 'grn' && (
              <button
                onClick={() => {
                  const firstIng = ingredients[0];
                  setGrnForm({
                    purchaseOrderId: '',
                    supplierInvoiceNumber: '',
                    deliveryNoteNumber: '',
                    warehouseId: warehouses[0]?.id || '',
                    branchId: warehouses[0]?.branchId || '',
                    notes: '',
                    items: [
                      {
                        ingredientId: firstIng?.id || '',
                        receivedQuantity: 10,
                        unitSymbol: firstIng?.purchaseUnit?.symbol || firstIng?.primaryUnit?.symbol || 'kg',
                        unitCost: Number(firstIng?.averagePurchaseCost) || 50000,
                        batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
                        expirationDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                      },
                    ],
                  });
                  setIsGrnModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition shadow-sm"
              >
                <Plus size={15} />
                Lập Phiếu Nhập Kho (GRN)
              </button>
            )}
            {activeTab === 'suppliers' && (
              <button
                onClick={() => {
                  setSupplierForm({
                    code: `SUP-${Date.now().toString().slice(-4)}`,
                    name: '',
                    contactPerson: '',
                    phone: '',
                    email: '',
                    address: '',
                    taxCode: '',
                  });
                  setIsSupplierModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition shadow-sm"
              >
                <Plus size={15} />
                Thêm Nhà Cung Cấp
              </button>
            )}
          </div>
        }
      />

      {/* TABS */}
      <div className="flex items-center border-b border-slate-200 gap-1 bg-white px-4 rounded-xl shadow-xs">
        {[
          { key: 'grn', label: 'Phiếu Nhập Kho (GRN)', count: goodsReceipts.length, icon: PackageCheck },
          { key: 'po', label: 'Đơn Đặt Hàng (PO)', count: purchaseOrders.length, icon: FileText },
          { key: 'pr', label: 'Yêu Cầu Mua Hàng (PR)', count: purchaseRequests.length, icon: Clock },
          { key: 'suppliers', label: 'Nhà Cung Cấp', count: suppliers.length, icon: Building2 },
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
            <tab.icon size={15} />
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

      {/* TAB CONTENT: GOODS RECEIPTS (GRN) */}
      {activeTab === 'grn' && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                  <th className="py-3 px-4">Số Phiếu GRN</th>
                  <th className="py-3 px-4">Nhà Cung Cấp</th>
                  <th className="py-3 px-4">Kho Nhập</th>
                  <th className="py-3 px-4">Chi Nhánh</th>
                  <th className="py-3 px-4">Số Mặt Hàng</th>
                  <th className="py-3 px-4 text-right">Tổng Tiền</th>
                  <th className="py-3 px-4">Ngày Nhập</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {goodsReceipts.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{grn.receiptCode}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {grn.purchaseOrder?.supplier?.name || 'Nhập trực tiếp'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{grn.warehouse?.name}</td>
                    <td className="py-3 px-4 text-slate-600">{grn.branch?.name}</td>
                    <td className="py-3 px-4 font-mono">{grn.items?.length || 0} mục</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700">
                      {formatMoney(Number(grn.totalAmount))}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(grn.confirmedAt || grn.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {grn.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {goodsReceipts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Chưa có phiếu nhập kho nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* TAB CONTENT: PURCHASE ORDERS */}
      {activeTab === 'po' && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                  <th className="py-3 px-4">Mã Đơn PO</th>
                  <th className="py-3 px-4">Nhà Cung Cấp</th>
                  <th className="py-3 px-4">Chi Nhánh</th>
                  <th className="py-3 px-4">Số Mặt Hàng</th>
                  <th className="py-3 px-4 text-right">Tổng Tiền</th>
                  <th className="py-3 px-4">Ngày Tạo</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{po.orderCode}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{po.supplier?.name}</td>
                    <td className="py-3 px-4 text-slate-600">{po.branch?.name}</td>
                    <td className="py-3 px-4 font-mono">{po.items?.length || 0} mục</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {formatMoney(Number(po.totalAmount))}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(po.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {purchaseOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Chưa có đơn đặt hàng nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* TAB CONTENT: PURCHASE REQUESTS */}
      {activeTab === 'pr' && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                  <th className="py-3 px-4">Mã Đề Xuất (PR)</th>
                  <th className="py-3 px-4">Chi Nhánh</th>
                  <th className="py-3 px-4">Lý Do Đề Xuất</th>
                  <th className="py-3 px-4">Số Mặt Hàng</th>
                  <th className="py-3 px-4">Ngày Yêu Cầu</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {purchaseRequests.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{pr.requestCode}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{pr.branch?.name}</td>
                    <td className="py-3 px-4 text-slate-600">{pr.reason || 'Bổ sung kho định kỳ'}</td>
                    <td className="py-3 px-4 font-mono">{pr.items?.length || 0} mục</td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(pr.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {pr.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {purchaseRequests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Chưa có yêu cầu mua hàng nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* TAB CONTENT: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                  <th className="py-3 px-4">Mã NCC</th>
                  <th className="py-3 px-4">Tên Nhà Cung Cấp</th>
                  <th className="py-3 px-4">Người Liên Hệ</th>
                  <th className="py-3 px-4">Số Điện Thoại</th>
                  <th className="py-3 px-4">Mã Số Thuế</th>
                  <th className="py-3 px-4">Địa Chỉ</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.code}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3 px-4 text-slate-700">{s.contactPerson || '---'}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{s.phone || '---'}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{s.taxCode || '---'}</td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{s.address || '---'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {s.status === 'ACTIVE' ? 'ĐANG HỢP TÁC' : s.status || 'TẠM NGƯNG'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* MODAL LẬP PHIẾU NHẬP KHO (GRN) */}
      {isGrnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Truck size={18} className="text-[#da251d]" /> Lập Phiếu Nhập Kho (Goods Receipt Note)
              </h3>
              <button onClick={() => setIsGrnModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGrn} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số phiếu giao nhận / Delivery Note</label>
                  <input
                    type="text"
                    value={grnForm.deliveryNoteNumber}
                    onChange={(e) => setGrnForm({ ...grnForm, deliveryNoteNumber: e.target.value })}
                    placeholder="DN-20261110"
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số hóa đơn VAT kèm theo</label>
                  <input
                    type="text"
                    value={grnForm.supplierInvoiceNumber}
                    onChange={(e) => setGrnForm({ ...grnForm, supplierInvoiceNumber: e.target.value })}
                    placeholder="HD-12345"
                    className="w-full border rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Đơn đặt hàng (PO) liên kết (nếu có)</label>
                  <select
                    value={grnForm.purchaseOrderId}
                    onChange={(e) => setGrnForm({ ...grnForm, purchaseOrderId: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  >
                    <option value="">-- Nhập trực tiếp (Không qua PO) --</option>
                    {purchaseOrders
                      .filter((po) => po.status !== 'CANCELLED' && po.status !== 'RECEIVED')
                      .map((po) => (
                        <option key={po.id} value={po.id}>
                          {po.orderCode} - {po.supplier?.name} ({po.status})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Kho nhập hàng *</label>
                  <select
                    required
                    value={grnForm.warehouseId}
                    onChange={(e) => setGrnForm({ ...grnForm, warehouseId: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  >
                    <option value="">-- Chọn kho nhập --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.branch?.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* GRN ITEMS */}
              <div className="border rounded-xl p-3 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase">Danh Sách Mặt Hàng Nhập Kho</h4>
                  <button
                    type="button"
                    onClick={() => {
                      const firstIng = ingredients[0];
                      setGrnForm({
                        ...grnForm,
                        items: [
                          ...grnForm.items,
                          {
                            ingredientId: firstIng?.id || '',
                            receivedQuantity: 1,
                            unitSymbol: firstIng?.purchaseUnit?.symbol || firstIng?.primaryUnit?.symbol || 'kg',
                            unitCost: Number(firstIng?.averagePurchaseCost) || 10000,
                            batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
                            expirationDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                          },
                        ],
                      });
                    }}
                    className="text-xs font-bold text-[#da251d] hover:underline"
                  >
                    + Thêm dòng
                  </button>
                </div>

                {grnForm.items.map((it: any, idx: number) => {
                  const selectedIng = ingredients.find((ing) => ing.id === it.ingredientId);
                  const unitOptions = Array.from(
                    new Set(
                      [
                        selectedIng?.purchaseUnit?.symbol,
                        selectedIng?.primaryUnit?.symbol,
                        it.unitSymbol,
                      ].filter(Boolean),
                    ),
                  );
                  return (
                  <div key={idx} className="p-3 bg-white rounded-lg border space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block">Nguyên Liệu</label>
                        <select
                          value={it.ingredientId}
                          onChange={(e) => {
                            const ing = ingredients.find((x) => x.id === e.target.value);
                            const newItems = [...grnForm.items];
                            newItems[idx].ingredientId = e.target.value;
                            if (ing) {
                              newItems[idx].unitSymbol = ing.purchaseUnit?.symbol || ing.primaryUnit?.symbol || 'kg';
                              newItems[idx].unitCost = Number(ing.averagePurchaseCost) || 0;
                            }
                            setGrnForm({ ...grnForm, items: newItems });
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

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Số Lượng Nhập</label>
                          <input
                            type="number"
                            step="any"
                            value={it.receivedQuantity}
                            onChange={(e) => {
                              const newItems = [...grnForm.items];
                              newItems[idx].receivedQuantity = e.target.value;
                              setGrnForm({ ...grnForm, items: newItems });
                            }}
                            className="w-full border rounded p-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Đơn Vị</label>
                          <select
                            value={it.unitSymbol}
                            onChange={(e) => {
                              const newItems = [...grnForm.items];
                              newItems[idx].unitSymbol = e.target.value;
                              setGrnForm({ ...grnForm, items: newItems });
                            }}
                            className="w-full border rounded p-1.5 font-bold"
                          >
                            {unitOptions.map((u) => (
                              <option key={u as string} value={u as string}>
                                {u as string}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Đơn Giá Nhập</label>
                          <input
                            type="number"
                            value={it.unitCost}
                            onChange={(e) => {
                              const newItems = [...grnForm.items];
                              newItems[idx].unitCost = e.target.value;
                              setGrnForm({ ...grnForm, items: newItems });
                            }}
                            className="w-full border rounded p-1.5"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block">Số Lô Hàng (Batch No)</label>
                        <input
                          type="text"
                          value={it.batchNumber}
                          onChange={(e) => {
                            const newItems = [...grnForm.items];
                            newItems[idx].batchNumber = e.target.value;
                            setGrnForm({ ...grnForm, items: newItems });
                          }}
                          className="w-full border rounded p-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block">Hạn Sử Dụng (FEFO)</label>
                        <input
                          type="date"
                          value={it.expirationDate}
                          onChange={(e) => {
                            const newItems = [...grnForm.items];
                            newItems[idx].expirationDate = e.target.value;
                            setGrnForm({ ...grnForm, items: newItems });
                          }}
                          className="w-full border rounded p-1.5"
                        />
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi chú nhập kho</label>
                <textarea
                  rows={2}
                  value={grnForm.notes}
                  onChange={(e) => setGrnForm({ ...grnForm, notes: e.target.value })}
                  placeholder="Ghi chú về biên bản giao nhận, chất lượng nguyên liệu..."
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsGrnModalOpen(false)}
                  className="px-4 py-2 border rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#da251d] text-white font-bold rounded-lg hover:bg-red-700 shadow-sm"
                >
                  Xác Nhận Nhập Kho & Ghi Sổ Cái
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM NHÀ CUNG CẤP */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Building2 size={18} className="text-[#da251d]" /> Thêm Nhà Cung Cấp Mới
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mã NCC *</label>
                  <input
                    type="text"
                    required
                    value={supplierForm.code}
                    onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mã số thuế</label>
                  <input
                    type="text"
                    value={supplierForm.taxCode}
                    onChange={(e) => setSupplierForm({ ...supplierForm, taxCode: e.target.value })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên nhà cung cấp *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="Công ty CP Thủy hải sản Sạch..."
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Người đại diện</label>
                  <input
                    type="text"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 border rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#da251d] text-white font-bold rounded-lg hover:bg-red-700 shadow-sm"
                >
                  Lưu Nhà Cung Cấp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
