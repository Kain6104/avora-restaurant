"use client";

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  Search,
  Loader2,
  ShieldCheck,
  CreditCard,
  ChefHat,
  PackageCheck,
  AlertTriangle,
  Globe,
  Tag,
  Receipt,
  ArrowRight,
  Lock,
  Plus,
  Trash2,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PosOrder, PosServiceCharge } from './pos-types';

interface OrderDetailFeesModalProps {
  order: PosOrder | null;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: PosOrder) => void;
  onPayOrder?: (order: PosOrder) => void;
}

export const OrderDetailFeesModal: React.FC<OrderDetailFeesModalProps> = ({
  order,
  onClose,
  onOrderUpdated,
  onPayOrder,
}) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  if (!order) return null;

  const isOnline =
    order.orderSource === 'ONLINE' ||
    order.orderSource === 'WEB' ||
    order.orderSource === 'CHATBOT' ||
    order.orderSource === 'VOICE' ||
    (Boolean(order.orderSource) && order.orderSource !== 'POS' && !order.tableId);

  const isSepayPaid =
    order.paymentMethod === 'SEPAY' && order.paymentStatus === 'PAID';

  // VAT Invoice State
  const [taxCode, setTaxCode] = useState(order.invoiceTaxCode || '');
  const [companyName, setCompanyName] = useState(order.invoiceCompanyName || '');
  const [taxAddress, setTaxAddress] = useState(order.invoiceAddress || '');
  const [invoiceEmail, setInvoiceEmail] = useState(order.invoiceEmail || '');
  const [isInvoiceRequested, setIsInvoiceRequested] = useState(order.isInvoiceRequested || false);
  const [isLookingUpTax, setIsLookingUpTax] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  // Status Loading State (Online Orders only)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Service Charges State (POS Orders only)
  const [serviceCharges, setServiceCharges] = useState<PosServiceCharge[]>(order.serviceCharges || []);
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState<number | ''>('');
  const [newChargeNote, setNewChargeNote] = useState('');
  const [newChargeTaxable, setNewChargeTaxable] = useState(false);
  const [isAddingCharge, setIsAddingCharge] = useState(false);
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null);

  // Sync and fetch latest service charges and VAT invoice when order or modal opens
  React.useEffect(() => {
    if (order) {
      setTaxCode(order.invoiceTaxCode || '');
      setCompanyName(order.invoiceCompanyName || '');
      setTaxAddress(order.invoiceAddress || '');
      setInvoiceEmail(order.invoiceEmail || '');
      setIsInvoiceRequested(Boolean(order.isInvoiceRequested));
    }
    if (order?.serviceCharges && Array.isArray(order.serviceCharges)) {
      setServiceCharges(order.serviceCharges);
    }
    if (order?.id) {
      fetch(`${baseUrl}/api/pos/orders/${order.id}/service-charges`, { credentials: 'include' })
        .then((res) => res.json())
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
    baseUrl,
  ]);

  // Quick Tax Lookup via VietQR
  const handleLookupTax = async () => {
    const cleanMst = taxCode.trim();
    if (!cleanMst || cleanMst.length < 4) {
      toast.error('Vui lòng nhập mã số thuế hợp lệ');
      return;
    }

    setIsLookingUpTax(true);
    try {
      const res = await fetch(`${baseUrl}/api/pos/tax-lookup/${encodeURIComponent(cleanMst)}`, {
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
    } catch (err: any) {
      toast.error('Lỗi khi tra cứu mã số thuế');
    } finally {
      setIsLookingUpTax(false);
    }
  };

  // Update Status from POS (Only for Online Orders)
  const handleUpdateStatus = async (newStatus: string) => {
    if (order.status === newStatus) return;

    if (isSepayPaid && (newStatus === 'CANCELLED' || newStatus === 'PENDING')) {
      toast.error('Đơn hàng đã được SePay xác nhận tiền về tài khoản, không thể hủy hoặc hạ trạng thái!');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`${baseUrl}/api/pos/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Không thể cập nhật trạng thái');
      }

      toast.success(`Đã cập nhật trạng thái: ${newStatus}`, {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
      onOrderUpdated(json.data);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Add Service Charge (POS orders only)
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
      const res = await fetch(`${baseUrl}/api/pos/orders/${order.id}/service-charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

      toast.success(`Đã thêm phụ thu: ${newChargeName} (+${amt.toLocaleString('vi-VN')}đ)`);
      if (json.data?.charge) {
        setServiceCharges((prev) => [...prev, json.data.charge]);
      }
      if (json.data?.updatedOrder) {
        onOrderUpdated(json.data.updatedOrder);
      }
      setNewChargeName('');
      setNewChargeAmount('');
      setNewChargeNote('');
      setNewChargeTaxable(false);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi thêm phụ thu');
    } finally {
      setIsAddingCharge(false);
    }
  };

  // Quick Preset Add for POS Service Charge
  const handleQuickAddPreset = (name: string, amount: number) => {
    setNewChargeName(name);
    setNewChargeAmount(amount);
  };

  const [chargeToDelete, setChargeToDelete] = useState<{ id: string; name: string } | null>(null);

  // Remove Service Charge
  const executeRemoveServiceCharge = async (chargeId: string) => {
    setChargeToDelete(null);
    setDeletingChargeId(chargeId);
    try {
      const res = await fetch(`${baseUrl}/api/pos/orders/${order.id}/service-charges/${chargeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Không thể xóa phụ thu');
      }

      toast.success('Đã xóa khoản phụ thu thành công');
      setServiceCharges((prev) => prev.filter((c) => c.id !== chargeId));
      if (json.data) {
        onOrderUpdated(json.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa phụ thu');
    } finally {
      setDeletingChargeId(null);
    }
  };

  // Save VAT Invoice Info
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingInvoice(true);
    try {
      const payload = {
        isInvoiceRequested: Boolean(isInvoiceRequested),
        invoiceTaxCode: isInvoiceRequested ? taxCode.trim() : null,
        invoiceCompanyName: isInvoiceRequested ? companyName.trim() : null,
        invoiceAddress: isInvoiceRequested ? taxAddress.trim() : null,
        invoiceEmail: isInvoiceRequested ? invoiceEmail.trim() : null,
      };

      const res = await fetch(`${baseUrl}/api/pos/orders/${order.id}/invoice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Không thể lưu thông tin hóa đơn');
      }

      toast.success('Đã cập nhật thông tin xuất hóa đơn VAT thành công!', {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
      if (json.data) {
        onOrderUpdated(json.data);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu thông tin hóa đơn');
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'PENDING':
        return 'Chờ xác nhận';
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'PREPARING':
        return 'Đang chuẩn bị món';
      case 'DELIVERING':
        return 'Đang giao hàng';
      case 'COMPLETED':
        return 'Đã hoàn thành';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return st;
    }
  };

  const displayOrderCode = order.orderCode || order.temporaryOrderCode || 'TMP';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight">
                  {isOnline ? `Đơn hàng Online #${displayOrderCode}` : `Đơn POS #${displayOrderCode}`}
                </span>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-500 text-white">
                    <Globe className="w-2.5 h-2.5" />
                    Đơn Online Website
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                      {order.table?.name || 'Đơn tại quầy'}
                    </span>
                    {!order.orderCode && order.temporaryOrderCode && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                        Mã tạm (Chờ thanh toán)
                      </span>
                    )}
                    {order.orderCode && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white">
                        Hóa đơn chính thức
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                Khách: <strong>{order.customerName}</strong> {order.customerPhone ? `(${order.customerPhone})` : ''} • Tạo lúc: {new Date(order.createdAt).toLocaleTimeString('vi-VN')} {new Date(order.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">

          {/* ========================================================= */}
          {/* A. ĐƠN HÀNG ONLINE: TIẾN ĐỘ, PTTT THẬT, PHÍ SHIP READ-ONLY */}
          {/* ========================================================= */}
          {isOnline && (
            <>
              {/* 1. TRẠNG THÁI TIẾN ĐỘ ĐƠN HÀNG ONLINE */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-slate-500" />
                    Trạng thái tiến độ đơn hàng Online:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-900 text-white">
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isUpdatingStatus || order.status === 'CONFIRMED' || order.status === 'COMPLETED'}
                    onClick={() => handleUpdateStatus('CONFIRMED')}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      order.status === 'CONFIRMED'
                        ? 'bg-sky-600 text-white ring-2 ring-sky-300'
                        : 'bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Xác nhận đơn</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingStatus || order.status === 'PREPARING' || order.status === 'COMPLETED'}
                    onClick={() => handleUpdateStatus('PREPARING')}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      order.status === 'PREPARING'
                        ? 'bg-orange-600 text-white ring-2 ring-orange-300'
                        : 'bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 shadow-2xs'
                    }`}
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    <span>Đang chuẩn bị</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingStatus || order.status === 'DELIVERING' || order.status === 'COMPLETED'}
                    onClick={() => handleUpdateStatus('DELIVERING')}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      order.status === 'DELIVERING'
                        ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                        : 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Đang giao hàng</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingStatus || order.status === 'COMPLETED'}
                    onClick={() => handleUpdateStatus('COMPLETED')}
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      order.status === 'COMPLETED'
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                        : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã hoàn thành</span>
                  </button>
                </div>
              </div>

              {/* 2. THÔNG TIN PHƯƠNG THỨC & TRẠNG THÁI THANH TOÁN THỰC TẾ */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    Phương thức & Trạng thái thanh toán của khách:
                  </span>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-900 border border-slate-200">
                    {order.paymentMethod || 'Chưa chọn'}
                  </span>
                </div>

                {isSepayPaid ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-500/80 text-emerald-900 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-black text-xs text-emerald-800">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>ĐÃ THANH TOÁN TỰ ĐỘNG (SEPAY VIETQR)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-black text-[10px]">
                        TIỀN ĐÃ VỀ TÀI KHOẢN
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-950 pt-1">
                      <div>Mã GD: <strong>{order.transactionId || 'SEPAY-AUTO'}</strong></div>
                      <div className="text-right">Thực nhận: <strong>{(order.totalAmount || 0).toLocaleString('vi-VN')} đ</strong></div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {order.paymentStatus === 'PAID' ? 'Khách đã thanh toán' : 'Chưa thanh toán (Thu tiền khi giao COD)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Tổng tiền cần thu: <strong>{(order.totalAmount || 0).toLocaleString('vi-VN')} đ</strong>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-200/80 text-amber-900">
                      {order.paymentStatus || 'PENDING'}
                    </span>
                  </div>
                )}
              </div>

              {/* 3. PHÍ GIAO HÀNG ONLINE (READ-ONLY) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-slate-600" />
                    Phí giao hàng Online (Tính tự động theo tọa độ GPS):
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-500" /> Khóa bất biến
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Phí giao hàng gốc</span>
                    <span className="text-xs font-bold text-slate-800">
                      {(order.shippingFee || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Giảm phí ship</span>
                    <span className="text-xs font-bold text-emerald-600">
                      - {(order.shippingDiscount || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="p-2.5 bg-red-50 rounded-xl border border-red-200">
                    <span className="text-[10px] text-red-600 font-bold block">Khách thực trả</span>
                    <span className="text-xs font-black text-red-700">
                      {Math.max(0, (order.shippingFee || 0) - (order.shippingDiscount || 0)).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-blue-50/60 border border-blue-200/80 rounded-lg text-[11px] text-blue-900 flex items-start gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Phí giao hàng được Backend tự động tính toán tại thời điểm checkout theo quãng đường di chuyển thực tế. Nhân viên/Admin tuyệt đối không được phép chỉnh sửa sau khi khách đã đặt đơn.
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* B. ĐƠN HÀNG POS: PHÍ DỊCH VỤ / PHỤ THU TÙY CHỈNH          */}
          {/* ========================================================= */}
          {!isOnline && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Phí dịch vụ & Phụ thu tùy chỉnh cho đơn POS:
                </span>
                <span className="text-xs font-black text-amber-700">
                  Tổng phụ thu: +{(serviceCharges.reduce((s, c) => s + c.amount, 0)).toLocaleString('vi-VN')} đ
                </span>
              </div>

              {/* List of existing charges */}
              {serviceCharges.length > 0 ? (
                <div className="space-y-1.5">
                  {serviceCharges.map((sc) => (
                    <div
                      key={sc.id}
                      className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{sc.name}</span>
                          {sc.isTaxable && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                              Có thuế VAT
                            </span>
                          )}
                        </div>
                        {sc.note && (
                          <p className="text-[10px] text-slate-500 truncate">{sc.note}</p>
                        )}
                        <span className="text-[10px] text-slate-400 block">
                          Tạo bởi: {sc.createdByName || 'Thu ngân'} • {sc.createdAt ? new Date(sc.createdAt).toLocaleTimeString('vi-VN') : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-xs text-amber-700">
                          +{sc.amount.toLocaleString('vi-VN')} đ
                        </span>
                        {order.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            disabled={deletingChargeId === sc.id}
                            onClick={() => setChargeToDelete({ id: sc.id, name: sc.name })}
                            className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                            title="Xóa phụ thu"
                          >
                            {deletingChargeId === sc.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-white rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-[11px]">
                  Chưa có khoản phụ thu nào được thêm vào đơn này.
                </div>
              )}

              {/* Quick Presets */}
              {order.status !== 'COMPLETED' && (
                <div className="pt-1 space-y-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500 mr-1">Thêm nhanh:</span>
                    {[
                      { name: 'Phụ thu ngày lễ', amount: 50000 },
                      { name: 'Phí phục vụ', amount: 30000 },
                      { name: 'Phụ thu phòng VIP', amount: 100000 },
                      { name: 'Phí mang đồ ngoài', amount: 50000 },
                      { name: 'Phụ thu ngoài giờ', amount: 30000 },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleQuickAddPreset(preset.name, preset.amount)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer"
                      >
                        {preset.name} (+{preset.amount / 1000}k)
                      </button>
                    ))}
                  </div>

                  {/* Add Service Charge Form */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Tên khoản phí/phụ thu:</label>
                        <input
                          type="text"
                          value={newChargeName}
                          onChange={(e) => setNewChargeName(e.target.value)}
                          placeholder="VD: Phụ thu sự kiện, phòng VIP..."
                          className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Số tiền (VNĐ):</label>
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          value={newChargeAmount}
                          onChange={(e) => setNewChargeAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="50000"
                          className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newChargeNote}
                        onChange={(e) => setNewChargeNote(e.target.value)}
                        placeholder="Ghi chú thêm (tùy chọn)..."
                        className="flex-1 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500"
                      />
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={newChargeTaxable}
                          onChange={(e) => setNewChargeTaxable(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                        <span>Có VAT</span>
                      </label>
                      <button
                        type="button"
                        disabled={isAddingCharge}
                        onClick={handleAddServiceCharge}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 transition-colors disabled:opacity-50"
                      >
                        {isAddingCharge ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>Thêm</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* C. THUẾ & XUẤT HÓA ĐƠN VAT DOANH NGHIỆP                    */}
          {/* ========================================================= */}
          <form onSubmit={handleSaveInvoice} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isInvoiceRequested}
                    onChange={(e) => setIsInvoiceRequested(e.target.checked)}
                    className="w-4 h-4 rounded text-[#da251d] focus:ring-[#da251d] accent-[#da251d]"
                  />
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    Khách có yêu cầu xuất hóa đơn VAT (YCXHĐCT)
                  </span>
                </label>
              </div>

              {isInvoiceRequested && (
                <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
                  {/* Mã số thuế */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Mã số thuế doanh nghiệp:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={taxCode}
                        onChange={(e) => setTaxCode(e.target.value)}
                        placeholder="VD: 0101234567"
                        className="flex-1 text-xs bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-[#da251d]"
                      />
                      <button
                        type="button"
                        onClick={handleLookupTax}
                        disabled={isLookingUpTax}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isLookingUpTax ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                        <span>Tra cứu</span>
                      </button>
                    </div>
                  </div>

                  {/* Tên công ty */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tên công ty / Đơn vị:
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="CÔNG TY TNHH..."
                      className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-[#da251d]"
                    />
                  </div>

                  {/* Địa chỉ công ty */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Địa chỉ trên giấy phép kinh doanh:
                    </label>
                    <input
                      type="text"
                      value={taxAddress}
                      onChange={(e) => setTaxAddress(e.target.value)}
                      placeholder="Số ..., Phường ..., Quận ..., Tỉnh/Thành phố"
                      className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-[#da251d]"
                    />
                  </div>

                  {/* Email nhận hóa đơn điện tử */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Email nhận hóa đơn điện tử:
                    </label>
                    <input
                      type="email"
                      value={invoiceEmail}
                      onChange={(e) => setInvoiceEmail(e.target.value)}
                      placeholder="ketoan@congty.com"
                      className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-[#da251d]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <div>
                <span className="text-[11px] text-slate-500 block">Tổng thanh toán:</span>
                <span className="text-sm font-black text-[#da251d]">
                  {(order.totalAmount || 0).toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSavingInvoice}
                  className="px-5 py-2 rounded-xl bg-[#da251d] hover:bg-[#b81d16] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingInvoice && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu thông tin hóa đơn</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* In-App Confirmation Modal for Deleting Service Charge */}
      {chargeToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-120">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-120">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-rose-50 text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-900 mb-1.5">Xóa Khoản Phụ Thu?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Bạn có chắc chắn muốn xóa khoản phụ thu <b className="text-slate-800">"{chargeToDelete.name}"</b> khỏi đơn hàng?
              </p>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChargeToDelete(null)}
                className="h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs active:scale-98 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => executeRemoveServiceCharge(chargeToDelete.id)}
                className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs active:scale-98 transition-all cursor-pointer shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
