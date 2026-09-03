"use client";

import React, { useState, useEffect } from 'react';
import { useCart } from '../../../context/CartContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Store, FileText, Gift, CreditCard, MapPin, Receipt, X, CheckCircle2, Ticket } from 'lucide-react';
import Image from 'next/image';
import AddressModal from '@/components/AddressModal';
import toast from 'react-hot-toast';
import CheckoutVoucherModal from '@/components/checkout/CheckoutVoucherModal';
import VATInvoiceModal from '@/components/checkout/VATInvoiceModal';

interface Address {
  id: string;
  recipientName: string;
  phone: string;
  streetDetail: string;
  ward: string;
  district: string;
  province: string;
  isDefault: boolean;
}

export default function CheckoutPage() {
  const { cartItems, currentBranchId, clearCart, isLoaded, appliedVoucher, setVoucher, discountAmount, getCartItemTotal, refreshQuotas } = useCart();
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});

  const [note, setNote] = useState('');
  const [deliveryDay, setDeliveryDay] = useState<'today' | 'tomorrow'>('today');
  const [deliveryTime, setDeliveryTime] = useState<string>('');

  const [isInvoiceRequested, setIsInvoiceRequested] = useState(false);
  const [vatData, setVatData] = useState<any>(null);

  const [paymentMethod, setPaymentMethod] = useState('SEPAY');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isVatModalOpen, setIsVatModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Tính toán Tạm tính (Subtotal) cho UI hiển thị
  const subTotal = cartItems.reduce((acc, item) => acc + getCartItemTotal(item), 0);

  const baseShippingFee = Number(settings.delivery_fee || 0);
  const deliveryMinFree = Number(settings.delivery_min_free || 0);
  const shippingFee = subTotal >= deliveryMinFree ? 0 : baseShippingFee;

  const totalAmount = Math.max(0, subTotal - (discountAmount || 0)) + shippingFee;
  const pointEarned = Math.floor(totalAmount * 0.01); // 1% points

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formatDay = (date: Date) => `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (e) {
        console.error('Failed to fetch user', e);
      }
    };
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/home/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (e) {
        console.error('Failed to fetch settings', e);
      }
    };
    fetchUser();
    fetchSettings();
  }, []);

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/addresses', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const addressList = Array.isArray(data) ? data : (data?.data || []);
        setAddresses(addressList);
        const defaultAddr = addressList.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        } else if (addressList.length > 0) {
          setSelectedAddressId(addressList[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (cartItems.length === 0) {
      router.replace('/');
      return;
    }
    refreshQuotas();
    fetchAddresses();
  }, [cartItems.length, router, isLoaded]);

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      toast.error('Vui lòng chọn địa chỉ giao hàng');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Đang xử lý đơn hàng...');
    try {
      const fullNote = deliveryTime ? `[Giao lúc: ${deliveryTime} ${deliveryDay === 'today' ? 'Hôm nay' : 'Ngày mai'}] ${note}` : note;

      const payload = {
        addressId: selectedAddressId,
        branchId: currentBranchId,
        cartItems: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          optionItemIds: item.selectedOptions?.map(opt => opt.optionItemId) || [],
          isFlashSaleItem: item.isFlashSaleItem,
          flashSaleId: item.flashSaleId,
          note: item.note,
        })),
        note: fullNote,
        paymentMethod,
        vatInfo: isInvoiceRequested ? {
          isInvoiceRequested: true,
          invoiceCompanyName: vatData.companyName,
          invoiceTaxCode: vatData.taxCode,
          invoiceAddress: vatData.address,
          invoiceEmail: vatData.email
        } : undefined,
        voucherCode: appliedVoucher?.code
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Đặt hàng thất bại');
      }

      clearCart();
      toast.success('🎉 Đặt hàng thành công!', { id: loadingToast });
      router.push('/profile?tab=orders');
    } catch (error: any) {
      toast.error(`Lỗi: ${error.message}`, { id: loadingToast });
      setIsSubmitting(false);
    }
  };

  const selectedAddress = addresses.find(a => a.id === selectedAddressId);

  if (!isLoaded || cartItems.length === 0) return null;

  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-24 lg:pb-12 font-sans text-slate-800">

      {/* Header Mobile */}
      <div className="lg:hidden bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600">
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <h1 className="flex-1 text-center font-bold text-lg mr-6">Thanh Toán</h1>
        </div>
      </div>

      <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-8 max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">

          {/* LEFT COLUMN */}
          <div className="w-full lg:w-[65%] space-y-4 sm:space-y-6">

            {/* THÔNG TIN GIAO HÀNG */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <h2 className="flex items-center text-base font-bold text-slate-800 mb-4">
                <MapPin className="mr-2 text-[#da251d]" size={20} />
                Thông tin giao hàng
              </h2>

              <div
                onClick={() => setIsAddressModalOpen(true)}
                className="flex items-center justify-between p-3 sm:p-4 bg-red-50/30 border border-red-100 rounded-xl cursor-pointer hover:bg-red-50 transition-colors"
              >
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 text-[#da251d] flex items-center justify-center shrink-0">
                    <MapPin size={16} fill="currentColor" className="text-[#da251d]" />
                  </div>
                  {selectedAddress ? (
                    <div>
                      <p className="font-bold text-sm text-slate-800">{selectedAddress.recipientName} - {selectedAddress.phone}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{selectedAddress.streetDetail}, {selectedAddress.ward}, {selectedAddress.district}, {selectedAddress.province}</p>
                    </div>
                  ) : (
                    <div className="flex items-center font-bold text-sm text-slate-600">Chưa có địa chỉ. Vui lòng thêm!</div>
                  )}
                </div>
                <ChevronRight className="text-slate-400 shrink-0" size={20} />
              </div>
            </div>

            {/* THỜI GIAN NHẬN HÀNG */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <h2 className="flex items-center text-base font-bold text-slate-800 mb-4">
                Thời gian nhận hàng
              </h2>

              <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 mb-4">
                <button
                  onClick={() => setDeliveryDay('today')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${deliveryDay === 'today' ? 'bg-white text-[#da251d] shadow-sm' : 'text-slate-500'}`}
                >
                  Hôm nay ({formatDay(today)})
                </button>
                <button
                  onClick={() => setDeliveryDay('tomorrow')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${deliveryDay === 'tomorrow' ? 'bg-white text-[#da251d] shadow-sm' : 'text-slate-500'}`}
                >
                  Ngày mai
                </button>
              </div>

              <div className="text-center py-4 text-sm text-slate-500 mb-4">
                Không có khung giờ trống. (Giao càng sớm càng tốt)
              </div>

              <textarea
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ghi chú đơn hàng..."
                className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#da251d] resize-none"
              />
            </div>

            {/* CART ITEMS */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <h2 className="flex items-center text-base font-bold text-slate-800">
                  <Store className="mr-2 text-[#da251d]" size={20} />
                  Sushi Wa - Tầng B1 Gigamall Thủ Đức
                </h2>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">{cartItems.length} món</span>
              </div>

              <div className="space-y-4">
                {cartItems.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-100 shrink-0 relative bg-slate-50">
                      {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 768px) 100px, 80px" className="object-cover" />}
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-sm text-slate-800 line-clamp-1">{item.name}</h3>
                          {item.optionsTextSnapshot && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.optionsTextSnapshot}</p>}
                        </div>
                        <span className="font-bold text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-2">x{item.quantity}</span>
                      </div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="font-bold text-[#da251d] text-sm">{getCartItemTotal(item).toLocaleString('vi-VN')}đ</span>
                        {item.priceAtSale < item.originalPriceAtSale && (
                          <span className="text-xs text-slate-400 line-through">{(item.originalPriceAtSale * item.quantity).toLocaleString('vi-VN')}đ</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PHÍ GIAO HÀNG */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TruckIcon className="w-6 h-6 text-[#00B14F]" />
                  <span className="font-bold text-slate-800 text-sm">Phí giao hàng</span>
                  <span className="text-[10px] font-bold text-white bg-[#00B14F] px-1.5 py-0.5 rounded">GrabExpress</span>
                </div>
                <span className="font-bold text-slate-800 text-sm">{shippingFee.toLocaleString('vi-VN')}đ</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Giảm đến 35.000đ phí vận chuyển cho đơn hàng từ 300.000đ khi đổi voucher trong mục Ưu đãi.
              </p>
            </div>

            {/* YÊU CẦU XUẤT HÓA ĐƠN */}
            <div
              onClick={() => setIsVatModalOpen(true)}
              className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="text-slate-600" size={20} />
                <span className="font-bold text-slate-800 text-sm">Yêu cầu xuất hóa đơn</span>
                {isInvoiceRequested && (
                  <span className="ml-2 bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded font-bold">Đã nhập</span>
                )}
              </div>
              <ChevronRight className="text-slate-400" size={20} />
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="w-full lg:w-[35%] space-y-4 sm:space-y-6">

            {/* ƯU ĐÃI */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <h2 className="flex items-center text-base font-bold text-slate-800 mb-4">
                <Gift className="mr-2 text-amber-500" size={20} />
                Ưu đãi & Điểm thưởng
              </h2>

              <div
                onClick={() => setIsVoucherModalOpen(true)}
                className="flex items-center justify-between p-3 bg-amber-50/50 border border-amber-100 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center shrink-0">
                    <Ticket size={16} />
                  </div>
                  {appliedVoucher ? (
                    <div>
                      <p className="font-bold text-sm text-green-700">{appliedVoucher.code}</p>
                      <p className="text-[10px] text-green-600">- {discountAmount.toLocaleString('vi-VN')}đ</p>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-slate-600">Chọn hoặc nhập mã...</span>
                  )}
                </div>
                <ChevronRight className="text-slate-400 shrink-0" size={20} />
              </div>
            </div>

            {/* THANH TOÁN */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <h2 className="flex items-center text-base font-bold text-slate-800 mb-4">
                <CreditCard className="mr-2 text-emerald-600" size={20} />
                Phương thức thanh toán
              </h2>

              <div
                onClick={() => setIsPaymentModalOpen(true)}
                className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {paymentMethod === 'SEPAY' ? (
                    <>
                      <div className="text-[#005BAA] font-black text-[10px] italic">SePay</div>
                      <span className="text-sm font-bold text-slate-800">Chuyển khoản QR (SePay)</span>
                    </>
                  ) : paymentMethod === 'COD' ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">COD</div>
                      <span className="text-sm font-bold text-slate-800">Tiền mặt</span>
                    </>
                  ) : (
                    <>
                      <div className="w-6 h-6 rounded bg-[#A50064] text-white flex items-center justify-center text-[10px] font-bold">MOMO</div>
                      <span className="text-sm font-bold text-slate-800">Ví MoMo</span>
                    </>
                  )}
                </div>
                <span className="text-xs font-medium text-[#da251d]">Thay đổi</span>
              </div>
            </div>

            {/* SUMMARY */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60 lg:sticky lg:top-24">
              <h2 className="flex items-center text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-4">
                <Receipt className="mr-2 text-slate-600" size={20} />
                Chi tiết thanh toán
              </h2>

              <div className="space-y-3 text-sm mb-6">
                <div className="flex justify-between text-slate-500">
                  <span>Tạm tính ({cartItems.length} món):</span>
                  <span className="text-slate-800 font-medium">{subTotal.toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Phí vận chuyển:</span>
                  <span className="text-slate-800 font-medium">{shippingFee.toLocaleString('vi-VN')}đ</span>
                </div>
                {appliedVoucher && (
                  <div className="flex justify-between text-green-600">
                    <span>Mã giảm giá:</span>
                    <span className="font-bold">-{discountAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-lg">Tổng cộng:</span>
                <span className="font-black text-2xl text-[#da251d]">{totalAmount.toLocaleString('vi-VN')}đ</span>
              </div>

              <div className="flex items-center justify-end gap-1 text-[11px] text-amber-600 font-medium mb-6 italic">
                <div className="w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center text-white text-[8px] not-italic">V</div>
                Tích lũy {pointEarned.toLocaleString('vi-VN')} điểm khi đơn hàng hoàn tất!
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full bg-[#da251d] hover:bg-[#b91c2c] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#da251d]/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN ĐẶT HÀNG →'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isAddressModalOpen && (
        <AddressModal onClose={() => setIsAddressModalOpen(false)} onSuccess={() => fetchAddresses()} />
      )}

      <CheckoutVoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        orderValue={subTotal}
        appliedVoucher={appliedVoucher}
        onApply={(v) => {
          // Get the discount API recalculation done inside CartContext or handled locally.
          // Since CartContext setVoucher requires (voucher, discount), we need to fetch it or compute it.
          // Wait, CartContext's useEffect auto-computes discountAmount! We just need to pass the voucher.
          setVoucher(v, 0);
        }}
      />

      <VATInvoiceModal
        isOpen={isVatModalOpen}
        onClose={() => setIsVatModalOpen(false)}
        initialData={vatData}
        onSave={(data) => {
          setVatData(data);
          setIsInvoiceRequested(true);
        }}
      />

      {/* Payment Selection Modal inline */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPaymentModalOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 duration-300">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">Chọn phương thức thanh toán</h3>
              <button onClick={() => setIsPaymentModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div onClick={() => { setPaymentMethod('SEPAY'); setIsPaymentModalOpen(false); }} className={`p-4 border rounded-xl flex items-center justify-between cursor-pointer ${paymentMethod === 'SEPAY' ? 'border-[#da251d] bg-red-50/20' : 'border-slate-200'}`}>
                <div className="flex gap-3 items-center">
                  <div className="text-[#005BAA] font-black text-sm italic">SePay</div>
                  <span className="font-bold">Chuyển khoản QR (SePay)</span>
                </div>
                {paymentMethod === 'SEPAY' && <CheckCircle2 className="text-[#da251d]" size={20} />}
              </div>
              <div onClick={() => { setPaymentMethod('COD'); setIsPaymentModalOpen(false); }} className={`p-4 border rounded-xl flex items-center justify-between cursor-pointer ${paymentMethod === 'COD' ? 'border-[#da251d] bg-red-50/20' : 'border-slate-200'}`}>
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">COD</div>
                  <span className="font-bold">Tiền mặt khi nhận hàng</span>
                </div>
                {paymentMethod === 'COD' && <CheckCircle2 className="text-[#da251d]" size={20} />}
              </div>
              <div className="p-4 border border-slate-200 rounded-xl flex items-center justify-between opacity-50">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded bg-[#A50064] text-white flex items-center justify-center text-[10px] font-bold">MOMO</div>
                  <span className="font-bold">Ví MoMo (Bảo trì)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TruckIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 17h4V5H2v12h3" />
      <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5" />
      <path d="M14 17h1" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}
