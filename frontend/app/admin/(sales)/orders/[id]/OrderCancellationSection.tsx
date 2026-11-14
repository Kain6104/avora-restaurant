'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import {
  Ban,
  Receipt,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Building,
  FileText,
  User as UserIcon,
  HelpCircle,
  ChefHat,
  ExternalLink,
} from 'lucide-react';
import { AdminCard } from '@/app/admin/components/ui';

interface OrderCancellationSectionProps {
  order: any;
  currentUser: any;
  onRefresh: () => void;
}

const UNPAID_REASONS = [
  { code: 'CUSTOMER_CHANGED_MIND', label: 'Khách hàng đổi ý' },
  { code: 'CUSTOMER_WRONG_ITEM', label: 'Khách hàng đặt nhầm món' },
  { code: 'STAFF_INPUT_ERROR', label: 'Nhân viên nhập nhầm món' },
  { code: 'DUPLICATE_ORDER', label: 'Trùng đơn hàng' },
  { code: 'WRONG_ORDER_INFO', label: 'Sai thông tin đơn hàng' },
  { code: 'OUT_OF_STOCK_INGREDIENTS', label: 'Hết nguyên liệu' },
  { code: 'OUT_OF_STOCK_ITEM', label: 'Hết món' },
  { code: 'CANNOT_DELIVER', label: 'Không thể giao hàng' },
  { code: 'CANNOT_CONTACT_CUSTOMER', label: 'Không liên hệ được khách hàng' },
  { code: 'CUSTOMER_NO_SHOW', label: 'Khách hàng không đến nhận' },
  { code: 'SYSTEM_ERROR', label: 'Lỗi hệ thống' },
  { code: 'OTHER', label: 'Lý do khác (Bắt buộc giải thích)' },
];

