"use client";

import React, { useState, useEffect } from 'react';
import { useCart } from '../../../context/CartContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, StickyNote, Receipt, CreditCard, ChevronRight, Search, Loader2, CheckCircle2, Building2, MapPinIcon } from 'lucide-react';
import Image from 'next/image';
import AddressModal from '@/components/AddressModal';
import toast from 'react-hot-toast';

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
  const { cartItems, currentBranchId, clearCart, isLoaded, appliedVoucher, discountAmount, getCartItemTotal, refreshQuotas } = useCart();
  const router = useRouter();
  
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [note, setNote] = useState('');
  
  const [isInvoiceRequested, setIsInvoiceRequested] = useState(false);
  const [invoiceCompanyName, setInvoiceCompanyName] = useState('');
  const [invoiceTaxCode, setInvoiceTaxCode] = useState('');
  const [invoiceAddress, setInvoiceAddress] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const [settings, setSettings] = useState<any>({});
  
  // Tính toán Tạm tính (Subtotal) cho UI hiển thị
  const subTotal = cartItems.reduce((acc, item) => acc + getCartItemTotal(item), 0);
  
  const baseShippingFee = Number(settings.delivery_fee || 0);
  const deliveryMinFree = Number(settings.delivery_min_free || 0);
  const shippingFee = subTotal >= deliveryMinFree ? 0 : baseShippingFee;
  
  const totalAmount = Math.max(0, subTotal - (discountAmount || 0)) + shippingFee;

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
        // Fix: backend directly returns an array
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
  }, [cartItems.length, router, isLoaded]); // Use cartItems.length instead of cartItems to prevent infinite loops

  const handleTaxCodeLookup = async () => {
    if (!invoiceTaxCode) {
      toast.error('Vui lòng nhập Mã số thuế');
      return;
    }
    setIsLookingUp(true);
    try {
      const res = await fetch(`https://api.vietqr.io/v2/business/${invoiceTaxCode}`);
      const data = await res.json();
      if (data.code === "00" && data.data) {
        setInvoiceCompanyName(data.data.name || '');
        setInvoiceAddress(data.data.address || '');
        toast.success("Tra cứu thông tin thành công");
      } else {
        toast.error("Không tìm thấy thông tin doanh nghiệp");
      }
    } catch (e) {
      toast.error("Lỗi kết nối khi tra cứu MST");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      toast.error('Vui lòng chọn địa chỉ giao hàng');
      return;
    }
    
    setIsSubmitting(true);
    const loadingToast = toast.loading('Đang xử lý đơn hàng...');
    try {
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
        note,
        paymentMethod,
        vatInfo: isInvoiceRequested ? {
          isInvoiceRequested: true,
          invoiceCompanyName,
          invoiceTaxCode,
          invoiceAddress,
          invoiceEmail
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

      // Success
      clearCart();
      toast.success('🎉 Đặt hàng thành công!', { id: loadingToast });
      router.push('/profile?tab=orders');
    } catch (error: any) {
      toast.error(`Lỗi: ${error.message}`, { id: loadingToast });
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || cartItems.length === 0) return null; // Wait for redirect

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans selection:bg-orange-200 selection:text-orange-900">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 max-w-6xl h-16 flex items-center">
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Thanh Toán</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {isAddressModalOpen && (
          <AddressModal 
            onClose={() => setIsAddressModalOpen(false)} 
            onSuccess={() => fetchAddresses()} 
          />
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column (2/3) */}
          <div className="w-full lg:w-[65%] space-y-6">
            
            {/* Khối 1: Chọn địa chỉ */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/60 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-orange-400 to-red-500 rounded-l-3xl"></div>
              
              <div className="flex items-center justify-between mb-6">
                <h2 className="flex items-center text-lg md:text-xl font-bold text-slate-800">
                  <MapPin className="mr-3 text-orange-500" size={26} /> 
                  Địa chỉ giao hàng
                </h2>
                {addresses.length > 0 && (
                  <button 
                    onClick={() => setIsAddressModalOpen(true)}
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-full transition-colors"
                  >
                    + Thêm địa chỉ
                  </button>
                )}
              </div>

              {addresses.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                    <MapPin className="text-slate-400" size={28} />
                  </div>
                  <h3 className="text-slate-700 font-semibold mb-1">Bạn chưa có địa chỉ giao hàng</h3>
                  <p className="text-sm text-slate-500 mb-5">Thêm địa chỉ để chúng tôi giao món đến bạn nhanh nhất</p>
                  <button 
                    onClick={() => setIsAddressModalOpen(true)} 
                    className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-6 py-2.5 rounded-full shadow-lg shadow-slate-900/20 transition-all active:scale-95"
                  >
                    Thêm địa chỉ ngay
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map(addr => (
                    <label 
                      key={addr.id} 
                      className={`relative flex flex-col p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                        selectedAddressId === addr.id 
                          ? 'border-orange-500 bg-orange-50/30 shadow-md shadow-orange-500/10' 
                          : 'border-slate-100 hover:border-orange-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name="address" 
                            className="sr-only" 
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                          />
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedAddressId === addr.id ? 'border-orange-500' : 'border-slate-300'
                          }`}>
                            {selectedAddressId === addr.id && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                          </div>
                          <span className="font-bold text-slate-800">{addr.recipientName}</span>
                        </div>
                        {addr.isDefault && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full uppercase tracking-wide">
                            Mặc định
                          </span>
                        )}
                      </div>
                      <div className="pl-7 space-y-1">
                        <p className="text-sm font-medium text-slate-600">{addr.phone}</p>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {addr.streetDetail}, {addr.ward}, {addr.district}, {addr.province}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Khối 2: Lời nhắn */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/60">
              <h2 className="flex items-center text-lg md:text-xl font-bold mb-4 text-slate-800">
                <StickyNote className="mr-3 text-blue-500" size={26} /> 
                Ghi chú cho nhà hàng
              </h2>
              <textarea 
                rows={2} 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 text-slate-700 resize-none"
                placeholder="VD: Không hành, thêm tương ớt, dặn shipper gọi khi đến..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              ></textarea>
            </div>

            {/* Khối 3: Xuất hóa đơn VAT */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/60 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <h2 className="flex items-center text-lg md:text-xl font-bold text-slate-800">
                  <Receipt className="mr-3 text-emerald-500" size={26} /> 
                  Yêu cầu hóa đơn VAT
                </h2>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <span className="mr-3 text-sm font-medium text-slate-600">{isInvoiceRequested ? 'Bật' : 'Tắt'}</span>
                  <input type="checkbox" className="sr-only peer" checked={isInvoiceRequested} onChange={() => setIsInvoiceRequested(!isInvoiceRequested)} />
                  <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                </label>
              </div>
              
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 transition-all duration-500 overflow-hidden ${isInvoiceRequested ? 'max-h-[800px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
                <div className="md:col-span-2 relative">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Mã số thuế</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium" 
                      value={invoiceTaxCode} 
                      onChange={e => setInvoiceTaxCode(e.target.value)} 
                      placeholder="Nhập mã số thuế doanh nghiệp" 
                      required={isInvoiceRequested} 
                    />
                    <button 
                      type="button"
                      onClick={handleTaxCodeLookup}
                      disabled={isLookingUp || !invoiceTaxCode}
                      className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white px-5 rounded-2xl font-semibold transition-all shadow-md active:scale-95 whitespace-nowrap"
                    >
                      {isLookingUp ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                      <span className="hidden sm:inline">Tra cứu</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    Tự động điền tên và địa chỉ công ty từ cổng thông tin quốc gia
                  </p>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Tên công ty</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Building2 size={18} />
                    </div>
                    <input 
                      type="text" 
                      className="w-full pl-10 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium" 
                      value={invoiceCompanyName} 
                      onChange={e => setInvoiceCompanyName(e.target.value)} 
                      placeholder="Tên công ty / Doanh nghiệp" 
                      required={isInvoiceRequested} 
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Địa chỉ công ty</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <MapPinIcon size={18} />
                    </div>
                    <input 
                      type="text" 
                      className="w-full pl-10 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium" 
                      value={invoiceAddress} 
                      onChange={e => setInvoiceAddress(e.target.value)} 
                      placeholder="Địa chỉ theo đăng ký kinh doanh" 
                      required={isInvoiceRequested} 
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Email nhận hóa đơn</label>
                  <input 
                    type="email" 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium" 
                    value={invoiceEmail} 
                    onChange={e => setInvoiceEmail(e.target.value)} 
                    placeholder="Nhập email nhận hóa đơn điện tử" 
                    required={isInvoiceRequested} 
                  />
                </div>
              </div>
            </div>

            {/* Khối 4: Phương thức thanh toán */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/60">
              <h2 className="flex items-center text-lg md:text-xl font-bold mb-5 text-slate-800">
                <CreditCard className="mr-3 text-purple-500" size={26} /> 
                Phương thức thanh toán
              </h2>
              <div className="space-y-4">
                <label className={`flex items-center p-4 md:p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                  paymentMethod === 'COD' 
                    ? 'border-purple-500 bg-purple-50/30 shadow-md shadow-purple-500/10' 
                    : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50'
                }`}>
                  <input 
                    type="radio" 
                    name="payment" 
                    className="sr-only" 
                    checked={paymentMethod === 'COD'} 
                    onChange={() => setPaymentMethod('COD')} 
                  />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    paymentMethod === 'COD' ? 'border-purple-500' : 'border-slate-300'
                  }`}>
                    {paymentMethod === 'COD' && <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />}
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <Image src="/icons/cash.svg" alt="COD" width={24} height={24} className="opacity-70" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      {/* Fallback icon if image doesn't exist */}
                      <span className="font-bold text-xs absolute">COD</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800">Thanh toán khi nhận hàng</span>
                      <span className="text-xs text-slate-500">Thanh toán bằng tiền mặt khi shipper giao tới</span>
                    </div>
                  </div>
                </label>

                <label className={`flex items-center p-4 md:p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                  paymentMethod === 'MOMO' 
                    ? 'border-pink-500 bg-pink-50/30 shadow-md shadow-pink-500/10' 
                    : 'border-slate-100 hover:border-pink-200 hover:bg-slate-50 opacity-60'
                }`}>
                  <input 
                    type="radio" 
                    name="payment" 
                    className="sr-only" 
                    checked={paymentMethod === 'MOMO'} 
                    onChange={() => setPaymentMethod('MOMO')} 
                    disabled // Sắp ra mắt
                  />
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0"></div>
                  <div className="ml-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#A50064] flex items-center justify-center text-white font-bold text-[10px]">
                      MoMo
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800">Ví MoMo <span className="ml-2 text-[10px] font-bold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full">Sắp ra mắt</span></span>
                      <span className="text-xs text-slate-500">Quét mã QR qua ứng dụng MoMo</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column (1/3) - Sticky Summary */}
          <div className="w-full lg:w-[35%]">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 sticky top-24">
              <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center justify-between">
                Tóm tắt đơn hàng
                <span className="text-sm font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{cartItems.length} món</span>
              </h2>
              
              <div className="max-h-[350px] overflow-y-auto mb-6 space-y-5 pr-2 custom-scrollbar">
                {cartItems.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex items-start gap-4">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100 bg-slate-50 shadow-sm">
                      {item.imageUrl ? (
                         <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center text-[10px] font-medium text-slate-400">No img</div>
                      )}
                      <div className="absolute top-0 right-0 bg-slate-800/80 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-bl-lg">
                        x{item.quantity}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="font-bold text-slate-800 text-sm truncate leading-tight mb-1">{item.name}</p>
                      {item.optionsTextSnapshot && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-1.5">{item.optionsTextSnapshot}</p>
                      )}
                      {item.note && (
                        <p className="text-[11px] text-slate-500 italic mb-1.5 text-ellipsis overflow-hidden">Ghi chú: {item.note}</p>
                      )}
                      <p className="text-sm font-black text-orange-600">{getCartItemTotal(item).toLocaleString('vi-VN')}đ</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-slate-100 pt-5 space-y-4 text-sm">
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Tạm tính</span>
                  <span className="text-slate-800">{subTotal.toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Phí giao hàng</span>
                  <span className="text-slate-800">{shippingFee.toLocaleString('vi-VN')}đ</span>
                </div>
                {appliedVoucher && (
                  <div className="flex justify-between font-bold text-green-600">
                    <span>Mã giảm giá ({appliedVoucher.code})</span>
                    <span>-{discountAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
                
                <div className="border-t border-slate-200 border-dashed pt-5 flex justify-between items-end mt-2">
                  <div>
                    <span className="block text-slate-800 font-bold">Tổng thanh toán</span>
                    <span className="text-[10px] text-slate-500">Đã bao gồm VAT (nếu có)</span>
                  </div>
                  <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
                    {totalAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              <button 
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full mt-8 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-lg py-4 px-6 rounded-2xl shadow-[0_8px_20px_rgba(249,115,22,0.3)] hover:shadow-[0_12px_25px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    <span>ĐANG XỬ LÝ...</span>
                  </>
                ) : (
                  <span>ĐẶT HÀNG NGAY</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Custom CSS for hiding scrollbar visually but keeping it functional */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e2e8f0;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
