'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Lightbulb,
  Building2,
  Check,
  LayoutGrid,
} from 'lucide-react';
import Swal from 'sweetalert2';

interface OrderItemInfo {
  name: string;
  optionsText?: string;
  quantity: number;
  price: number;
}

interface SepayConfigData {
  orderCode: string;
  amount: number;
  status: string;
  paymentStatus: string;
  isPaid: boolean;
  qrUrl: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  hasConfig: boolean;
  orderItems: OrderItemInfo[];
  subTotal: number;
  shippingFee: number;
  discountAmount: number;
  pointsUsed: number;
  pointRedeemRate?: number;
  pointsDiscount?: number;
  taxAmount?: number;
  vatPriceModeSnapshot?: string;
}

const BANK_BINS: Record<string, string> = {
  '970448': 'Ngân hàng TMCP Phương Đông',
  'OCB': 'Ngân hàng TMCP Phương Đông',
  '970422': 'Ngân hàng TMCP Quân đội',
  'MB': 'Ngân hàng TMCP Quân đội',
  '970415': 'Ngân hàng TMCP Công Thương VN',
  'ICB': 'Ngân hàng TMCP Công Thương VN',
  '970436': 'Ngân hàng TMCP Ngoại thương VN',
  'VCB': 'Ngân hàng TMCP Ngoại thương VN',
  '970418': 'Ngân hàng Đầu tư và Phát triển VN',
  'BIDV': 'Ngân hàng Đầu tư và Phát triển VN',
  '970405': 'Ngân hàng NN & PTNT VN',
  'VBA': 'Ngân hàng NN & PTNT VN',
  '970407': 'Ngân hàng TMCP Kỹ thương VN',
  'TCB': 'Ngân hàng TMCP Kỹ thương VN',
  '970416': 'Ngân hàng TMCP Á Châu',
  'ACB': 'Ngân hàng TMCP Á Châu',
  '970432': 'Ngân hàng TMCP VN Thịnh Vượng',
  'VPB': 'Ngân hàng TMCP VN Thịnh Vượng',
  '970423': 'Ngân hàng TMCP Tiên Phong',
  'TPB': 'Ngân hàng TMCP Tiên Phong',
  '970441': 'Ngân hàng TMCP Quốc tế VN',
  'VIB': 'Ngân hàng TMCP Quốc tế VN',
  '970403': 'Ngân hàng TMCP Sài Gòn Thương Tín',
  'STB': 'Ngân hàng TMCP Sài Gòn Thương Tín',
  '970437': 'Ngân hàng TMCP Phát triển TP.HCM',
  'HDB': 'Ngân hàng TMCP Phát triển TP.HCM',
  '970426': 'Ngân hàng TMCP Hàng Hải VN',
  'MSB': 'Ngân hàng TMCP Hàng Hải VN',
  '970409': 'Ngân hàng TMCP Đông Nam Á',
  'SEA': 'Ngân hàng TMCP Đông Nam Á',
};

