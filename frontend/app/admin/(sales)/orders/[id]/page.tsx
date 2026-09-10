'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShoppingBag,
  Clock,
  CreditCard,
  User as UserIcon,
  Store,
  AlertCircle,
  FileText,
  CheckCircle2,
  Truck,
  Package,
  XCircle,
  Printer,
  MapPin,
  Star,
  Check,
  Building2,
  Phone,
  Mail,
  Zap,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  AdminCard,
  PageHeader,
  StatusBadge,
  ConfirmDialog,
} from '@/app/admin/components/ui';
import { printOrderInvoice } from '@/lib/utils/print-order';

interface OrderItem {
  id: string;
  quantity: number;
  priceAtSale: number;
  optionsTextSnapshot?: string;
  note?: string;
  isFlashSaleItem: boolean;
  product?: { name: string; imageUrl?: string };
}

interface OrderServiceChargeItem {
  id: string;
  name: string;
  amount: number;
  note?: string;
  createdBy?: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderCode?: string;
  temporaryOrderCode?: string;
  totalAmount: number;
  subTotal: number;
  shippingFee: number;
  discountAmount: number;
  shippingDiscount?: number;
  serviceChargeTotal?: number;
  taxAmount?: number;
  vatPriceModeSnapshot?: string;
  deliveryDistanceMeters?: number;
  deliveryDurationSeconds?: number;
  shippingProvider?: string;
  shippingCalculatedAt?: string;
  discountVoucherCodeSnapshot?: string;
  shippingVoucherCodeSnapshot?: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  orderSource?: string;
  orderType?: string;
  createdAt: string;
  note: string;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string;
  table?: { id: string; name: string; area?: { name: string } };
  branch?: { name: string; street?: string; ward?: string; district?: string; province?: string; pointRedeemRate?: number };
  orderItems?: OrderItem[];
  voucher?: { code: string; discountType: string; discountValue: number };
  shippingVoucher?: { code: string; discountType: string; discountValue: number };
  serviceCharges?: OrderServiceChargeItem[];
  cancelReason?: string;
  canceledBy?: string;
  user?: { id?: string; fullName?: string; email?: string; phone?: string };

