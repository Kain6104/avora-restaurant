'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useWaiterStore } from '@/store/useWaiterStore';
import { 
  X, 
  QrCode, 
  Banknote, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2, 
  Wallet, 
  Check, 
  Copy,
  Receipt,
  Loader2,
  User,
  UserPlus,
  UserMinus,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerSearchSheet from '../customer/CustomerSearchSheet';

interface PaymentViewProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCustomerUpdated?: (customer: any) => void;
  order: any;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function PaymentView({ isOpen, onClose, onSuccess, onCustomerUpdated, order }: PaymentViewProps) {
  const isOffline = useWaiterStore(s => s.isOffline);
  const activeBranchId = useWaiterStore(s => s.activeBranchId);
  const [method, setMethod] = useState<string>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [cardType, setCardType] = useState<string>('VISA');
  const [cardLast4, setCardLast4] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Customer Loyalty State (Matching Image 4)
  const [currentCustomer, setCurrentCustomer] = useState<any | null>(
    order?.user ||
      (order?.customerName
        ? { fullName: order.customerName, phone: order.customerPhone, points: order.user?.points || 0 }
        : null),
  );
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);

  // Check if order already has redeemed points
  const hasRedeemedPoints = Boolean(
    (order?.pointsUsed && order.pointsUsed > 0) ||
      order?.orderItems?.some(
        (it: any) =>
          it.priceAtSale === 0 &&
          (it.discountReason?.includes('đổi điểm') ||
            it.discountReason?.includes('Đổi điểm') ||
            it.note?.includes('ĐỔI ĐIỂM')),
      ),
  );

  useEffect(() => {
    if (order?.user) {
      setCurrentCustomer(order.user);
    } else if (order?.customerName) {
      setCurrentCustomer({
        fullName: order.customerName,
        phone: order.customerPhone,
        points: order.user?.points || 0,
      });
    } else {
      setCurrentCustomer(null);
    }
  }, [order?.user, order?.customerName, order?.customerPhone]);

  const handleSelectCustomer = async (customer: any) => {
    if (hasRedeemedPoints) {
      toast.error('Đơn hàng này đã đổi điểm thưởng, không thể thay đổi khách hàng!');
      return;
    }
    setCurrentCustomer(customer);
    if (order?.id) {
      try {
        const res = await fetch(`/api/pos/orders/${order.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: customer.id,
            customerName: customer.fullName,
            customerPhone: customer.phone,
          }),
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          toast.success(`Đã gắn khách hàng ${customer.fullName}`);
          onCustomerUpdated?.(customer);
        } else {
          toast.error(resData?.message || 'Lỗi khi gắn khách hàng vào đơn');
        }
      } catch {
        toast.error('Lỗi khi gắn khách hàng vào đơn');
      }
    }
  };

  const handleRemoveCustomer = async () => {
    if (hasRedeemedPoints) {
      toast.error('Đơn hàng này đã đổi điểm thưởng, không thể gỡ khách hàng!');
      return;
    }
    setCurrentCustomer(null);
    if (order?.id) {
      try {
        const res = await fetch(`/api/pos/orders/${order.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: null,
            customerName: null,
            customerPhone: null,
          }),
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          toast.success('Đã chuyển về khách lẻ');
          onCustomerUpdated?.(null);
        } else {
          toast.error(resData?.message || 'Lỗi khi cập nhật khách hàng');
        }
      } catch {
        toast.error('Lỗi khi cập nhật khách hàng');
      }
    }
  };

  // Fetch real payment methods from DB
  const { data: methodsResponse } = useSWR(isOpen ? '/api/pos/payment-methods' : null, fetcher);
  const dbPaymentMethods = methodsResponse?.data || [];

  const total = order?.totalAmount || 0;

  useEffect(() => {
    if (total > 0) {
      setCashReceived(total);
    }
  }, [total]);

  // Selected method details
  const activeMethodObj = dbPaymentMethods.find((pm: any) => pm.methodCode === method);
  const isAutoPayment =
    method === 'SEPAY' ||
    method === 'SEPAY_QR' ||
    method === 'PAYOS' ||
    method === 'MOMO_QR' ||
    method === 'VNPAY_QR' ||
    Boolean(activeMethodObj?.isAutomatedWebhook) ||
    (activeMethodObj?.name || '').toLowerCase().includes('sepay') ||
    (activeMethodObj?.methodCode || '').toLowerCase().includes('sepay');

  const orderCode = order?.orderCode || order?.temporaryOrderCode || (order?.id ? `DH${order.id.slice(0, 6)}` : '');

  // Polling for auto-payment confirmation via SePay/Webhook
  useEffect(() => {
    if (!isOpen || !order?.id || !isAutoPayment) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pos/orders/${order.id}`);
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.paymentStatus === 'PAID' || json.data.status === 'COMPLETED') {
            toast.success(`Đã nhận được thanh toán từ ${activeMethodObj?.name || 'SePay'}! Mã ĐH: ${json.data.orderCode || orderCode}`);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            onSuccess?.();
            onClose();
          }
        }
      } catch {}
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen, order?.id, isAutoPayment, activeMethodObj?.name, orderCode, onSuccess, onClose]);

  if (!isOpen || !order) return null;

  // STRICT RULE: No offline payments allowed
  if (isOffline) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Không có kết nối mạng</h2>
          <p className="text-slate-500 text-xs mb-6 leading-relaxed">
            Thanh toán yêu cầu kết nối mạng trực tiếp để khóa sổ bàn và xuất mã hóa đơn chính thức. Vui lòng kết nối Wi-Fi / 4G và thử lại.
          </p>
          <button 
            type="button"
            onClick={onClose} 
            className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl active:scale-95 transition-transform text-sm cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const cashChange = Math.max(0, cashReceived - total);

  // Quick cash additions
  const handleAddCash = (amount: number) => {
    setCashReceived((prev) => prev + amount);
  };

  const handleSetExact = () => {
    setCashReceived(total);
  };

  const bankCode = activeMethodObj?.bankCode || 'MB';
  const accountNumber = activeMethodObj?.accountNumber || '0988888888';
  const accountName = activeMethodObj?.accountName || 'AVORA RESTAURANT';
  
  const qrTransferUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${total}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(accountName)}`;

  const handleConfirmPayment = async () => {
    if (isAutoPayment) {
      toast.error('Phương thức này xác nhận tự động qua cổng thanh toán, không thể xác nhận thủ công');
      return;
    }

    if (!method) {
      toast.error('Vui lòng chọn phương thức thanh toán');
      return;
    }

    if (method === 'CASH' && cashReceived < total) {
      toast.error('Tiền khách đưa chưa đủ');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Đang xử lý thanh toán & khóa sổ bàn...');

    try {
      const res = await fetch(`/api/pos/orders/${order.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payments: [
            {
              paymentMethod: method,
              amount: total,
              cashReceived: method === 'CASH' ? cashReceived : total,
              cashChange: method === 'CASH' ? cashChange : 0,
              cardType: method === 'CARD' ? cardType : undefined,
              cardLast4: method === 'CARD' ? cardLast4 : undefined,
              transactionRef: transactionRef || undefined,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi xử lý thanh toán');
      }

      const officialCode = data.data?.orderCode || data.data?.temporaryOrderCode || orderCode;
      toast.success(`Thanh toán thành công! Mã hóa đơn: ${officialCode}`, { id: toastId, duration: 4000 });
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thanh toán. Vui lòng thử lại.', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  // Fallback methods if DB list is loading
  const methodsList = dbPaymentMethods.length > 0 
    ? dbPaymentMethods.map((pm: any) => ({
        id: pm.methodCode,
        label: pm.name,
        icon: pm.methodCode === 'CASH' ? Banknote : pm.methodCode.includes('TRANSFER') || pm.methodCode.includes('QR') || pm.methodCode === 'PAYOS' ? QrCode : pm.methodCode === 'CARD' ? CreditCard : Wallet,
        isHot: pm.methodCode === 'SEPAY_QR' || pm.methodCode === 'SEPAY' || pm.name.toLowerCase().includes('sepay'),
      }))
    : [
        { id: 'CASH', label: 'Tiền mặt', icon: Banknote, isHot: false },
        { id: 'SEPAY_QR', label: 'Chuyển khoản QR (SePay)', icon: QrCode, isHot: true },
        { id: 'TRANSFER', label: 'Chuyển khoản thường', icon: QrCode, isHot: false },
        { id: 'CARD', label: 'Thẻ POS', icon: CreditCard, isHot: false },
        { id: 'MOMO', label: 'Ví MoMo', icon: Wallet, isHot: false },
      ];

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <Receipt size={20} className="text-[#DA251D]" />
            <h3 className="font-bold text-base text-slate-800">Thanh toán đơn hàng</h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Total Amount Box */}
          <div className="bg-red-50/70 border border-red-200/80 rounded-2xl p-4 text-center">
            <span className="text-xs font-bold text-[#DA251D] uppercase tracking-wider">
              Tổng thanh toán
            </span>
            <div className="text-2xl font-black text-[#DA251D] mt-0.5 font-mono">
              {total.toLocaleString('vi-VN')} đ
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Đơn #{orderCode}
            </p>
          </div>

          {/* Customer Loyalty Section (Matching Image 4) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Khách hàng tích điểm
            </label>
            {currentCustomer ? (
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">
                      {currentCustomer.fullName || currentCustomer.name}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {currentCustomer.phone} • {(currentCustomer.points || 0).toLocaleString('vi-VN')} điểm
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCustomer}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="Bỏ chọn khách hàng"
                >
                  <UserMinus size={18} />
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-medium">
                  <Info size={16} className="text-slate-400" />
                  <span>Khách lẻ</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomerSearchOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>Chọn khách</span>
                </button>
              </div>
            )}
          </div>

          {/* Payment Method Selector Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Phương thức thanh toán
            </label>
            <div className="grid grid-cols-2 gap-2">
              {methodsList.map((m: any) => {
                const Icon = m.icon;
                const isSelected = method === m.id;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left relative cursor-pointer ${
                      isSelected
                        ? 'bg-red-50/80 border-[#DA251D] text-[#DA251D] font-bold shadow-xs'
                        : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <Icon size={18} className={isSelected ? 'text-[#DA251D]' : 'text-slate-500'} />
                    <span className="text-xs truncate">{m.label}</span>
                    {m.isHot && (
                      <span className="absolute top-1.5 right-1.5 text-[8px] bg-rose-500 text-white font-black px-1.5 py-0.2 rounded-full uppercase">
                        HOT
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1. CASH DETAILS */}
          {method === 'CASH' && (
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tiền khách đưa (VND):
                </label>
                <input
                  type="number"
                  step="1000"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(Number(e.target.value))}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-lg font-black text-slate-900 outline-none focus:border-[#DA251D]"
                />
              </div>

              {/* Fast Denomination Buttons */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={handleSetExact}
                  className="py-1.5 px-2 bg-white hover:bg-red-50 text-[#DA251D] rounded-lg text-xs font-bold border border-red-200 shadow-2xs cursor-pointer"
                >
                  Đúng số tiền
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(50000)}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
                >
                  +50.000đ
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(100000)}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
                >
                  +100.000đ
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(200000)}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
                >
                  +200.000đ
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(500000)}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
                >
                  +500.000đ
                </button>
                <button
                  type="button"
                  onClick={() => setCashReceived(1000000)}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer"
                >
                  1.000.000đ
                </button>
              </div>

              {/* Change Return Amount */}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-600">Tiền thừa trả khách:</span>
                <span className={`font-black text-base ${cashChange > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                  {cashChange.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
          )}

          {/* 2. TRANSFER / VIETQR / SEPAY DETAILS */}
          {(method === 'TRANSFER' || method.includes('QR') || method === 'PAYOS' || method === 'SEPAY_QR' || isAutoPayment) && (
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
              <div className="p-3 bg-white border border-red-200 rounded-2xl shadow-inner inline-block mx-auto">
                <img
                  src={qrTransferUrl}
                  alt="VietQR Transfer"
                  className="w-44 h-44 rounded-lg object-contain mx-auto"
                />
              </div>

              <div className="space-y-1 text-xs text-slate-700 text-left bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ngân hàng:</span>
                  <span className="font-bold">{bankCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số tài khoản:</span>
                  <span className="font-bold">{accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chủ tài khoản:</span>
                  <span className="font-bold">{accountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nội dung CK:</span>
                  <span className="font-bold text-[#DA251D]">{orderCode}</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. CARD DETAILS */}
          {method === 'CARD' && (
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Loại thẻ
                </label>
                <select
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none"
                >
                  <option value="VISA">VISA</option>
                  <option value="MASTERCARD">MasterCard</option>
                  <option value="JCB">JCB</option>
                  <option value="ATM_DOMESTIC">Thẻ ATM nội địa (Napas)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  4 số cuối thẻ / Mã chuẩn chi POS
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value)}
                  placeholder="Ví dụ: 8899"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mã giao dịch POS (tùy chọn)
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="Nhập mã giao dịch in trên hóa đơn máy POS..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Đóng
          </button>

          {isAutoPayment ? (
            <button
              type="button"
              disabled
              className="flex-1 py-3.5 rounded-2xl bg-blue-500 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-not-allowed opacity-90 animate-pulse select-none"
            >
              <Loader2 size={18} className="animate-spin" />
              <span>ĐANG CHỜ KHÁCH THANH TOÁN...</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmPayment}
              className="flex-1 py-3 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white font-bold text-sm shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Check size={18} />
              {isProcessing ? 'Đang hoàn tất...' : `Xác nhận thanh toán (${total.toLocaleString('vi-VN')}đ)`}
            </button>
          )}
        </div>
      </div>

      {/* Customer Search Sheet */}
      {isCustomerSearchOpen && (
        <CustomerSearchSheet
          isOpen={isCustomerSearchOpen}
          onClose={() => setIsCustomerSearchOpen(false)}
          onSelect={handleSelectCustomer}
        />
      )}
    </div>
  );
}