const BANKING_APPS = [
  { id: 'icb', name: 'VietinBank', logo: 'https://upload.wikimedia.org/wikipedia/vi/9/9d/Logo_Vietinbank.png?utm_source=vi.wikipedia.org&utm_campaign=index&utm_content=original', hasAutoFill: true },
  { id: 'bidv', name: 'BIDV', logo: 'https://api.vietqr.io/img/BIDV.png', hasAutoFill: true },
  { id: 'vcb', name: 'Vietcombank', logo: 'https://api.vietqr.io/img/VCB.png', hasAutoFill: false },
  { id: 'tcb', name: 'Techcombank', logo: 'https://api.vietqr.io/img/TCB.png', hasAutoFill: false },
  { id: 'mb', name: 'MB Bank', logo: 'https://api.vietqr.io/img/MB.png', hasAutoFill: true },
  { id: 'acb', name: 'ACB', logo: 'https://api.vietqr.io/img/ACB.png', hasAutoFill: true },
  { id: 'vpb', name: 'VPBank', logo: 'https://api.vietqr.io/img/VPB.png', hasAutoFill: true },
  { id: 'tpb', name: 'TPBank', logo: 'https://api.vietqr.io/img/TPB.png', hasAutoFill: true },
  { id: 'vba', name: 'Agribank', logo: 'https://api.vietqr.io/img/VBA.png', hasAutoFill: true },
  { id: 'vib', name: 'VIB', logo: 'https://api.vietqr.io/img/VIB.png', hasAutoFill: true },
  { id: 'stb', name: 'Sacombank', logo: 'https://api.vietqr.io/img/STB.png', hasAutoFill: true },
  { id: 'ocb', name: 'OCB', logo: 'https://api.vietqr.io/img/OCB.png', hasAutoFill: true },
  { id: 'hdb', name: 'HDBank', logo: 'https://api.vietqr.io/img/HDB.png', hasAutoFill: true },
  { id: 'msb', name: 'MSB', logo: 'https://api.vietqr.io/img/MSB.png', hasAutoFill: true },
  { id: 'sea', name: 'SeABank', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Logo_SeABank.svg/3840px-Logo_SeABank.svg.png?utm_source=vi.wikipedia.org&utm_campaign=index&utm_content=thumbnail', hasAutoFill: true },
  { id: 'more', name: 'Xem thêm', logo: '', hasAutoFill: false },
];

export default function SePayCheckoutForm({ orderCode }: { orderCode: string }) {
  const router = useRouter();
  const [data, setData] = useState<SepayConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const isRedirectingRef = useRef(false);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0));
  };

  // 1. Fetch dữ liệu cấu hình SePay
  const fetchPaymentConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/payment/sepay/config?orderCode=${orderCode}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Không tìm thấy thông tin đơn hàng');
      }
      const config: SepayConfigData = await res.json();
      setData(config);

      if (config.isPaid) {
        handleSuccess();
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
    setIsPaidSuccess(true);

    let cd = 3;
    const interval = setInterval(() => {
      cd -= 1;
      setCountdown(cd);
      if (cd <= 0) {
        clearInterval(interval);
        window.location.href = `/checkout/success?orderCode=${orderCode}`;
      }
    }, 1000);
  };

  // 2. Polling mỗi 3000ms
  useEffect(() => {
    if (!orderCode) return;
    fetchPaymentConfig();

    const checkOrderStatus = async () => {
      if (isRedirectingRef.current) return;
      try {
        const res = await fetch(`/api/orders/check-status/${orderCode}?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.isPaid || resData.status === 'PAID' || resData.status === 'COMPLETED') {
            handleSuccess();
          } else if (resData.status === 'CANCELED') {
            window.location.href = `/orders`;
          }
        }
      } catch (e) {
        // Silent polling error
      }
    };

    const poller = setInterval(checkOrderStatus, 3000);
    pollerRef.current = poller;

    return () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
      }
    };
  }, [orderCode]);

  // Sao chép kèm Toast SweetAlert2
  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Đã sao chép: ' + text,
        showConfirmButton: false,
        timer: 1500,
        background: '#ef4444',
        color: '#fff',
        iconColor: '#fff',
        customClass: { popup: 'rounded shadow-md text-xs font-semibold' },
      });
    });
  };

  // Tải ảnh QR về máy
  const downloadQR = () => {
    if (!data?.qrUrl) return;
    fetch(data.qrUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `QR_ThanhToan_${orderCode}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(() => {
        window.open(data.qrUrl, '_blank');
      });
  };

  // Hủy thanh toán với Popup xác nhận
  const confirmCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    Swal.fire({
      title: 'Xác nhận hủy đơn?',
      text: 'Bạn có chắc chắn muốn hủy giao dịch thanh toán này không?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'Đồng ý hủy',
      cancelButtonText: 'Đóng',
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = '/orders';
      }
    });
  };

  // Xử lý khi bấm vào icon App Ngân Hàng
  const handleAppClick = (e: React.MouseEvent, appName: string, hasAutoFill: boolean, deepLink: string) => {
    if (!hasAutoFill) {
      e.preventDefault();
      downloadQR();
      Swal.fire({
        title: 'Đã tải mã QR!',
        html: `Hệ thống vừa tải ảnh QR về điện thoại của bạn.<br><br>Do ngân hàng <b>${appName}</b> không hỗ trợ điền tự động, vui lòng mở ứng dụng, chọn <b>Quét mã QR</b> và <b>tải lên ảnh vừa lưu</b> để thanh toán chính xác nhất.`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Mở app ' + appName,
        cancelButtonText: 'Đóng',
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = deepLink;
        }
      });
    } else {
      Swal.fire({
        title: `Đang mở ${appName}`,
        html: `Nếu điện thoại không tự mở ứng dụng hoặc báo lỗi, <br><b class="text-red-600">vui lòng tự mở app ngân hàng</b> và dùng tính năng quét mã QR!`,
        icon: 'info',
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Đã hiểu',
        timer: 6000,
        toast: true,
        position: 'top',
      });
    }
  };

  const showMoreApps = () => {
    Swal.fire({
      icon: 'info',
      title: 'Mở ứng dụng khác',
      text: 'Vui lòng mở ứng dụng ngân hàng trên điện thoại của bạn, chọn quét mã QR ở trên hoặc sao chép nội dung chuyển khoản.',
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Đóng',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-gray-600">Đang khởi tạo mã thanh toán...</p>
        </div>
      </div>
    );
  }

  const bankFullName = data?.bankCode ? (BANK_BINS[data.bankCode] || data.bankCode) : 'Ngân hàng';

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800 bg-[#f4f5f7]">
      {/* ── HEADER CỐ ĐỊNH (FIXED, Z-50) ── */}
      <header className="bg-white w-full border-b border-gray-200 flex justify-between items-center px-3 md:px-8 py-2 md:py-3 fixed top-0 left-0 z-50 shadow-sm h-[60px] md:h-[76px]">
        <img
          src="/avora_logo_ngang.png"
          alt="Avora Restaurant"
          className="h-10 md:h-16 object-contain px-2 py-1 rounded cursor-pointer"
          onClick={() => (window.location.href = '/')}
        />
        <div className="flex items-center justify-center">
          <img
            src="https://sepay.vn/assets/img/brand-assets/png/logo-sepay-color-in-white.png"
            alt="Sepay"
            className="h-10 md:h-16 object-contain"
          />
        </div>
      </header>

      {/* ── NỘI DUNG CHÍNH (MARGIN TOP ĐỂ KHÔNG BỊ HEADER ĐÈ) ── */}
      <div className="flex-1 flex justify-center p-2 md:p-4 md:py-10 mt-[60px] md:mt-[76px]">
        <div className="bg-white w-full max-w-[800px] shadow-sm border border-gray-200 h-fit md:rounded-lg" id="paymentCard">
          {/* MÀN HÌNH CHÚC MỪNG KHI THANH TOÁN THÀNH CÔNG */}
          {isPaidSuccess ? (
            <div className="w-full flex flex-col items-center justify-center py-16 px-4 animate-in zoom-in-95 duration-500 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-500 stroke-[3]" />
              </div>
              <h3 className="text-[20px] text-gray-800 font-semibold mb-1">Thanh Toán Thành Công!</h3>
              <p className="text-[14px] text-gray-500 mb-6">Đơn hàng của bạn đã được xác nhận.</p>
              <div className="text-red-500 font-medium text-[14px]">
                Chuyển hướng sau {countdown} giây...
              </div>
            </div>
          ) : (
            <>
              {/* CHI TIẾT ĐƠN HÀNG COLLAPSIBLE */}
              <div className="flex justify-between items-center px-4 py-3 md:px-6 md:py-4 border-b border-gray-100">
                <h2 className="text-[15px] md:text-[18px] font-medium md:font-normal text-gray-800">
                  Chi tiết đơn hàng
                </h2>
                <button
                  type="button"
                  onClick={() => setShowOrderDetails(!showOrderDetails)}
                  className="text-red-500 hover:text-red-600 font-medium text-[14px] md:text-[15px] transition-colors cursor-pointer"
                >
                  {showOrderDetails ? 'Thu gọn' : 'Xem'}
                </button>
              </div>

              {showOrderDetails && data && (
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 md:px-6 md:py-4 text-[13px] md:text-[14px]">
                  <ul className="space-y-2 text-gray-600 mb-2 border-b border-gray-200 border-dashed pb-3">
                    {data.orderItems && data.orderItems.length > 0 ? (
                      data.orderItems.map((item, idx) => (
                        <li key={idx} className="flex justify-between items-start gap-2">
                          <span className="flex-1">
                            {item.name}
                            {item.optionsText && (
                              <span className="block text-[11px] text-gray-400 italic">{item.optionsText}</span>
                            )}
                          </span>
                          <span className="font-medium text-gray-500">
                            x{item.quantity}
                          </span>
                          <span className="font-medium w-28 text-right text-gray-800">
                            {formatMoney(item.price)} đ
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-500 italic">Danh sách món trống.</li>
                    )}

                    {data.shippingFee > 0 && (
                      <li className="flex justify-between items-start gap-2 pt-1 text-gray-500">
                        <span className="flex-1">Phí vận chuyển</span>
                        <span className="font-medium w-28 text-right text-gray-800">
                          {formatMoney(data.shippingFee)} đ
                        </span>
                      </li>
                    )}

                    {data.discountAmount > 0 && (
                      <li className="flex justify-between items-start gap-2 pt-1 text-green-600">
                        <span className="flex-1">Ưu đãi giảm giá</span>
                        <span className="font-medium w-28 text-right text-green-600">
                          -{formatMoney(data.discountAmount)} đ
                        </span>
                      </li>
                    )}

                    {data.taxAmount !== undefined && data.taxAmount !== null && data.taxAmount > 0 && (
                      <li className="flex justify-between items-start gap-2 pt-1 text-gray-500">
                        <span className="flex-1">Thuế GTGT (VAT)</span>
                        <span className="font-medium w-28 text-right text-gray-800">
                          {data.vatPriceModeSnapshot === 'VAT_INCLUDED'
                            ? `Đã gồm (${formatMoney(data.taxAmount)} đ)`
                            : `+${formatMoney(data.taxAmount)} đ`}
                        </span>
                      </li>
                    )}

                    {data.pointsUsed > 0 && (
                      <li className="flex justify-between items-start gap-2 pt-1 text-green-600">
                        <span className="flex-1">Dùng điểm tích lũy ({data.pointsUsed.toLocaleString('vi-VN')} điểm)</span>
                        <span className="font-medium w-28 text-right text-green-600">
                          -{formatMoney(data.pointsDiscount !== undefined ? data.pointsDiscount : Math.round(data.pointsUsed * (data.pointRedeemRate && data.pointRedeemRate > 0 ? data.pointRedeemRate : 1)))} đ
                        </span>
                      </li>
                    )}
                  </ul>

                  <div className="flex justify-between items-center font-bold text-gray-900 mt-2">
                    <span>Tổng tiền (đã làm tròn):</span>
                    <span className="text-red-500 text-base md:text-lg">{formatMoney(data.amount)} đ</span>
                  </div>
                </div>
              )}

              {/* TIP BANNER VÀNG */}
              <div className="flex items-center justify-center gap-2 px-3 py-3 md:px-6 md:py-4 text-[12.5px] md:text-[14px] text-gray-800 text-center border-b border-gray-50 bg-[#fffdf0]">
                <Lightbulb className="w-5 h-5 text-yellow-500 shrink-0" />
                <p>
                  Mở App Ngân hàng bất kỳ để <strong>quét mã VietQR</strong> hoặc <strong>chuyển khoản</strong> chính xác thông tin bên dưới
                </p>
              </div>

              {/* THÂN CARD 2 CỘT */}
              <div className="flex flex-col md:flex-row p-4 md:p-8" id="mainContent">
                {/* CỘT TRÁI: QR CODE */}
                <div className="w-full md:w-1/2 flex flex-col items-center justify-start border-b md:border-b-0 md:border-r border-gray-100 pb-5 md:pb-0 md:pr-8">
                  {data?.hasConfig ? (
                    <div className="w-full max-w-[240px] md:max-w-[260px] flex flex-col items-center">
                      <img
                        src={data.qrUrl}
                        id="qrImage"
                        alt="Mã QR"
                        className="w-full h-auto object-contain block border border-gray-200 p-1 rounded"
                      />
                      <button
                        type="button"
                        onClick={downloadQR}
                        className="mt-3 md:mt-4 w-full flex items-center justify-center gap-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded font-medium transition-colors text-[13px] md:text-[14px] cursor-pointer"
                      >
                        <Download size={15} />
                        <span>Tải ảnh QR</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm text-center w-full max-w-[260px]">
                      <p className="font-bold">Hệ thống chưa cấu hình ngân hàng.</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={confirmCancel}
                    className="hidden md:block px-8 py-1.5 border border-gray-300 rounded text-[14px] text-gray-600 hover:bg-gray-50 transition-colors mt-8 cursor-pointer"
                  >
                    Huỷ thanh toán
                  </button>
                </div>

                {/* CỘT PHẢI: THÔNG TIN CHUYỂN KHOẢN */}
                <div className="w-full md:w-1/2 pt-5 md:pt-0 md:pl-8 flex flex-col justify-start">
                  {/* Ngân hàng */}
                  <div className="flex items-start gap-3 mb-4 md:mb-5">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="mt-0">
                      <p className="text-[12px] md:text-[13px] text-gray-500 mb-0.5 leading-none">Ngân hàng</p>
                      <p className="font-bold text-gray-900 text-[13.5px] md:text-[14px] leading-tight" id="bankNameDisplay">
                        {bankFullName}
                      </p>
                    </div>
                  </div>

                  {/* Chi tiết tài khoản */}
                  <div className="space-y-3.5 md:space-y-4">
                    <div>
                      <p className="text-[12px] md:text-[13px] text-gray-500 mb-0.5">Chủ tài khoản:</p>
                      <p className="font-bold text-gray-900 text-[13.5px] md:text-[14px] uppercase">
                        {data?.accountName}
                      </p>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[12px] md:text-[13px] text-gray-500 mb-0.5">Số tài khoản:</p>
                        <p className="font-bold text-gray-900 text-[13.5px] md:text-[14px]">
                          {data?.accountNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(data?.accountNumber || '')}
                        className="bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded text-[11px] md:text-[12px] font-semibold transition-colors shrink-0 cursor-pointer"
                      >
                        Sao chép
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[12px] md:text-[13px] text-gray-500 mb-0.5">Số tiền:</p>
                        <p className="font-bold text-gray-900 text-[13.5px] md:text-[14px]">
                          {formatMoney(data?.amount || 0)} vnd
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard((data?.amount || 0).toString())}
                        className="bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded text-[11px] md:text-[12px] font-semibold transition-colors shrink-0 cursor-pointer"
                      >
                        Sao chép
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[12px] md:text-[13px] text-gray-500 mb-0.5">Nội dung:</p>
                        <p className="font-bold text-gray-900 text-[13.5px] md:text-[14px]">
                          {data?.orderCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(data?.orderCode || '')}
                        className="bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded text-[11px] md:text-[12px] font-semibold transition-colors shrink-0 cursor-pointer"
                      >
                        Sao chép
                      </button>
                    </div>
                  </div>

                  {/* Lời nhắc */}
                  <div className="mt-5 md:mt-6 pt-3 md:pt-4 text-[12.5px] md:text-[13.5px] text-gray-800 leading-relaxed border-t border-gray-100">
                    Lưu ý : Nhập chính xác số tiền <strong>{formatMoney(data?.amount || 0)}</strong>, nội dung <strong>{data?.orderCode}</strong> khi chuyển khoản
                  </div>

                  {/* SECTION APP NGÂN HÀNG TRÊN MOBILE */}
                  <div className="mt-6 md:mt-8 block md:hidden border-t border-gray-100 pt-5">
                    <h3 className="text-[13px] font-medium text-gray-800 text-center mb-4 px-2 leading-relaxed">
                      Nhấn vào logo ngân hàng để thanh toán trực tiếp trên ứng dụng
                    </h3>
                    <div className="grid grid-cols-4 gap-x-2 gap-y-4 justify-items-center">
                      {BANKING_APPS.map((app) => {
                        const redirectUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
                        const deepLink = `https://dl.vietqr.io/pay?app=${app.id}&ba=${data?.accountNumber}@${data?.bankCode}&bn=${encodeURIComponent(data?.accountName || '')}&am=${data?.amount}&tn=${encodeURIComponent(data?.orderCode || '')}&redirect_url=${redirectUrl}`;

                        if (app.id === 'more') {
                          return (
                            <a
                              key={app.id}
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                showMoreApps();
                              }}
                              className="flex flex-col items-center w-full px-1"
                            >
                              <div className="relative w-full aspect-square border border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 transition-all active:scale-90">
                                <LayoutGrid className="w-6 h-6 text-gray-400" />
                              </div>
                              <span className="text-[10px] text-gray-700 mt-1.5 font-medium text-center truncate w-full">
                                {app.name}
                              </span>
                            </a>
                          );
                        }

                        return (
                          <a
                            key={app.id}
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => handleAppClick(e, app.name, app.hasAutoFill, deepLink)}
                            className="flex flex-col items-center w-full px-1"
                          >
                            <div className="relative w-full aspect-square border border-gray-200 rounded-xl flex items-center justify-center bg-white p-1.5 transition-all active:scale-90 overflow-hidden">
                              {app.hasAutoFill && (
                                <div className="absolute top-0 right-0 w-10 h-10 overflow-hidden pointer-events-none">
                                  <div className="absolute top-[7px] -right-[18px] rotate-45 bg-[#22c55e] text-white text-[5px] font-bold py-[2px] px-[18px] text-center shadow-xs whitespace-nowrap leading-none">
                                    Tự động điền
                                  </div>
                                </div>
                              )}
                              <img src={app.logo} alt={app.name} className="w-[90%] h-[90%] object-contain rounded" />
                            </div>
                            <span className="text-[10px] text-gray-700 mt-1.5 font-medium text-center truncate w-full">
                              {app.name}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>

                  {/* NÚT HỦY TRÊN MOBILE */}
                  <div className="mt-8 text-center md:hidden w-full">
                    <button
                      type="button"
                      onClick={confirmCancel}
                      className="inline-block px-10 py-2 border border-gray-300 rounded-lg text-[14px] text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer mb-2 font-medium"
                    >
                      Huỷ thanh toán
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