  isInvoiceRequested: boolean;
  invoiceCompanyName?: string;
  invoiceTaxCode?: string;
  invoiceAddress?: string;
  invoiceEmail?: string;

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

const STATUS_WEIGHTS: Record<string, number> = {
  PENDING: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  DELIVERING: 4,
  COMPLETED: 5,
  CANCELLED: 99,
};

const STATUS_OPTIONS = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'DELIVERING',
  'COMPLETED',
  'CANCELLED',
] as const;

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const id = resolvedParams.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  // Status confirm modal state
  const [targetStatus, setTargetStatus] = useState<string | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

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

  const handleOpenStatusModal = (status: string) => {
    setTargetStatus(status);
    setIsStatusModalOpen(true);
  };

  const confirmUpdateStatus = async () => {
    if (!order || !targetStatus) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(`Cập nhật trạng thái thành công`);
        setOrder({ ...order, status: targetStatus });
        setIsStatusModalOpen(false);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Lỗi cập nhật trạng thái');
      }
    } catch (error) {
      toast.error('Lỗi kết nối');
    } finally {
      setStatusLoading(false);
    }
  };

  const updateOrderPaymentStatus = async (newPaymentStatus: string) => {
    if (!order) return;
    if (order.paymentMethod === 'SEPAY' && order.paymentStatus === 'PAID') {
      toast.error('Đơn hàng SePay đã được tự động xác nhận tiền về tài khoản, không thể sửa đổi thủ công!');
      return;
    }
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/payment-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newPaymentStatus }),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Đã cập nhật trạng thái thanh toán');
        setOrder({ ...order, paymentStatus: newPaymentStatus });
      } else {
        const err = await res.json();
        toast.error(err.message || 'Lỗi cập nhật thanh toán');
      }
    } catch (error) {
      toast.error('Lỗi kết nối');
    }
  };

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getPaymentMethodLabel = (pm: string) => {
    switch (pm) {
      case 'COD':
        return 'Thanh toán khi nhận hàng (COD)';
      case 'SEPAY':
        return 'Chuyển khoản SePay (Xác nhận tự động)';
      case 'VIETQR':
        return 'Chuyển khoản VietQR';
      case 'PAYOS':
        return 'Cổng thanh toán PayOS';
      case 'MOMO':
        return 'Ví điện tử MoMo';
      case 'VNPAY':
        return 'Cổng VNPay';
      case 'BANK_TRANSFER':
      case 'TRANSFER':
        return 'Chuyển khoản ngân hàng';
      case 'CASH':
        return 'Tiền mặt tại quầy (Cash)';
      case 'CARD':
        return 'Quẹt thẻ ngân hàng (POS)';
      default:
        return pm || 'Chưa chọn';
    }
  };

  if (loading || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-3">
        <div className="w-9 h-9 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Đang tải chi tiết đơn hàng...
        </p>
      </div>
    );
  }

  const isPosOrder = order.orderSource === 'POS';
  const orderCodeDisplay = (order.orderCode || order.temporaryOrderCode || order.id.slice(0, 8)).toUpperCase();

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title={isPosOrder ? `Đơn bán tại quầy #${orderCodeDisplay}` : `Chi tiết đơn hàng online #${orderCodeDisplay}`}
        subtitle={`Tạo lúc: ${new Date(order.createdAt).toLocaleString('vi-VN')}`}
        breadcrumbs={[
          { label: 'Bán hàng', href: '/admin/orders' },
          { label: 'Đơn hàng', href: '/admin/orders' },
          { label: `#${orderCodeDisplay}` },
        ]}
        badge={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={order.status} size="lg" />
            {isPosOrder ? (
              <>
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                  <Store size={13} />
                  <span>ĐƠN POS TẠI QUẦY</span>
                </span>
                {order.temporaryOrderCode && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Mã tạm: {order.temporaryOrderCode}
                  </span>
                )}
                {order.orderCode && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Mã HĐ: {order.orderCode}
                  </span>
                )}
                {order.table?.name ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                    <span>Bàn: {order.table.name}{order.table.area?.name ? ` (${order.table.area.name})` : ''}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    Bán mang về tại quầy
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <ShoppingBag size={13} />
                  <span>ĐƠN ONLINE (WEB/APP)</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Truck size={13} />
                  <span>Giao hàng tận nơi</span>
                </span>
              </>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Quay lại"
              className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs transition-colors"
            >
              <ArrowLeft size={15} />
              <span>Quay lại</span>
            </button>
            <button
              type="button"
              disabled={printing}
              onClick={() =>
                printOrderInvoice(
                  { ...order, orderCode: order.orderCode || order.temporaryOrderCode || order.id.slice(0, 8) },
                  () => setPrinting(true),
                  () => setPrinting(false)
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Printer size={15} className={printing ? 'animate-spin' : ''} />
              <span>{printing ? 'Đang nạp...' : 'In hóa đơn'}</span>
            </button>
          </div>
        }
      />

      {/* Cancellation Notice */}
      {order.status === 'CANCELLED' && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl shadow-xs flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <h4 className="font-bold text-rose-900">Đơn hàng đã bị hủy</h4>
            <p className="text-rose-700 mt-0.5">
              Người hủy: <strong className="font-semibold">{order.canceledBy || 'Khách hàng'}</strong>
            </p>
            {order.cancelReason && (
              <p className="text-rose-600 italic mt-1">Lý do: &quot;{order.cancelReason}&quot;</p>
            )}
          </div>
        </div>
      )}

      {/* Grid: Customer & Branch Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
        {/* Khách hàng / Phục vụ */}
        <AdminCard
          title={isPosOrder ? 'Thông tin phục vụ tại bàn' : 'Thông tin người nhận hàng'}
          icon={<UserIcon size={16} />}
          action={
            order.user?.id && (
              <button
                type="button"
                onClick={() => router.push(`/admin/users/${order.user?.id}`)}
                className="text-xs text-red-600 font-bold hover:underline"
              >
                Hồ sơ khách
              </button>
            )
          }
        >
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-50">
              <span className="text-slate-400 font-medium">
                {isPosOrder ? 'Khách hàng / Đại diện:' : 'Người nhận:'}
              </span>
              <span className="font-bold text-slate-800">
                {order.user?.fullName || order.customerName || (isPosOrder ? 'Khách vãng lai tại quầy' : 'Khách vãng lai')}
              </span>
            </div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Số điện thoại:</span>
              <span className="font-semibold text-slate-700">
                {order.customerPhone || order.user?.phone || 'Chưa cập nhật'}
              </span>
            </div>
            {order.user?.email && (
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Email:</span>
                <span className="font-medium text-slate-700">{order.user.email}</span>
              </div>
            )}

            {/* Chỉ hiển thị địa chỉ giao hàng và tọa độ đối với đơn ONLINE */}
            {!isPosOrder ? (
              <div className="pt-1">
                <span className="text-slate-400 font-medium block text-xs">Địa chỉ giao hàng:</span>
                <p className="font-semibold text-slate-800 mt-1 leading-relaxed">
                  {order.deliveryAddress || 'Chưa cập nhật địa chỉ'}
                </p>
                {order.deliveryDistanceMeters !== undefined && order.deliveryDistanceMeters !== null && (
                  <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span className="font-medium">
                      Quãng đường thực tế: <strong>{(order.deliveryDistanceMeters / 1000).toFixed(1)} km</strong>
                      {order.deliveryDurationSeconds ? ` (~${Math.round(order.deliveryDurationSeconds / 60)} phút)` : ''}
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                      {order.shippingProvider || 'OSRM'}
                    </span>
                  </div>
                )}
                {order.latitude && order.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 font-bold mt-1.5 hover:underline"
                  >
                    <MapPin size={13} />
                    <span>Xem vị trí giao hàng trên Google Maps</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="pt-1">
                <span className="text-slate-400 font-medium block text-xs">Hình thức phục vụ:</span>
                <p className="font-bold text-slate-800 mt-1">
                  {order.table?.name
                    ? `Ăn tại chỗ - Bàn ${order.table.name}${order.table.area?.name ? ` (${order.table.area.name})` : ''}`
                    : 'Bán mang đi tại quầy (Takeaway)'}
                </p>
              </div>
            )}
          </div>
        </AdminCard>

        {/* Chi nhánh & Ghi chú */}
        <AdminCard title="Chi nhánh & Ghi chú" icon={<Store size={16} />}>
          <div className="space-y-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5 pb-2 border-b border-slate-50">
              <Store size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">
                  {order.branch?.name || 'Chi nhánh AVORA'}
                </p>
                {order.branch?.street && (
                  <p className="text-xs text-slate-400 font-normal mt-0.5">
                    {order.branch.street}, {order.branch.district}, {order.branch.province}
                  </p>
                )}
              </div>
            </div>

            {/* Thông tin phục vụ */}
            <div className="flex items-start gap-2.5 pb-2 border-b border-slate-50">
              <Building2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">
                  {isPosOrder
                    ? (order.table?.name ? `Bàn phục vụ: ${order.table.name}` : 'Bán mang đi tại quầy')
                    : 'Đơn giao hàng tận nơi (Online Delivery)'}
                </p>
                <p className="text-xs text-slate-400 font-normal mt-0.5">
                  Nguồn đơn: {isPosOrder ? 'Tạo tại POS nhà hàng' : 'Khách tự đặt qua Website/App'}
                </p>
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-medium block text-xs mb-1">
                Ghi chú đơn hàng:
              </span>
              {order.note ? (
                <div className="bg-amber-50/80 p-2.5 rounded-xl text-amber-900 border border-amber-100 text-xs italic">
                  &quot;{order.note}&quot;
                </div>
              ) : (
                <p className="text-slate-400 italic text-xs">Không có ghi chú nào.</p>
              )}
            </div>
          </div>
        </AdminCard>
      </div>

      {/* VAT Invoice Section */}
      <AdminCard
        title="Thông tin hóa đơn VAT"
        icon={<FileText size={16} />}
        badge={
          order.isInvoiceRequested ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              CÓ YÊU CẦU XUẤT VAT
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500">
              KHÔNG YÊU CẦU
            </span>
          )
        }
      >
        {order.isInvoiceRequested ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
            <div>
              <span className="text-slate-400 font-medium block text-xs">Tên công ty:</span>
              <p className="font-bold text-slate-900 mt-0.5">{order.invoiceCompanyName || '-'}</p>
            </div>
            <div>
              <span className="text-slate-400 font-medium block text-xs">Mã số thuế:</span>
              <p className="font-bold text-slate-900 mt-0.5">{order.invoiceTaxCode || '-'}</p>
            </div>
            <div className="md:col-span-2">
              <span className="text-slate-400 font-medium block text-xs">Địa chỉ công ty:</span>
              <p className="font-medium text-slate-800 mt-0.5">{order.invoiceAddress || '-'}</p>
            </div>
            <div>
              <span className="text-slate-400 font-medium block text-xs">Email nhận hóa đơn:</span>
              <p className="font-semibold text-slate-800 mt-0.5">{order.invoiceEmail || '-'}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            Đơn hàng này khách hàng không tick chọn yêu cầu xuất hóa đơn đỏ (VAT).
          </p>
        )}
      </AdminCard>

      {/* Payment & Amount Summary */}
      <AdminCard title="Thanh toán & Chi phí" icon={<CreditCard size={16} />}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-slate-600">
              <span>Tạm tính tiền món:</span>
              <span className="font-semibold text-slate-800">{formatMoney(order.subTotal)}</span>
            </div>

            {/* Phân biệt hiển thị phí vận chuyển cho ONLINE và phụ thu cho POS */}
            {!isPosOrder ? (
              <>
                <div className="flex justify-between items-center text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span>Phí vận chuyển gốc:</span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                      {order.shippingProvider || 'GrabExpress'}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-800">{formatMoney(order.shippingFee)}</span>
                </div>

                {((order.shippingDiscount || 0) > 0 || order.shippingVoucher || order.shippingVoucherCodeSnapshot) && (
                  <div className="flex justify-between items-center text-emerald-600">
                    <span>
                      Voucher Freeship{' '}
                      {order.shippingVoucherCodeSnapshot
                        ? `(${order.shippingVoucherCodeSnapshot})`
                        : order.shippingVoucher
                        ? `(${order.shippingVoucher.code})`
                        : ''}
                      :
                    </span>
                    <span className="font-bold">- {formatMoney(order.shippingDiscount || 0)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-700 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="font-medium">Phí giao hàng khách thực trả:</span>
                  <span className="font-bold text-slate-900">
                    {formatMoney(Math.max(0, order.shippingFee - (order.shippingDiscount || 0)))}
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Đơn POS: Hiển thị danh sách phụ thu và phí dịch vụ tùy chỉnh */}
                {order.serviceCharges && order.serviceCharges.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-indigo-700 font-bold">
                      <span>Phụ thu & Phí dịch vụ:</span>
                      <span>+ {formatMoney(order.serviceChargeTotal || 0)}</span>
                    </div>
                    <div className="pl-3 border-l-2 border-indigo-200 space-y-1 text-xs text-slate-600">
                      {order.serviceCharges.map((sc) => (
                        <div key={sc.id} className="flex justify-between items-center">
                          <span>
                            • {sc.name}
                            {sc.note ? <span className="text-slate-400 italic"> ({sc.note})</span> : ''}:
                          </span>
                          <span className="font-semibold text-slate-800">+{formatMoney(sc.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (order.serviceChargeTotal || 0) > 0 ? (
                  <div className="flex justify-between items-center text-indigo-700 font-bold">
                    <span>Phụ thu & Phí dịch vụ:</span>
                    <span>+ {formatMoney(order.serviceChargeTotal || 0)}</span>
                  </div>
                ) : null}
              </>
            )}

            {(order.discountAmount > 0 || order.voucher || order.discountVoucherCodeSnapshot) && (
              <div className="flex justify-between items-center text-red-600">
                <span>
                  Voucher giảm giá món{' '}
                  {order.discountVoucherCodeSnapshot
                    ? `(${order.discountVoucherCodeSnapshot})`
                    : order.voucher
                    ? `(${order.voucher.code})`
                    : ''}
                  :
                </span>
                <span className="font-bold">- {formatMoney(order.discountAmount)}</span>
              </div>
            )}

            {((order.taxAmount || 0) > 0 || order.vatPriceModeSnapshot) && (
              <div className="flex justify-between items-center text-slate-500 text-xs">
                <span>Thuế GTGT (VAT):</span>
                <span>
                  {order.vatPriceModeSnapshot === 'VAT_INCLUDED'
                    ? `Đã gồm trong giá (${formatMoney(order.taxAmount || 0)})`
                    : `+ ${formatMoney(order.taxAmount || 0)} (Chưa gồm)`}
                </span>
              </div>
            )}

            {order.pointsUsed && order.pointsUsed > 0 ? (
              <div className="flex justify-between items-center text-amber-600">
                <span>Điểm thưởng đã dùng ({order.pointsUsed.toLocaleString('vi-VN')} pts):</span>
                <span className="font-bold">
                  - {formatMoney(Math.round(order.pointsUsed * (order.branch?.pointRedeemRate && order.branch.pointRedeemRate > 0 ? order.branch.pointRedeemRate : 1)))}
                </span>
              </div>
            ) : null}

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="font-bold text-sm sm:text-base text-slate-900">
                Tổng thanh toán:
              </span>
              <span className="font-black text-lg sm:text-xl text-red-600">
                {formatMoney(order.totalAmount)}
              </span>
            </div>

            {order.pointsAwarded && order.pointsAwarded > 0 ? (
              <div className="flex justify-end text-emerald-600 text-xs font-bold items-center gap-1 pt-1">
                <Star size={13} />
                <span>Khách được tích lũy: +{order.pointsAwarded} điểm</span>
              </div>
            ) : null}

            {!isPosOrder && (
              <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-50">
                * Phí vận chuyển của đơn ONLINE là dữ liệu tài chính bất biến từ thời điểm checkout (Single Source of Truth), tuyệt đối không cho phép chỉnh sửa thủ công.
              </p>
            )}
          </div>

          {/* Payment Status Dropdown Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Phương thức thanh toán
              </p>
              <span className="inline-block bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
                {getPaymentMethodLabel(order.paymentMethod)}
              </span>
              {order.transactionId && (
                <p className="text-[11px] text-slate-400 font-mono mt-1.5 truncate">
                  Mã GD: {order.transactionId}
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Trạng thái thanh toán
              </label>
              {order.paymentMethod === 'SEPAY' && order.paymentStatus === 'PAID' ? (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-xs text-emerald-800">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>Tiền đã về tài khoản (SePay Tự động)</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 font-mono">
                    Mã GD: {order.transactionId || 'SEPAY-AUTO'}
                  </p>
                  <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1 pt-1 border-t border-emerald-200">
                    <Lock size={10} /> Đã khóa sửa đổi thủ công (Bảo vệ doanh thu)
                  </p>
                </div>
              ) : (
                <select
                  value={order.paymentStatus}
                  onChange={(e) => updateOrderPaymentStatus(e.target.value)}
                  disabled={order.status === 'CANCELLED'}
                  className="w-full h-9 px-3 bg-white font-bold rounded-xl text-xs border border-slate-200/80 outline-none focus:ring-2 focus:ring-red-500/20 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <option value="UNPAID">Chưa thanh toán</option>
                  <option value="PAID">Đã thanh toán</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </AdminCard>

      {/* Ordered Items List */}
      <AdminCard title="Danh sách món ăn" icon={<ShoppingBag size={16} />}>
        <div className="space-y-3 divide-y divide-slate-50">
          {order.orderItems?.map((item) => (
            <div key={item.id} className="pt-3 first:pt-0 flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200/60 overflow-hidden shrink-0 flex items-center justify-center">
                {item.product?.imageUrl ? (
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingBag size={20} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {item.product?.name || 'Món ăn'}
                  </h4>
                  <span className="font-black text-xs sm:text-sm text-slate-900 shrink-0">
                    {formatMoney(item.priceAtSale * item.quantity)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1 text-xs">
                  <span className="text-slate-400 truncate">
                    {item.optionsTextSnapshot || 'Không có tùy chọn'}
                  </span>
                  <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                    x{item.quantity}
                  </span>
                </div>
                {item.note && (
                  <p className="text-[11px] text-slate-400 italic mt-1">Ghi chú: {item.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* Progress Timeline: Chỉ hiển thị cho đơn ONLINE */}
      {!isPosOrder ? (
        <AdminCard title="Tiến trình đơn hàng Online" icon={<Clock size={16} />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {[
              {
                step: 1,
                label: 'Đặt hàng',
                time: order.createdAt,
                active: true,
                icon: ShoppingBag,
              },
              {
                step: 2,
                label: 'Xác nhận',
                time: order.confirmedAt,
                active: !!order.confirmedAt,
                icon: CheckCircle2,
              },
              {
                step: 3,
                label: 'Đang giao',
                time: order.deliveringAt,
                active: !!order.deliveringAt,
                icon: Truck,
              },
              {
                step: 4,
                label: 'Hoàn thành',
                time: order.deliveredAt,
                active: !!order.deliveredAt,
                icon: Check,
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className={`p-3 rounded-2xl border transition-all ${
                    s.active
                      ? 'bg-red-50/60 border-red-200 text-red-700'
                      : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                  }`}
                >
                  <div
                    className={`w-8 h-8 mx-auto rounded-xl flex items-center justify-center font-bold text-xs mb-1.5 ${
                      s.active ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Icon size={15} />
                  </div>
                  <p className="font-bold text-xs text-slate-800">{s.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {s.time ? new Date(s.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </p>
                </div>
              );
            })}
          </div>
        </AdminCard>
      ) : (
        <AdminCard title="Trạng thái phục vụ tại POS" icon={<Store size={16} />}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl border bg-purple-50/60 border-purple-200 text-purple-700">
              <div className="w-8 h-8 mx-auto rounded-xl flex items-center justify-center font-bold text-xs mb-1.5 bg-purple-600 text-white">
                <Store size={15} />
              </div>
              <p className="font-bold text-xs text-slate-800">1. Tạo đơn tạm POS</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {order.temporaryOrderCode || 'Mã TMP'}
              </p>
            </div>
            <div className={`p-3 rounded-2xl border ${order.status !== 'PENDING' ? 'bg-amber-50/60 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'}`}>
              <div className={`w-8 h-8 mx-auto rounded-xl flex items-center justify-center font-bold text-xs mb-1.5 ${order.status !== 'PENDING' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                <ShoppingBag size={15} />
              </div>
              <p className="font-bold text-xs text-slate-800">2. Phục vụ món ăn</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                {order.table?.name ? `Bàn ${order.table.name}` : 'Mang đi'}
              </p>
            </div>
            <div className={`p-3 rounded-2xl border ${order.paymentStatus === 'PAID' ? 'bg-emerald-50/60 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'}`}>
              <div className={`w-8 h-8 mx-auto rounded-xl flex items-center justify-center font-bold text-xs mb-1.5 ${order.paymentStatus === 'PAID' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                <Check size={15} />
              </div>
              <p className="font-bold text-xs text-slate-800">3. Thanh toán & Cấp mã HĐ</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {order.orderCode || 'Chưa cấp mã HĐ'}
              </p>
            </div>
          </div>
        </AdminCard>
      )}

      {/* Change Status Action Group */}
      {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
        <AdminCard title="Cập nhật trạng thái đơn" icon={<AlertCircle size={16} />}>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.filter((st) => !isPosOrder || st !== 'DELIVERING').map((st) => {
              const isCurrent = order.status === st;
              const isLocked = STATUS_WEIGHTS[st] < STATUS_WEIGHTS[order.status];
              return (
                <button
                  key={st}
                  type="button"
                  disabled={isLocked || isCurrent}
                  onClick={() => handleOpenStatusModal(st)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                    isCurrent
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : isLocked
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  Chuyển sang: {st}
                </button>
              );
            })}
          </div>
        </AdminCard>
      )}

      {/* Confirm Status Modal */}
      <ConfirmDialog
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onConfirm={confirmUpdateStatus}
        title="Xác nhận đổi trạng thái đơn hàng"
        message={`Bạn có chắc chắn muốn chuyển trạng thái đơn hàng #${orderCodeDisplay} sang "${targetStatus}" không? Thao tác này sẽ cập nhật tiến trình và thông báo cho khách hàng.`}
        confirmText="Xác nhận đổi"
        loading={statusLoading}
        type={targetStatus === 'CANCELLED' ? 'danger' : 'info'}
      />
    </div>
  );
}
