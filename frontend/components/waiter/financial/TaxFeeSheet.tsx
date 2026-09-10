'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Info, 
  FileText, 
  Receipt,
  Check, 
  Building2, 
  Search, 
  Sparkles, 
  Plus, 
  Trash2, 
  Loader2 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TaxFeeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSuccess?: () => void;
}

export default function TaxFeeSheet({ isOpen, onClose, order, onSuccess }: TaxFeeSheetProps) {
  const [isInvoiceRequested, setIsInvoiceRequested] = useState<boolean>(Boolean(order?.isInvoiceRequested));
  const [taxCode, setTaxCode] = useState<string>(order?.invoiceTaxCode || '');
  const [companyName, setCompanyName] = useState<string>(order?.invoiceCompanyName || '');
  const [taxAddress, setTaxAddress] = useState<string>(order?.invoiceAddress || '');
  const [invoiceEmail, setInvoiceEmail] = useState<string>(order?.invoiceEmail || '');
  const [isLookingUpTax, setIsLookingUpTax] = useState<boolean>(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState<boolean>(false);

  // Service Charges State
  const [serviceCharges, setServiceCharges] = useState<any[]>(order?.serviceCharges || []);
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState<number | ''>('');
  const [newChargeNote, setNewChargeNote] = useState('');
  const [newChargeTaxable, setNewChargeTaxable] = useState(false);
  const [isAddingCharge, setIsAddingCharge] = useState(false);
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null);

  // VAT Detail View Toggle
  const [showVatDetail, setShowVatDetail] = useState(false);

  // Sync service charges & invoice state on mount & order change
  useEffect(() => {
    if (order) {
      setIsInvoiceRequested(Boolean(order.isInvoiceRequested));
      setTaxCode(order.invoiceTaxCode || '');
      setCompanyName(order.invoiceCompanyName || '');
      setTaxAddress(order.invoiceAddress || '');
      setInvoiceEmail(order.invoiceEmail || '');
    }
    if (order?.serviceCharges && Array.isArray(order.serviceCharges)) {
      setServiceCharges(order.serviceCharges);
    }
    if (order?.id) {
      fetch(`/api/pos/orders/${order.id}/service-charges`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setServiceCharges(json.data);
          }
        })
        .catch(() => {});
    }
  }, [
    order?.id,
    order?.isInvoiceRequested,
    order?.invoiceTaxCode,
    order?.invoiceCompanyName,
    order?.invoiceAddress,
    order?.invoiceEmail,
  ]);

  // Chi tiết thuế GTGT phân rã từng món như POS
  const taxBreakdown = React.useMemo(() => {
    if (!order?.orderItems || !Array.isArray(order.orderItems)) return [];
    const isVatIncluded = order.vatPriceModeSnapshot === 'VAT_INCLUDED';
    const map = new Map<number, { rate: number; taxableAmount: number; taxAmount: number; items: any[] }>();

    order.orderItems.forEach((it: any) => {
      const rate = Number(
        ((it.taxPercentageAtSale && it.taxPercentageAtSale > 0)
          ? it.taxPercentageAtSale
          : (it.product?.taxPercentage !== undefined && it.product.taxPercentage !== null)
            ? it.product.taxPercentage
            : (it.taxRate || 0))
      );
      const itemNet = Math.max(0, (it.priceAtSale - (it.discountAmount || 0)) * it.quantity);
      const taxable = (it.taxableAmountAtSale && it.taxableAmountAtSale > 0)
        ? it.taxableAmountAtSale
        : itemNet;
      const tax = (it.taxAmountAtSale && it.taxAmountAtSale > 0)
        ? it.taxAmountAtSale
        : (
          rate > 0
            ? (isVatIncluded
                ? Math.round((taxable * rate) / (100 + rate))
                : Math.round((taxable * rate) / 100))
            : 0
        );
      if (!map.has(rate)) {
        map.set(rate, { rate, taxableAmount: 0, taxAmount: 0, items: [] });
      }
      const g = map.get(rate)!;
      g.taxableAmount += taxable;
      g.taxAmount += tax;
      g.items.push({
        name: it.product?.name || it.productName || 'Món',
        quantity: it.quantity,
        priceAtSale: it.priceAtSale,
        taxableAmount: taxable,
        taxAmount: tax,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.rate - b.rate);
  }, [order?.orderItems, order?.vatPriceModeSnapshot]);

  if (!isOpen || !order) return null;

  const subtotal = order.subTotal || 0;
  const vatTotal = order.taxAmount || 0;
  const currentServiceChargeTotal = serviceCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
  const discountAmount = order.discountAmount || 0;
  const totalAmount = order.totalAmount || (subtotal + vatTotal + currentServiceChargeTotal - discountAmount);

  // Add Service Charge
  const handleAddServiceCharge = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChargeName.trim()) {
      toast.error('Vui lòng nhập tên khoản phụ thu');
      return;
    }
    const amt = Number(newChargeAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Vui lòng nhập số tiền phụ thu hợp lệ (> 0)');
      return;
    }

    setIsAddingCharge(true);
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/service-charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChargeName.trim(),
          amount: amt,
          note: newChargeNote.trim() || undefined,
          isTaxable: newChargeTaxable,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Không thể thêm phụ thu');
      }

      toast.success(`Đã thêm: ${newChargeName} (+${amt.toLocaleString('vi-VN')}đ)`);
      if (json.data?.charge) {
        setServiceCharges(prev => [...prev, json.data.charge]);
      }
      setNewChargeName('');
      setNewChargeAmount('');
      setNewChargeNote('');
      setNewChargeTaxable(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi thêm phụ thu');
    } finally {
      setIsAddingCharge(false);
    }
  };

  // Quick Preset Add
  const handleQuickAddPreset = (name: string, amount: number) => {
    setNewChargeName(name);
    setNewChargeAmount(amount);
  };

  // Remove Service Charge
  const handleRemoveServiceCharge = async (chargeId: string) => {
    if (!confirm('Bạn có chắc muốn xóa khoản phụ thu này khỏi đơn?')) return;
    setDeletingChargeId(chargeId);
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/service-charges/${chargeId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Không thể xóa phụ thu');
      }
      toast.success('Đã xóa khoản phụ thu');
      setServiceCharges(prev => prev.filter(c => c.id !== chargeId));
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa phụ thu');
    } finally {
      setDeletingChargeId(null);
    }
  };

  // Quick Tax Lookup
  const handleLookupTax = async () => {
    const cleanMst = taxCode.trim();
    if (!cleanMst || cleanMst.length < 4) {
      toast.error('Vui lòng nhập mã số thuế hợp lệ');
      return;
    }

    setIsLookingUpTax(true);
    try {
      const res = await fetch(`/api/pos/tax-lookup/${encodeURIComponent(cleanMst)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCompanyName(json.data.companyName || '');
        setTaxAddress(json.data.address || '');
        setIsInvoiceRequested(true);
        toast.success('Đã tìm thấy thông tin doanh nghiệp!');
      } else {
        toast.error(json.message || 'Không tìm thấy thông tin mã số thuế');
      }
    } catch {
      toast.error('Lỗi khi tra cứu mã số thuế');
    } finally {
      setIsLookingUpTax(false);
    }
  };

  const handleSaveInvoice = async () => {
    setIsSavingInvoice(true);
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/invoice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isInvoiceRequested,
          invoiceTaxCode: isInvoiceRequested ? taxCode.trim() : null,
          invoiceCompanyName: isInvoiceRequested ? companyName.trim() : null,
          invoiceAddress: isInvoiceRequested ? taxAddress.trim() : null,
          invoiceEmail: isInvoiceRequested ? invoiceEmail.trim() : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu thông tin hóa đơn VAT!');
        onSuccess?.();
        onClose();
      } else {
        toast.error(data.message || 'Không thể lưu thông tin hóa đơn');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsSavingInvoice(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />
      
      <div 
        className="relative w-full max-w-lg bg-slate-50 rounded-t-3xl shadow-2xl flex flex-col z-[105] max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 bg-white rounded-t-3xl border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-[#DA251D]" />
            <h2 className="font-bold text-base text-slate-800">Chi tiết Thuế VAT & Phí dịch vụ</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 bg-slate-100 rounded-full text-slate-500 active:bg-slate-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto pb-6">
          {/* Financial Breakdown Card */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">Tạm tính tiền món</span>
              <span className="font-bold text-slate-900">{subtotal.toLocaleString('vi-VN')} đ</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-sm text-amber-700">
                <span>Giảm giá / Ưu đãi {order.discountReason ? `(${order.discountReason})` : ''}</span>
                <span className="font-bold">-{discountAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            )}

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-1">
                Phí dịch vụ / Phụ thu
              </span>
              <span className="font-bold text-amber-700">+{currentServiceChargeTotal.toLocaleString('vi-VN')} đ</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span>Thuế GTGT (VAT)</span>
                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold">
                  {order.vatPriceModeSnapshot === 'VAT_INCLUDED' ? 'Đã gồm VAT' : 'Chưa gồm VAT'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowVatDetail(!showVatDetail)}
                  className="w-5 h-5 rounded-full bg-slate-100 hover:bg-red-50 hover:text-[#DA251D] text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                  title="Xem chi tiết thuế VAT"
                >
                  <Info size={12} />
                </button>
              </div>
              <span className="font-bold text-slate-900">{vatTotal.toLocaleString('vi-VN')} đ</span>
            </div>

            {/* Expanded VAT Details */}
            {showVatDetail && (
              <div className="p-3 bg-red-50/70 rounded-xl border border-red-200/80 text-xs text-slate-700 space-y-2.5 animate-in fade-in duration-150">
                <div className="font-bold text-[#DA251D] flex items-center justify-between pb-1.5 border-b border-red-200">
                  <span className="flex items-center gap-1">
                    <Receipt size={14} />
                    <span>Chi tiết thuế suất GTGT từng món</span>
                  </span>
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                    {order.vatPriceModeSnapshot === 'VAT_INCLUDED' ? 'Giá đã gồm VAT' : 'Tính thêm VAT'}
                  </span>
                </div>

                {taxBreakdown.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic py-1 text-center">
                    Không có sản phẩm nào chịu thuế trong đơn hàng này.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {taxBreakdown.map((group) => (
                      <div key={group.rate} className="bg-white rounded-lg p-2.5 border border-red-100 space-y-1.5 shadow-2xs">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            Thuế suất {group.rate}%
                          </span>
                          <span className="text-red-600 font-mono">
                            Thuế: {group.taxAmount.toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                        <div className="space-y-1 pt-0.5 divide-y divide-slate-100">
                          {group.items.map((it: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-start pt-1 text-[11px]">
                              <span className="text-slate-700 truncate pr-2">
                                {it.quantity}x {it.name}
                              </span>
                              <div className="text-right shrink-0">
                                <span className="text-slate-900 font-semibold font-mono block">
                                  {it.taxAmount.toLocaleString('vi-VN')} đ
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  Giá tính thuế: {it.taxableAmount.toLocaleString('vi-VN')} đ
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center pt-1 border-t border-red-200/80 font-bold text-[11px] text-[#DA251D]">
                  <span>Tổng thuế VAT đóng góp:</span>
                  <span className="text-xs font-mono">{vatTotal.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="font-black text-slate-900 text-base">Tổng thanh toán</span>
              <span className="font-black text-[#DA251D] text-lg font-mono">{totalAmount.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          {/* Service Charges / Surcharges Section (Like POS) */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Phí dịch vụ & Phụ thu:
              </span>
              <span className="text-xs font-black text-amber-700">
                +{(serviceCharges.reduce((s, c) => s + (c.amount || 0), 0)).toLocaleString('vi-VN')} đ
              </span>
            </div>

            {/* List of existing charges */}
            {serviceCharges.length > 0 ? (
              <div className="space-y-1.5">
                {serviceCharges.map((sc) => (
                  <div
                    key={sc.id}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900">{sc.name}</span>
                        {sc.isTaxable && (
                          <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                            Thuế VAT
                          </span>
                        )}
                      </div>
                      {sc.note && (
                        <p className="text-[10px] text-slate-500 truncate">{sc.note}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-xs text-amber-700">
                        +{(sc.amount || 0).toLocaleString('vi-VN')} đ
                      </span>
                      <button
                        type="button"
                        disabled={deletingChargeId === sc.id}
                        onClick={() => handleRemoveServiceCharge(sc.id)}
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="Xóa phụ thu"
                      >
                        {deletingChargeId === sc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                Chưa có khoản phụ thu nào được thêm vào đơn này.
              </div>
            )}

            {/* Quick Presets */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                Chọn nhanh phụ thu phổ biến:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickAddPreset('Giữ xe ô tô / xe máy', 10000)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-[#DA251D] rounded-lg text-xs font-medium text-slate-700 border border-slate-200 text-left transition-colors cursor-pointer"
                >
                  +10k Giữ xe
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddPreset('Phụ thu phòng VIP', 20000)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-[#DA251D] rounded-lg text-xs font-medium text-slate-700 border border-slate-200 text-left transition-colors cursor-pointer"
                >
                  +20k Phòng VIP
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddPreset('Phí phục vụ đặc biệt', 50000)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-[#DA251D] rounded-lg text-xs font-medium text-slate-700 border border-slate-200 text-left transition-colors cursor-pointer"
                >
                  +50k Phí phục vụ
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddPreset('Phụ thu đem rượu ngoài', 100000)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-[#DA251D] rounded-lg text-xs font-medium text-slate-700 border border-slate-200 text-left transition-colors cursor-pointer"
                >
                  +100k Đem rượu ngoài
                </button>
              </div>
            </div>

            {/* Add Custom Service Charge Form */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <input
                type="text"
                value={newChargeName}
                onChange={(e) => setNewChargeName(e.target.value)}
                placeholder="Tên khoản phụ thu..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#DA251D]"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newChargeAmount}
                  onChange={(e) => setNewChargeAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Số tiền phụ thu (đ)..."
                  className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#DA251D]"
                />
                <button
                  type="button"
                  disabled={isAddingCharge}
                  onClick={handleAddServiceCharge}
                  className="px-4 py-2.5 bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isAddingCharge ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>Thêm</span>
                </button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={newChargeTaxable}
                  onChange={(e) => setNewChargeTaxable(e.target.checked)}
                  className="w-4 h-4 accent-[#DA251D] rounded cursor-pointer"
                />
                <span className="text-xs text-slate-600 font-medium">Khoản phụ thu này chịu thuế GTGT (10%)</span>
              </label>
            </div>
          </div>

          {/* Business VAT Invoice Section */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-slate-600" />
                <span className="font-bold text-sm text-slate-800">Xuất hóa đơn VAT doanh nghiệp</span>
              </div>
              <input
                type="checkbox"
                checked={isInvoiceRequested}
                onChange={(e) => setIsInvoiceRequested(e.target.checked)}
                className="w-5 h-5 accent-[#DA251D] rounded cursor-pointer"
              />
            </div>

            {isInvoiceRequested && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    placeholder="Nhập mã số thuế (MST)..."
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-[#DA251D]"
                  />
                  <button
                    type="button"
                    disabled={isLookingUpTax}
                    onClick={handleLookupTax}
                    className="px-3 py-2.5 bg-red-50 text-[#DA251D] font-bold rounded-xl text-xs flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                  >
                    <Search size={14} />
                    {isLookingUpTax ? 'Tìm...' : 'Tra cứu'}
                  </button>
                </div>

                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Tên công ty / Đơn vị..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#DA251D]"
                />

                <input
                  type="text"
                  value={taxAddress}
                  onChange={(e) => setTaxAddress(e.target.value)}
                  placeholder="Địa chỉ trụ sở công ty..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#DA251D]"
                />

                <input
                  type="email"
                  value={invoiceEmail}
                  onChange={(e) => setInvoiceEmail(e.target.value)}
                  placeholder="Email nhận hóa đơn điện tử..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#DA251D]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={isSavingInvoice}
            onClick={handleSaveInvoice}
            className="px-5 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Check size={16} />
            {isSavingInvoice ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </div>
      </div>
    </div>
  );
}
