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
import ResponsiveModal from '@/components/ui/ResponsiveModal';

interface OrderDetailFeesModalProps {
  order: PosOrder | null;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: PosOrder) => void;
  onPayOrder?: (order: PosOrder) => void;
  isDarkMode?: boolean;
}

export const OrderDetailFeesModal: React.FC<OrderDetailFeesModalProps> = ({
  order,
  onClose,
  onOrderUpdated,
  onPayOrder,
  isDarkMode = false,
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

  const isFinancialLocked =
    order.status === 'COMPLETED' ||
    order.status === 'CANCELLED' ||
    order.paymentStatus === 'PAID' ||
    order.paymentStatus === 'AWAITING_PAYMENT' ||
    order.paymentStatus === 'PAYMENT_REQUESTED' ||
    (order as any).paymentIntentStatus === 'ACTIVE';

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
        .catch(() => { });
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
    <>
      <ResponsiveModal
        isOpen={true}
        onClose={onClose}
        title={isOnline ? `Đơn hàng Online #${displayOrderCode}` : `Đơn POS #${displayOrderCode}`}
        subtitle={`Khách: ${order.customerName}${order.customerPhone ? ` (${order.customerPhone})` : ''} • Tạo lúc: ${new Date(order.createdAt).toLocaleTimeString('vi-VN')}`}
        icon={<Receipt className="w-4 h-4 text-amber-500" />}
        maxWidth="xl"
      >
        <div className={`p-1 space-y-4 text-xs ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>

          {/* ========================================================= */}
          {/* A. ĐƠN HÀNG ONLINE: TIẾN ĐỘ, PTTT THẬT, PHÍ SHIP READ-ONLY */}
          {/* ========================================================= */}
          {isOnline && (
            <>
              {/* 1. TRẠNG THÁI TIẾN ĐỘ ĐƠN HÀNG ONLINE */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
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
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${order.status === 'CONFIRMED'
                      ? 'bg-sky-600 text-white ring-2 ring-sky-300'
                      : isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 shadow-2xs'
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
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${order.status === 'PREPARING'
                      ? 'bg-orange-600 text-white ring-2 ring-orange-300'
                      : isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-orange-400 border border-slate-700 shadow-2xs'
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
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${order.status === 'DELIVERING'
                      ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                      : isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-purple-400 border border-slate-700 shadow-2xs'
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
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${order.status === 'COMPLETED'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                      : isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 shadow-2xs'
                        : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                      }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã hoàn thành</span>
                  </button>
                </div>
              </div>

              {/* 2. THÔNG TIN PHƯƠNG THỨC & TRẠNG THÁI THANH TOÁN THỰC TẾ */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-white border-slate-200'
                }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    Phương thức & Trạng thái thanh toán của khách:
                  </span>
                  <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md border ${isDarkMode ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-200'
                    }`}>
                    {order.paymentMethod || 'Chưa chọn'}
                  </span>
                </div>

                {isSepayPaid ? (
                  <div className={`p-3 rounded-xl border space-y-1.5 ${isDarkMode ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-500/80 text-emerald-900'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 font-black text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span>ĐÃ THANH TOÁN TỰ ĐỘNG (SEPAY VIETQR)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-black text-[10px]">
                        TIỀN ĐÃ VỀ TÀI KHOẢN
                      </span>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 text-[11px] pt-1 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-950'}`}>
                      <div>Mã GD: <strong>{order.transactionId || 'SEPAY-AUTO'}</strong></div>
                      <div className="text-right">Thực nhận: <strong>{(order.totalAmount || 0).toLocaleString('vi-VN')} đ</strong></div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-amber-950/40 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>
                          {order.paymentStatus === 'PAID' ? 'Khách đã thanh toán' : 'Chưa thanh toán (Thu tiền khi giao COD)'}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                        Tổng tiền cần thu: <strong>{(order.totalAmount || 0).toLocaleString('vi-VN')} đ</strong>
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${isDarkMode ? 'bg-amber-900/60 text-amber-300' : 'bg-amber-200/80 text-amber-900'
                      }`}>
                      {order.paymentStatus || 'PENDING'}
                    </span>
                  </div>
                )}
              </div>

              {/* 3. PHÍ GIAO HÀNG ONLINE (READ-ONLY) */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border border-slate-200'
                }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    <Truck className="w-4 h-4 text-slate-500" />
                    Phí giao hàng Online (Tính tự động theo tọa độ GPS):
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                    }`}>
                    <Lock className="w-3 h-3 text-slate-400" /> Khóa bất biến
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                    }`}>
                    <span className={`text-[10px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Phí giao hàng gốc</span>
                    <span className="text-xs font-bold">
                      {(order.shippingFee || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                    }`}>
                    <span className={`text-[10px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Giảm phí ship</span>
                    <span className="text-xs font-bold text-emerald-500">
                      - {(order.shippingDiscount || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-red-950/40 border-red-900/60' : 'bg-red-50 border-red-200'
                    }`}>
                    <span className="text-[10px] text-red-500 font-bold block">Khách thực trả</span>
                    <span className="text-xs font-black text-red-500">
                      {Math.max(0, (order.shippingFee || 0) - (order.shippingDiscount || 0)).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                <div className={`p-2 rounded-lg text-[11px] flex items-start gap-1.5 border ${isDarkMode ? 'bg-blue-950/40 border-blue-900/60 text-blue-300' : 'bg-blue-50/60 border-blue-200/80 text-blue-900'
                  }`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
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
            <div className={`p-3.5 rounded-xl border space-y-3 ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
              }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Phí dịch vụ & Phụ thu tùy chỉnh cho đơn POS:
                </span>
                <span className="text-xs font-black text-amber-500">
                  Tổng phụ thu: +{(serviceCharges.reduce((s, c) => s + c.amount, 0)).toLocaleString('vi-VN')} đ
                </span>
              </div>

              {/* List of existing charges */}
              {serviceCharges.length > 0 ? (
                <div className="space-y-1.5">
                  {serviceCharges.map((sc) => (
                    <div
                      key={sc.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-2xs ${isDarkMode ? 'bg-slate-850 border-slate-700 text-white' : 'bg-white border-slate-200'
                        }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sc.name}</span>
                          {sc.isTaxable && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                              }`}>
                              Có thuế VAT
                            </span>
                          )}
                        </div>
                        {sc.note && (
                          <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{sc.note}</p>
                        )}
                        <span className={`text-[10px] block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          Tạo bởi: {sc.createdByName || 'Thu ngân'} • {sc.createdAt ? new Date(sc.createdAt).toLocaleTimeString('vi-VN') : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-xs text-amber-500">
                          +{sc.amount.toLocaleString('vi-VN')} đ
                        </span>
                        {!isFinancialLocked && (
                          <button
                            type="button"
                            disabled={deletingChargeId === sc.id}
                            onClick={() => setChargeToDelete({ id: sc.id, name: sc.name })}
                            className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
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
                <div className={`p-3 rounded-xl border border-dashed text-center text-[11px] ${isDarkMode ? 'bg-slate-850 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                  Chưa có khoản phụ thu nào được thêm vào đơn này.
                </div>
              )}

              {/* Quick Presets */}
              {isFinancialLocked ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Đơn hàng đang chờ thanh toán / khóa tài chính. Không thể thêm hoặc xóa phụ phí.</span>
                </div>
              ) : (
                <div className="pt-1 space-y-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`text-[10px] font-bold mr-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Thêm nhanh:</span>
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
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${isDarkMode
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-amber-500'
                          : 'bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border-slate-200 hover:border-amber-300'
                          }`}
                      >
                        {preset.name} (+{preset.amount / 1000}k)
                      </button>
                    ))}
                  </div>

                  {/* Add Service Charge Form */}
                  <div className={`p-3 rounded-xl border space-y-2 ${isDarkMode ? 'bg-slate-850 border-slate-700' : 'bg-white border-slate-200'
                    }`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className={`text-[10px] font-bold block mb-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Tên khoản phí/phụ thu:</label>
                        <input
                          type="text"
                          value={newChargeName}
                          onChange={(e) => setNewChargeName(e.target.value)}
                          placeholder="VD: Phụ thu sự kiện, phòng VIP..."
                          className={`w-full text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 border ${isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                            : 'bg-white text-slate-900 border-slate-300'
                            }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-bold block mb-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Số tiền (VNĐ):</label>
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          value={newChargeAmount}
                          onChange={(e) => setNewChargeAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="50000"
                          className={`w-full text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 border ${isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                            : 'bg-white text-slate-900 border-slate-300'
                            }`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newChargeNote}
                        onChange={(e) => setNewChargeNote(e.target.value)}
                        placeholder="Ghi chú thêm (tùy chọn)..."
                        className={`flex-1 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 border ${isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                          : 'bg-white text-slate-900 border-slate-300'
                          }`}
                      />
                      <label className={`flex items-center gap-1 text-[11px] cursor-pointer select-none shrink-0 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
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
            <div className={`p-3.5 rounded-xl border space-y-3 ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
              }`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isInvoiceRequested}
                    onChange={(e) => setIsInvoiceRequested(e.target.checked)}
                    className="w-4 h-4 rounded text-[#da251d] focus:ring-[#da251d] accent-[#da251d]"
                  />
                  <span className={`font-bold text-xs flex items-center gap-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    Khách có yêu cầu xuất hóa đơn VAT (YCXHĐCT)
                  </span>
                </label>
              </div>

              {isInvoiceRequested && (
                <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
                  {/* Mã số thuế */}
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Mã số thuế doanh nghiệp:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={taxCode}
                        onChange={(e) => setTaxCode(e.target.value)}
                        placeholder="VD: 0101234567"
                        className={`flex-1 text-xs rounded-xl px-3 py-1.5 outline-none focus:border-[#da251d] border ${isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                          : 'bg-white text-slate-900 border-slate-300'
                          }`}
                      />
                      <button
                        type="button"
                        onClick={handleLookupTax}
                        disabled={isLookingUpTax}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50 transition-colors ${isDarkMode
                          ? 'bg-slate-700 hover:bg-slate-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-900 text-white'
                          }`}
                      >
                        {isLookingUpTax ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                        <span>Tra cứu</span>
                      </button>
                    </div>
                  </div>

                  {/* Tên công ty */}
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Tên công ty / Đơn vị:
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="CÔNG TY TNHH..."
                      className={`w-full text-xs rounded-xl px-3 py-1.5 outline-none border transition-all ${isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-[#da251d]'
                        : 'bg-white text-slate-900 border-slate-300 focus:border-[#da251d]'
                        }`}
                    />
                  </div>

                  {/* Địa chỉ công ty */}
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Địa chỉ trên giấy phép kinh doanh:
                    </label>
                    <input
                      type="text"
                      value={taxAddress}
                      onChange={(e) => setTaxAddress(e.target.value)}
                      placeholder="Số ..., Phường ..., Quận ..., Tỉnh/Thành phố"
                      className={`w-full text-xs rounded-xl px-3 py-1.5 outline-none border transition-all ${isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-[#da251d]'
                        : 'bg-white text-slate-900 border-slate-300 focus:border-[#da251d]'
                        }`}
                    />
                  </div>

                  {/* Email nhận hóa đơn điện tử */}
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Email nhận hóa đơn điện tử:
                    </label>
                    <input
                      type="email"
                      value={invoiceEmail}
                      onChange={(e) => setInvoiceEmail(e.target.value)}
                      placeholder="ketoan@congty.com"
                      className={`w-full text-xs rounded-xl px-3 py-1.5 outline-none border transition-all ${isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-[#da251d]'
                        : 'bg-white text-slate-900 border-slate-300 focus:border-[#da251d]'
                        }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className={`pt-2 flex items-center justify-between border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'
              }`}>
              <div>
                <span className={`text-[11px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tổng thanh toán:</span>
                <span className="text-sm font-black text-[#da251d]">
                  {(order.totalAmount || 0).toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl font-bold text-xs cursor-pointer transition-colors ${isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
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
      </ResponsiveModal>

      {/* In-App Confirmation Modal for Deleting Service Charge */}
      {chargeToDelete && (
        <ResponsiveModal
          isOpen={true}
          onClose={() => setChargeToDelete(null)}
          title="Xóa Khoản Phụ Thu?"
          subtitle={`Xác nhận xóa phụ thu "${chargeToDelete.name}"`}
          maxWidth="sm"
          footer={
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                onClick={() => setChargeToDelete(null)}
                className={`py-2.5 rounded-xl border font-bold text-xs active:scale-98 transition-all cursor-pointer ${isDarkMode
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-200'
                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                  }`}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => executeRemoveServiceCharge(chargeToDelete.id)}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs active:scale-98 transition-all cursor-pointer shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          }
        >
          <div className="p-4 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-rose-500/10 text-rose-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Bạn có chắc chắn muốn xóa khoản phụ thu <b className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>"{chargeToDelete.name}"</b> khỏi đơn hàng?
            </p>
          </div>
        </ResponsiveModal>
      )}
    </>
  );
};
