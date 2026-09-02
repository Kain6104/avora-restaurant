'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, ShoppingBag, Clock, CreditCard, User, 
  Store, AlertCircle, FileText, CheckCircle2, Truck, Package, XCircle, Printer, MapPin, Star
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface OrderItem {
  id: string;
  quantity: number;
  priceAtSale: number;
  optionsTextSnapshot?: string;
  note?: string;
  isFlashSaleItem: boolean;
  product?: { name: string; imageUrl?: string };
}

interface Order {
  id: string;
  orderCode: string;
  totalAmount: number;
  subTotal: number;
  shippingFee: number;
  discountAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
  note: string;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string;
  branch?: { name: string; street?: string; ward?: string; district?: string; province?: string };
  orderItems?: OrderItem[];
  voucher?: { code: string; discountType: string; discountValue: number };
  cancelReason?: string;
  canceledBy?: string;
  user?: { id?: string; fullName?: string; email?: string; phone?: string };
  
  // VAT Fields
  isInvoiceRequested: boolean;
  invoiceCompanyName?: string;
  invoiceTaxCode?: string;
  invoiceAddress?: string;
  invoiceEmail?: string;
  
  // Extra fields
  transactionId?: string;
  pointsUsed?: number;
  pointsAwarded?: number;
  latitude?: number;
  longitude?: number;
  confirmedAt?: string;
  deliveringAt?: string;
  deliveredAt?: string;
  canceledAt?: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock size={16} />,
  CONFIRMED: <CheckCircle2 size={16} />,
  PREPARING: <Package size={16} />,
  DELIVERING: <Truck size={16} />,
  COMPLETED: <ShoppingBag size={16} />,
  CANCELLED: <XCircle size={16} />,
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  DELIVERING: 'Đang giao',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  PREPARING: 'bg-purple-100 text-purple-800 border-purple-200',
  DELIVERING: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_WEIGHTS: Record<string, number> = {
  PENDING: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  DELIVERING: 4,
  COMPLETED: 5,
  CANCELLED: 99,
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string>('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.data);
      } else {
        toast.error('Không tìm thấy đơn hàng');
        router.push('/admin/orders');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi tải chi tiết đơn hàng');
      router.push('/admin/orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    if (!order) return;
    
    // Yêu cầu xác nhận bằng cách nhập đúng tên trạng thái
    const confirmInput = window.prompt(`Để đổi trạng thái sang "${newStatus}", vui lòng nhập chính xác từ: ${newStatus}`);
    
    if (confirmInput !== newStatus) {
      toast.error('Xác nhận không khớp. Hủy thao tác.');
      return;
    }

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success(`Đã cập nhật trạng thái thành ${newStatus}`);
        setOrder({ ...order, status: newStatus });
      } else {
        const error = await res.json();
        toast.error(error.message || 'Lỗi cập nhật trạng thái');
      }
    } catch (error) {
      toast.error('Lỗi kết nối');
    }
  };