export function OrderCancellationSection({
  order,
  currentUser,
  onRefresh,
}: OrderCancellationSectionProps) {
  // Modal states
  const [isUnpaidModalOpen, setIsUnpaidModalOpen] = useState(false);
  const [isPaidRequestModalOpen, setIsPaidRequestModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isTaxInvoiceModalOpen, setIsTaxInvoiceModalOpen] = useState(false);

  // Form states
  const [loading, setLoading] = useState(false);
  const [reasonCode, setReasonCode] = useState('CUSTOMER_CHANGED_MIND');
  const [explanation, setExplanation] = useState('');
  const [notes, setNotes] = useState('');
  const [wasteRecorded, setWasteRecorded] = useState(false);
  const [wasteNotes, setWasteNotes] = useState('');

  // Paid cancellation form states
  const [requestedRefundAmount, setRequestedRefundAmount] = useState<number>(0);
  const [retainedAmount, setRetainedAmount] = useState<number>(0);

  // Review form states
  const [reviewApproved, setReviewApproved] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');

  // Refund execution form states
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CARD' | 'EWALLET'>('CASH');
  const [bankReference, setBankReference] = useState('');
  const [bankDestination, setBankDestination] = useState('');

  // Tax invoice form states
  const [taxAction, setTaxAction] = useState<'CANCEL' | 'ADJUST' | 'REPLACE'>('CANCEL');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [taxNotes, setTaxNotes] = useState('');

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Tính toán trạng thái thanh toán & số tiền
  const completedPayments = (order.payments || []).filter((p: any) => p.status === 'COMPLETED');
  const totalCollected = completedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);

  let totalRefunded = 0;
  for (const p of completedPayments) {
    for (const ref of p.refunds || []) {
      if (ref.status === 'COMPLETED') totalRefunded += ref.amount;
    }
  }
  const remainingRefundable = Math.max(0, totalCollected - totalRefunded);

  const hasSuccessfulPayment = totalCollected > 0 || order.paymentStatus === 'PAID';
  const isCancelled = order.status === 'CANCELLED';
  const cancellation = order.cancellation;

  // 1. Submit Unpaid Cancellation
  const handleCancelUnpaid = async () => {
    if (reasonCode === 'OTHER' && (!explanation || explanation.trim().length < 5)) {
      toast.error('Lý do "Khác" bắt buộc nhập giải thích từ 5 ký tự trở lên');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cancellations/orders/${order.id}/unpaid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonCode,
          explanation: explanation.trim() || undefined,
          notes: notes.trim() || undefined,
          wasteRecorded,
          wasteNotes: wasteNotes.trim() || undefined,
        }),
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Đã hủy đơn chưa thanh toán thành công');
        setIsUnpaidModalOpen(false);
        onRefresh();
      } else {
        toast.error(json.message || 'Lỗi khi hủy đơn hàng');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Request Paid Cancellation
  const handleRequestPaidCancellation = async () => {
    if (!explanation || explanation.trim().length < 5) {
      toast.error('Bắt buộc nhập giải thích chi tiết lý do hủy hóa đơn từ 5 ký tự trở lên');
      return;
    }
    if (requestedRefundAmount > remainingRefundable) {
      toast.error(`Số tiền đề xuất hoàn không được vượt quá ${formatMoney(remainingRefundable)}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cancellations/orders/${order.id}/paid/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonCode,
          explanation: explanation.trim(),
          requestedRefundAmount: Number(requestedRefundAmount),
          retainedAmount: Number(retainedAmount || 0),
          notes: notes.trim() || undefined,
        }),
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Đã gửi yêu cầu hủy hóa đơn thành công');
        setIsPaidRequestModalOpen(false);
        onRefresh();
      } else {
        toast.error(json.message || 'Lỗi khi gửi yêu cầu hủy');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Review (Dual Approval)
  const handleReviewCancellation = async () => {
    if (!reviewApproved && (!rejectionReason || rejectionReason.trim().length < 5)) {
      toast.error('Bắt buộc nhập lý do từ chối từ 5 ký tự trở lên');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cancellations/orders/${order.id}/paid/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: reviewApproved,
          rejectionReason: !reviewApproved ? rejectionReason.trim() : undefined,
        }),
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Đã xét duyệt yêu cầu hủy thành công');
        setIsReviewModalOpen(false);
        onRefresh();
      } else {
        toast.error(json.message || 'Lỗi khi xét duyệt');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // 4. Submit Refund Execution
  const handleExecuteRefund = async () => {
    if (!refundAmount || refundAmount <= 0) {
      toast.error('Số tiền hoàn phải lớn hơn 0');
      return;
    }
    if (refundAmount > remainingRefundable) {
      toast.error(`Số tiền hoàn không được vượt quá số tiền còn lại (${formatMoney(remainingRefundable)})`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cancellations/orders/${order.id}/paid/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(refundAmount),
          refundMethod,
          bankReference: bankReference.trim() || undefined,
          bankDestination: bankDestination.trim() || undefined,
        }),
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Đã thực hiện hoàn tiền thành công');
        setIsRefundModalOpen(false);
        onRefresh();
      } else {
        toast.error(json.message || 'Lỗi khi thực hiện hoàn tiền');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // 5. Submit Tax Invoice Action
  const handleTaxInvoiceAction = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cancellations/orders/${order.id}/paid/tax-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: taxAction,
          invoiceNumber: invoiceNumber.trim() || undefined,
          notes: taxNotes.trim() || undefined,
        }),
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Đã cập nhật chứng từ hóa đơn thuế thành công');
        setIsTaxInvoiceModalOpen(false);
        onRefresh();
      } else {
        toast.error(json.message || 'Lỗi khi cập nhật hóa đơn thuế');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Dual Approval Check
  const isRequester = cancellation?.requestedById && currentUser?.id === cancellation.requestedById;
  const canApprove = cancellation?.status === 'PENDING_APPROVAL' && !isRequester;
  const canExecuteRefund =
    ['APPROVED', 'REFUND_PENDING', 'REFUND_PROCESSING', 'PARTIALLY_REFUNDED'].includes(
      cancellation?.status,
    ) && remainingRefundable > 0;

  return (
    <div className="space-y-4">
      {/* ACTION BUTTONS (WHEN ORDER NOT YET CANCELLED / HAS ACTIVE PAID INVOICE) */}
      {!isCancelled && (
        <AdminCard title="Nghiệp vụ Hủy Đơn & Hủy Hóa Đơn (Enterprise)" icon={<ShieldAlert size={16} />}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">
                Thao tác xóa vĩnh viễn đã bị loại bỏ theo tiêu chuẩn quản trị tài chính.
              </p>
              <p>Chọn chính xác nghiệp vụ tùy thuộc vào tình trạng thu tiền thực tế của đơn hàng.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Option 1: HỦY ĐƠN CHƯA THANH TOÁN (Chỉ khi chưa thu tiền) */}
              {!hasSuccessfulPayment && (
                <button
                  type="button"
                  onClick={() => {
                    setReasonCode('CUSTOMER_CHANGED_MIND');
                    setExplanation('');
                    setIsUnpaidModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition flex items-center gap-1.5 cursor-pointer min-h-[38px]"
                >
                  <Ban size={15} />
                  <span>HỦY ĐƠN CHƯA THANH TOÁN</span>
                </button>
              )}

              {/* Option 2: HỦY HÓA ĐƠN ĐÃ THANH TOÁN (Khi đã thu tiền) */}
              {hasSuccessfulPayment && (!cancellation || cancellation.status === 'REJECTED') && (
                <button
                  type="button"
                  onClick={() => {
                    setReasonCode('CUSTOMER_CHANGED_MIND');
                    setExplanation('');
                    setRequestedRefundAmount(remainingRefundable);
                    setRetainedAmount(0);
                    setIsPaidRequestModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition flex items-center gap-1.5 cursor-pointer min-h-[38px]"
                >
                  <Receipt size={15} />
                  <span>HỦY HÓA ĐƠN ĐÃ THANH TOÁN</span>
                </button>
              )}
            </div>
          </div>
        </AdminCard>
      )}

      {/* CANCELLATION LIFECYCLE MANAGEMENT CARD (IF CANCELLATION RECORD EXISTS) */}
      {cancellation && (
        <AdminCard
          title={
            cancellation.cancellationType === 'UNPAID_ORDER_CANCELLATION'
              ? 'Hồ sơ Hủy Đơn Chưa Thanh Toán'
              : 'Hồ sơ Hủy Hóa Đơn & Quy Trình Hoàn Tiền'
          }
          icon={<RotateCcw size={16} />}
        >
          <div className="space-y-3.5 text-xs">
            {/* Status & Code Bar */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-rose-800 text-sm">
                  #{cancellation.cancellationCode}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                  {cancellation.cancellationType}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Trạng thái vòng đời:</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                  {cancellation.status}
                </span>
              </div>
            </div>

            {/* Financial Summary (For Paid Cancellation) */}
            {cancellation.cancellationType === 'PAID_INVOICE_CANCELLATION' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-amber-50/40 border border-amber-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Thực Thu Ban Đầu</span>
                  <strong className="text-emerald-700 text-sm font-black">{formatMoney(cancellation.totalCollected)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Đề Xuất Hoàn</span>
                  <strong className="text-slate-900 text-sm font-black">{formatMoney(cancellation.requestedRefundAmount)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Đã Hoàn Thực Tế</span>
                  <strong className="text-rose-700 text-sm font-black">{formatMoney(cancellation.totalRefunded)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Còn Phải Hoàn</span>
                  <strong className="text-amber-800 text-sm font-black">
                    {formatMoney(Math.max(0, cancellation.requestedRefundAmount - cancellation.totalRefunded))}
                  </strong>
                </div>
              </div>
            )}

            {/* Details & Explanation */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Lý Do Chuẩn Hóa</span>
                  <strong className="text-slate-900">{cancellation.reasonCode}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Người Đề Xuất</span>
                  <strong className="text-slate-900">
                    {cancellation.requestedByName || '--'} ({cancellation.requestedByRole || 'STAFF'})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Người Phê Duyệt</span>
                  <strong className="text-slate-900">
                    {cancellation.approvedByName ? `${cancellation.approvedByName} (${cancellation.approvedByRole})` : 'Chưa duyệt'}
                  </strong>
                </div>
              </div>

              {cancellation.explanation && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Giải Thích Chi Tiết</span>
                  <p className="text-slate-800 italic mt-0.5">{cancellation.explanation}</p>
                </div>
              )}

              {cancellation.rejectionReason && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                  <strong>Lý do từ chối: </strong>
                  <span>{cancellation.rejectionReason}</span>
                </div>
              )}
            </div>

            {/* Action Bar for Pending Approval & Refund Execution */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {/* Dual Approval Alert */}
              {cancellation.status === 'PENDING_APPROVAL' && isRequester && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  <AlertCircle size={14} />
                  <span>Dual Approval Rule: Bạn là người tạo đề xuất, phải do Quản lý khác hoặc Kế toán/Admin duyệt.</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                {/* Button Dual Approval Review */}
                {canApprove && (
                  <button
                    type="button"
                    onClick={() => {
                      setReviewApproved(true);
                      setRejectionReason('');
                      setIsReviewModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition cursor-pointer"
                  >
                    Xét Duyệt Hủy Hóa Đơn
                  </button>
                )}

                {/* Button Execute Refund */}
                {canExecuteRefund && (
                  <button
                    type="button"
                    onClick={() => {
                      setRefundAmount(
                        Math.max(0, cancellation.requestedRefundAmount - cancellation.totalRefunded) ||
                          remainingRefundable,
                      );
                      setRefundMethod('CASH');
                      setBankReference('');
                      setBankDestination('');
                      setIsRefundModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw size={13} />
                    <span>Thực Thi Chi Hoàn Tiền</span>
                  </button>
                )}

                {/* Button Tax Invoice Handling */}
                {order.isInvoiceExported && cancellation.taxInvoiceStatus !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaxAction('CANCEL');
                      setInvoiceNumber(order.invoiceTaxCode || '');
                      setTaxNotes('');
                      setIsTaxInvoiceModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition cursor-pointer"
                  >
                    Xử Lý Hóa Đơn Thuế VAT
                  </button>
                )}
              </div>
            </div>
          </div>
        </AdminCard>
      )}

      {/* ================================================================= */}
      {/* MODAL 1: HỦY ĐƠN CHƯA THANH TOÁN */}
      {/* ================================================================= */}
      {isUnpaidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <Ban size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Hủy Đơn Chưa Thanh Toán</h3>
                <p className="text-xs text-slate-500">Đơn hàng #{order.orderCode || order.temporaryOrderCode}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Lý Do Hủy Đơn (Bắt Buộc)
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 min-h-[38px]"
                >
                  {UNPAID_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Giải Thích Chi Tiết {reasonCode === 'OTHER' && <span className="text-rose-600">*</span>}
                </label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Nhập giải thích cụ thể lý do hủy..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={wasteRecorded}
                    onChange={(e) => setWasteRecorded(e.target.checked)}
                    className="rounded text-rose-600 w-4 h-4"
                  />
                  <span>Ghi nhận hao hụt / lãng phí món (Kitchen Waste)</span>
                </label>
                {wasteRecorded && (
                  <input
                    type="text"
                    value={wasteNotes}
                    onChange={(e) => setWasteNotes(e.target.value)}
                    placeholder="Ghi chú nguyên vật liệu bị hao hụt..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                )}
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert size={14} className="text-rose-600" />
                  <span>Cảnh Báo Kiểm Toán & Đối Soát</span>
                </div>
                <p className="text-[11px] text-rose-800">
                  Đơn hàng sẽ chuyển sang trạng thái <strong>CANCELLED</strong>. Voucher và điểm loyalty sẽ được hoàn lại tự động. Phiếu hủy bếp sẽ được gửi tới các trạm in liên quan.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsUnpaidModalOpen(false)}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleCancelUnpaid}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                {loading ? 'Đang xử lý...' : 'Xác Nhận Hủy Đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: ĐỀ XUẤT HỦY HÓA ĐƠN ĐÃ THANH TOÁN */}
      {/* ================================================================= */}
      {isPaidRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Receipt size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Đề Xuất Hủy Hóa Đơn Đã Thanh Toán</h3>
                <p className="text-xs text-slate-500">Khởi tạo quy trình hoàn tiền & điều chỉnh kế toán</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Đã Thực Thu</span>
                  <strong className="text-emerald-700 font-black">{formatMoney(totalCollected)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Có Thể Hoàn Tối Đa</span>
                  <strong className="text-amber-800 font-black">{formatMoney(remainingRefundable)}</strong>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Số Tiền Đề Xuất Hoàn Lại Cho Khách (VNĐ) *
                </label>
                <input
                  type="number"
                  max={remainingRefundable}
                  value={requestedRefundAmount}
                  onChange={(e) => setRequestedRefundAmount(Number(e.target.value))}
                  className="w-full text-xs font-black text-rose-700 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Số Tiền Giữ Lại Theo Chính Sách (Nếu Có)
                </label>
                <input
                  type="number"
                  value={retainedAmount}
                  onChange={(e) => setRetainedAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Lý Do Chuẩn Hóa *
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 min-h-[38px]"
                >
                  {UNPAID_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Giải Thích Chi Tiết Lý Do Hủy & Hoàn Tiền *
                </label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Bắt buộc nhập chi tiết lý do hoàn tiền cho bộ phận phê duyệt..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px]">
                <strong>Quy trình Dual Approval: </strong>
                Yêu cầu sau khi gửi sẽ chuyển sang trạng thái <strong>PENDING_APPROVAL</strong> và phải được Quản lý / Kế toán duyệt trước khi thực thi chi tiền hoàn.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPaidRequestModalOpen(false)}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleRequestPaidCancellation}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
              >
                {loading ? 'Đang gửi...' : 'Gửi Yêu Cầu Duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: XÉT DUYỆT (DUAL APPROVAL) */}
      {/* ================================================================= */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xét Duyệt Hủy Hóa Đơn</h3>
                <p className="text-xs text-slate-500">Dual Approval Gatekeeper</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 font-bold text-emerald-800 cursor-pointer">
                  <input
                    type="radio"
                    name="reviewDecision"
                    checked={reviewApproved}
                    onChange={() => setReviewApproved(true)}
                  />
                  <span>PHÊ DUYỆT HỦY & HOÀN TIỀN</span>
                </label>
                <label className="flex items-center gap-1.5 font-bold text-rose-800 cursor-pointer">
                  <input
                    type="radio"
                    name="reviewDecision"
                    checked={!reviewApproved}
                    onChange={() => setReviewApproved(false)}
                  />
                  <span>TỪ CHỐI</span>
                </label>
              </div>

              {!reviewApproved && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-rose-700 mb-1">
                    Lý Do Từ Chối (Bắt Buộc) *
                  </label>
                  <textarea
                    rows={2}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Nhập lý do từ chối yêu cầu hủy hóa đơn..."
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleReviewCancellation}
                disabled={loading}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm ${
                  reviewApproved ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {loading ? 'Đang xử lý...' : reviewApproved ? 'Xác Nhận Phê Duyệt' : 'Xác Nhận Từ Chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 4: THỰC THI CHI HOÀN TIỀN (REFUND EXECUTION) */}
      {/* ================================================================= */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <RotateCcw size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Thực Thi Chi Hoàn Tiền</h3>
                <p className="text-xs text-slate-500">Lệnh xuất quỹ / chuyển khoản hoàn trả</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Phương Thức Hoàn Tiền *
                </label>
                <select
                  value={refundMethod}
                  onChange={(e: any) => setRefundMethod(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 min-h-[38px]"
                >
                  <option value="CASH">Tiền mặt tại quầy (Xuất quỹ CashShift)</option>
                  <option value="BANK_TRANSFER">Chuyển khoản ngân hàng (VietQR / Internet Banking)</option>
                  <option value="CARD">Hoàn qua thẻ POS ngân hàng</option>
                  <option value="EWALLET">Hoàn qua Ví điện tử</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Số Tiền Thực Chi Hoàn (VNĐ) *
                </label>
                <input
                  type="number"
                  max={remainingRefundable}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full text-xs font-black text-emerald-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 min-h-[38px]"
                />
              </div>

              {refundMethod === 'BANK_TRANSFER' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      Mã Giao Dịch Ngân Hàng (FT / Mã Ủy Nhiệm Chi) *
                    </label>
                    <input
                      type="text"
                      value={bankReference}
                      onChange={(e) => setBankReference(e.target.value)}
                      placeholder="VD: FT26111000129..."
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      Số Tài Khoản & Tên Ngân Hàng Khách Nhận
                    </label>
                    <input
                      type="text"
                      value={bankDestination}
                      onChange={(e) => setBankDestination(e.target.value)}
                      placeholder="VD: 1012345678 - VCB - NGUYEN VAN A"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteRefund}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
              >
                {loading ? 'Đang thực thi...' : 'Xác Nhận Chi Hoàn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 5: XỬ LÝ HÓA ĐƠN THUẾ VAT */}
      {/* ================================================================= */}
      {isTaxInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xử Lý Hóa Đơn Điện Tử VAT</h3>
                <p className="text-xs text-slate-500">Căn cứ chứng từ kế toán thuế</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Nghiệp Vụ Hóa Đơn Thuế *
                </label>
                <select
                  value={taxAction}
                  onChange={(e: any) => setTaxAction(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 min-h-[38px]"
                >
                  <option value="CANCEL">HỦY HÓA ĐƠN ĐIỆN TỬ (Hủy bỏ trên cổng thuế)</option>
                  <option value="ADJUST">ĐIỀU CHỈNH HÓA ĐƠN (Lập biên bản & hóa đơn điều chỉnh)</option>
                  <option value="REPLACE">THAY THẾ HÓA ĐƠN (Phát hành hóa đơn mới thay thế)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Số / Mã Hóa Đơn Thuế Liên Quan
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="VD: 0001234..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Ghi Chú Kế Toán
                </label>
                <textarea
                  rows={2}
                  value={taxNotes}
                  onChange={(e) => setTaxNotes(e.target.value)}
                  placeholder="Ghi chú số biên bản thỏa thuận hủy/điều chỉnh..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTaxInvoiceModalOpen(false)}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleTaxInvoiceAction}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-sm"
              >
                {loading ? 'Đang lưu...' : 'Xác Nhận Xử Lý'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