  const updateOrderPaymentStatus = async (newPaymentStatus: string) => {
    if (!order) return;
    
    if (!window.confirm(`Xác nhận đổi trạng thái thanh toán thành: ${newPaymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/payment-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newPaymentStatus }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success(`Đã cập nhật thanh toán`);
        setOrder({ ...order, paymentStatus: newPaymentStatus });
      } else {
        const error = await res.json();
        toast.error(error.message || 'Lỗi cập nhật thanh toán');
      }
    } catch (error) {
      toast.error('Lỗi kết nối');
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getPaymentMethodLabel = (pm: string) => {
    switch (pm) {
      case 'COD': return 'Thanh toán khi nhận hàng (COD)';
      case 'MOMO': return 'Ví MoMo';
      case 'VNPAY': return 'VNPay';
      case 'BANK_TRANSFER': return 'Chuyển khoản ngân hàng';
      default: return pm;
    }
  };

  if (loading || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500 gap-4">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-medium">Đang tải chi tiết đơn hàng...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 bg-white border shadow-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="text-red-600" />
              Chi Tiết Đơn Hàng
            </h1>
            <p className="text-gray-500 font-mono text-sm mt-1">
              #{(order.orderCode || order.id.split('-')[0]).toUpperCase()}
            </p>
          </div>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-white border shadow-sm rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
        >
          <Printer size={18} /> In hóa đơn
        </button>
      </div>

      <div className="space-y-6">
        {order.status === 'CANCELLED' && (
          <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-xl shadow-sm flex items-start gap-3">
            <AlertCircle size={24} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900 text-lg mb-1">Đơn hàng đã bị hủy</h3>
              <p className="font-medium">Người hủy: <span className="font-bold">{order.canceledBy || 'Khách hàng'}</span></p>
              {order.cancelReason && (
                <p className="mt-1">Lý do: <span className="italic">{order.cancelReason}</span></p>
              )}
            </div>
          </div>
        )}

        {/* Grid 2 Cột */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Thông tin khách hàng */}
          <div className="bg-white p-5 rounded-xl border shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center gap-2 text-gray-800 font-bold">
                <User size={18} className="text-blue-500" /> Khách Hàng
              </div>
              {order.user?.id && (
                <button 
                  onClick={() => router.push(`/admin/users/${order.user?.id}`)}
                  className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 font-medium transition-colors"
                >
                  Xem hồ sơ
                </button>
              )}
            </div>
            <div className="text-sm space-y-1">
              <p><span className="text-gray-500">Họ Tên:</span> <span className="font-medium text-gray-900">{order.user?.fullName || order.customerName || 'N/A'}</span></p>
              <p><span className="text-gray-500">SĐT:</span> <span className="font-medium text-gray-900">{order.user?.phone || order.customerPhone || 'N/A'}</span></p>
              {order.user?.email && <p><span className="text-gray-500">Email:</span> <span className="font-medium text-gray-900">{order.user.email}</span></p>}
              <div className="pt-2 mt-2 border-t">
                <p className="text-gray-500 mb-1">Địa chỉ giao hàng:</p>
                <p className="font-medium text-gray-900">{order.deliveryAddress || 'Nhận tại cửa hàng'}</p>
                {(order.latitude && order.longitude) && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 font-bold mt-1 hover:underline"
                  >
                    <MapPin size={12} /> Xem trên bản đồ
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Thông tin cửa hàng & Thời gian */}
          <div className="bg-white p-5 rounded-xl border shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-gray-800 font-bold border-b pb-2">
              <Store size={18} className="text-red-500" /> Cửa Hàng & Thời Gian
            </div>
            <div className="text-sm space-y-2">
              <p className="flex items-start gap-2">
                <Store size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <span className="font-medium text-gray-900">
                  {order.branch?.name || 'Chi nhánh mặc định'}
                  {order.branch?.street && <span className="block text-gray-500 font-normal text-xs">{order.branch.street}, {order.branch.district}</span>}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <span className="text-gray-700">{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
              </p>
              {order.note ? (
                <div className="bg-yellow-50 p-2 rounded text-yellow-800 border border-yellow-100 flex items-start gap-2 mt-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="italic">"{order.note}"</p>
                </div>
              ) : (
                <div className="bg-gray-50 p-2 rounded text-gray-500 border border-gray-100 flex items-start gap-2 mt-2">
                  <p className="italic text-xs">Không có ghi chú từ khách hàng</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* VAT Information - Yêu cầu xuất hóa đơn đỏ */}
        <div className={`p-5 rounded-xl border shadow-sm ${order.isInvoiceRequested ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`flex items-center gap-2 font-bold border-b pb-3 mb-4 ${order.isInvoiceRequested ? 'text-indigo-900 border-blue-200' : 'text-gray-700 border-gray-300'}`}>
            <FileText size={18} className={order.isInvoiceRequested ? 'text-indigo-600' : 'text-gray-500'} /> Yêu Cầu Xuất Hóa Đơn VAT
          </div>
          
          {order.isInvoiceRequested ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div>
                <p className="text-indigo-700/70 text-xs font-bold uppercase mb-1">Tên Công Ty</p>
                <p className="font-bold text-gray-900">{order.invoiceCompanyName || 'Không có'}</p>
              </div>
              <div>
                <p className="text-indigo-700/70 text-xs font-bold uppercase mb-1">Mã Số Thuế</p>
                <p className="font-bold text-gray-900">{order.invoiceTaxCode || 'Không có'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-indigo-700/70 text-xs font-bold uppercase mb-1">Địa Chỉ Hóa Đơn</p>
                <p className="font-medium text-gray-900">{order.invoiceAddress || 'Không có'}</p>
              </div>
              <div>
                <p className="text-indigo-700/70 text-xs font-bold uppercase mb-1">Email Nhận Hóa Đơn</p>
                <p className="font-medium text-gray-900">{order.invoiceEmail || 'Không có'}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 italic text-sm">Khách hàng không yêu cầu xuất hóa đơn VAT cho đơn hàng này.</p>
          )}
        </div>

        {/* Thanh toán & Hóa đơn */}
        <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-800 font-bold border-b pb-3 mb-2">
              <CreditCard size={18} className="text-green-500" /> Thanh Toán
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Tạm tính:</span>
              <span className="font-medium">{formatMoney(order.subTotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Phí giao hàng:</span>
              <span className="font-medium">{formatMoney(order.shippingFee || 0)}</span>
            </div>
            
            {(order.discountAmount > 0 || order.voucher) && (
              <div className="flex justify-between items-center text-red-600">
                <span className="flex items-center gap-1">
                  <FileText size={14} /> 
                  Khuyến mãi {order.voucher ? `(${order.voucher.code})` : ''}:
                </span>
                <span className="font-medium">- {formatMoney(order.discountAmount)}</span>
              </div>
            )}

            {order.pointsUsed && order.pointsUsed > 0 ? (
              <div className="flex justify-between items-center text-orange-600">
                <span className="flex items-center gap-1">
                  <Star size={14} /> Điểm đã dùng ({order.pointsUsed}):
                </span>
                <span className="font-medium">- {formatMoney(order.pointsUsed * 1000)}</span>
              </div>
            ) : null}
            
            <div className="pt-3 border-t flex justify-between items-center">
              <span className="text-gray-800 font-bold text-base">Tổng Thành Tiền:</span>
              <span className="text-red-600 font-black text-xl">{formatMoney(order.totalAmount)}</span>
            </div>
            
            {order.pointsAwarded && order.pointsAwarded > 0 ? (
              <div className="flex justify-end text-green-600 text-xs font-bold items-center gap-1">
                <Star size={12} /> Tích lũy được: +{order.pointsAwarded} điểm
              </div>
            ) : null}
          </div>
          
          <div className="md:w-1/3 bg-gray-50 p-4 rounded-lg border flex flex-col justify-center space-y-4">
            <div>
              <p className="text-gray-500 text-[10px] mb-1 uppercase font-bold">Phương thức</p>
              <div className="font-medium text-gray-900 bg-white border inline-block px-3 py-1.5 rounded-lg text-sm">
                {getPaymentMethodLabel(order.paymentMethod)}
              </div>
              {order.transactionId && (
                <p className="text-xs text-gray-500 mt-1 font-mono">Mã GD: {order.transactionId}</p>
              )}
            </div>
            <div>
              <p className="text-gray-500 text-[10px] mb-1 uppercase font-bold">Trạng thái thanh toán</p>
              <select 
                value={order.paymentStatus}
                onChange={(e) => updateOrderPaymentStatus(e.target.value)}
                disabled={order.status === 'CANCELLED'}
                className={`w-full font-bold px-3 py-2 rounded-lg text-sm border outline-none ${
                  order.paymentStatus === 'PAID' 
                    ? 'bg-green-50 text-green-700 border-green-200 focus:ring-green-500' 
                    : 'bg-yellow-50 text-yellow-700 border-yellow-200 focus:ring-yellow-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="UNPAID">Chưa thanh toán</option>
                <option value="PAID">Đã thanh toán</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chi tiết món */}
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 text-gray-800 font-bold border-b pb-3 mb-4">
            <ShoppingBag size={18} className="text-orange-500" /> Các Món Đã Đặt
          </div>
          <div className="space-y-4">
            {order.orderItems?.map((item: any) => (
              <div key={item.id} className="flex gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border shrink-0">
                  {item.product?.imageUrl ? (
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-gray-900 truncate">{item.product?.name}</h4>
                    <p className="font-black text-gray-900 shrink-0">
                      {formatMoney(item.priceAtSale)}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-sm text-gray-500">
                      {item.optionsTextSnapshot ? (
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{item.optionsTextSnapshot}</span>
                      ) : 'Không có tùy chọn'}
                      {item.isFlashSaleItem && (
                        <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold">⚡ Flash Sale</span>
                      )}
                    </div>
                    <div className="font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      x{item.quantity}
                    </div>
                  </div>
                  {item.note && (
                    <p className="text-xs italic text-gray-500 mt-2 flex gap-1 items-start">
                      <span className="text-gray-400">Ghi chú:</span> {item.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 text-gray-800 font-bold border-b pb-3 mb-4">
            <Clock size={18} className="text-blue-500" /> Tiến Trình Đơn Hàng
          </div>
          <div className="flex flex-col md:flex-row gap-4 justify-between relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>
            
            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-sm shadow-sm ring-4 ring-white">1</div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-800">Đặt Hàng</p>
                <p className="text-[10px] text-gray-500">{new Date(order.createdAt).toLocaleString('vi-VN')}</p>
              </div>
            </div>
            
            <div className={`flex flex-col items-center gap-2 bg-white px-2 ${!order.confirmedAt ? 'opacity-40' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white ${order.confirmedAt ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>2</div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-800">Xác Nhận</p>
                <p className="text-[10px] text-gray-500">{order.confirmedAt ? new Date(order.confirmedAt).toLocaleString('vi-VN') : '--'}</p>
              </div>
            </div>
            
            <div className={`flex flex-col items-center gap-2 bg-white px-2 ${!order.deliveringAt ? 'opacity-40' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white ${order.deliveringAt ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>3</div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-800">Giao Hàng</p>
                <p className="text-[10px] text-gray-500">{order.deliveringAt ? new Date(order.deliveringAt).toLocaleString('vi-VN') : '--'}</p>
              </div>
            </div>
            
            <div className={`flex flex-col items-center gap-2 bg-white px-2 ${!order.deliveredAt ? 'opacity-40' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white ${order.deliveredAt ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>4</div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-800">Hoàn Thành</p>
                <p className="text-[10px] text-gray-500">{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString('vi-VN') : '--'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quản lý Trạng Thái Order */}
        {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
          <div className="bg-white p-5 rounded-xl border-2 border-red-100 shadow-sm">
            <div className="flex items-center gap-2 text-gray-800 font-bold border-b pb-3 mb-4">
              <AlertCircle size={18} className="text-red-500" /> Đổi Trạng Thái Đơn Hàng
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-100 mb-4 text-sm text-red-800">
              <strong>Lưu ý:</strong> Đơn hàng chỉ có thể đi tới, không thể lùi trạng thái.
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(STATUS_LABELS).map(s => {
                const isCurrent = order.status === s;
                const isLocked = STATUS_WEIGHTS[s] < STATUS_WEIGHTS[order.status];
                
                return (
                <button 
                  key={s}
                  onClick={() => updateOrderStatus(s)}
                  disabled={isLocked || isCurrent}
                  className={`px-4 py-2.5 rounded-lg text-sm font-bold border-2 transition-all flex items-center gap-1.5 ${
                    isCurrent 
                      ? STATUS_COLORS[s] + ' ring-2 ring-offset-2 ring-gray-300' 
                      : isLocked
                        ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {STATUS_ICONS[s]} {s}
                </button>
              )})}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
