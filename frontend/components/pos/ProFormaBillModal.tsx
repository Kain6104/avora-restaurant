"use client";

import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { printAgent } from '@/lib/print-agent';
import { PosCartItem, PosTable, PosOrder, PosBranch } from './pos-types';
import { getItemPriceBreakdown } from './pos-item-price-helper';
import { ReceiptItemOptionsTable } from './OrderItemPriceBreakdown';

interface ProFormaBillModalProps {
  branch: PosBranch | null;
  table: PosTable | null;
  order: PosOrder | null;
  cartItems: PosCartItem[];
  guestCount: number;
  cashierName?: string;
  receiptPrinterName?: string;
  paperSize?: '80mm' | '58mm';
  copies?: number;
  onClose: () => void;
}

export const ProFormaBillModal: React.FC<ProFormaBillModalProps> = ({
  branch,
  table,
  order,
  cartItems,
  guestCount,
  cashierName = 'Thu ngân',
  receiptPrinterName,
  paperSize = '80mm',
  copies = 1,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const subTotal = cartItems.reduce((sum, it) => {
    const unitPrice = Math.max(0, it.priceAtSale - (it.discountAmount || 0));
    return sum + unitPrice * it.quantity;
  }, 0);
  const discountAmount = order?.discountAmount || 0;
  const shippingDiscount = order?.shippingDiscount || 0;
  const totalDiscount = discountAmount + shippingDiscount;
  const serviceChargeTotal = order?.serviceChargeTotal || 0;
  const taxAmount = order?.taxAmount || 0;
  const isVatExcluded = order?.vatPriceModeSnapshot === 'VAT_EXCLUDED';
  const shippingFee = order?.shippingFee || 0;
  const grandTotal = order?.totalAmount || Math.max(0, subTotal - totalDiscount + serviceChargeTotal + shippingFee + (isVatExcluded ? taxAmount : 0));

  // 1. Tên khách hàng hiển thị
  const rawCustomerName = order?.customerName || order?.user?.fullName;
  let customerNameDisplay = 'Khách lẻ';
  if (rawCustomerName && rawCustomerName.trim().length > 0 && rawCustomerName !== 'Khách lẻ') {
    customerNameDisplay = rawCustomerName.trim();
    if (order?.user?.membershipTier?.name) {
      customerNameDisplay += ` (${order.user.membershipTier.name})`;
    }
  }

  // 2. Chi tiết giảm giá
  const discountDetails: Array<{ label: string; amount: number }> = [];
  if (order?.discountVoucherCodeSnapshot || (order as any)?.voucher?.code) {
    const code = order?.discountVoucherCodeSnapshot || (order as any)?.voucher?.code;
    if (discountAmount > 0) {
      discountDetails.push({
        label: `Voucher [${code}]`,
        amount: discountAmount,
      });
    }
  } else if (order?.discountReason && discountAmount > 0) {
    discountDetails.push({
      label: order.discountReason,
      amount: discountAmount,
    });
  }

  if (shippingDiscount > 0) {
    const shipCode = (order as any)?.shippingVoucherCodeSnapshot || (order as any)?.shippingVoucher?.code;
    const label = shipCode ? `Giảm phí ship [${shipCode}]` : 'Giảm phí ship';
    discountDetails.push({
      label,
      amount: shippingDiscount,
    });
  }

  if (discountDetails.length === 0 && discountAmount > 0) {
    discountDetails.push({
      label: 'Khuyến mãi',
      amount: discountAmount,
    });
  }

  // 3. Chi tiết phụ phí
  const serviceChargeDetails: Array<{ name: string; amount: number }> = (order?.serviceCharges || []).map((sc) => ({
    name: sc.name || 'Phụ thu',
    amount: sc.amount || 0,
  }));
  if (serviceChargeDetails.length === 0 && serviceChargeTotal > 0) {
    serviceChargeDetails.push({
      name: 'Phụ thu',
      amount: serviceChargeTotal,
    });
  }

  // 4. Thuế VAT & Số lượng
  let avgTaxPercent = 0;
  const nonZeroItems = cartItems.filter((i) => (i.taxPercentageAtSale || i.product?.taxPercentage || 0) > 0);
  if (nonZeroItems.length > 0) {
    avgTaxPercent = Math.round(
      nonZeroItems.reduce((sum, i) => sum + (i.taxPercentageAtSale || i.product?.taxPercentage || 0), 0) / nonZeroItems.length
    );
  } else if (taxAmount && subTotal > 0) {
    avgTaxPercent = Math.round((taxAmount / subTotal) * 100);
  }
  const vatPercentStr = avgTaxPercent > 0 ? `${avgTaxPercent}%` : '8%';
  const totalItemQuantity = cartItems.reduce((sum, it) => sum + it.quantity, 0);

  const [printing, setPrinting] = React.useState(false);
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = async () => {
    if (order?.id) {
      setPrinting(true);
      try {
        const res = await fetch(`/api/print-templates/render/order/${order.id}?type=TEMP_BILL`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.success && data.data?.html) {
          const html = data.data.html;

          // 1. Thử in âm thầm qua Print Agent Local
          const isAgentOnline = await printAgent.checkHealth().catch(() => false);
          if (isAgentOnline) {
            const targetPrinter = receiptPrinterName || 'Xprinter XP-350B';
            const agentRes = await printAgent.printHtml({
              printerName: targetPrinter,
              htmlContent: html,
              paperSize: paperSize || (branch?.defaultPaperSize as any) || '80mm',
              copies: copies || 1,
              idempotencyKey: `tempbill-${order.id}-${Date.now()}`,
              receiptPayload: data.data?.receiptPayload,
            });

            if (agentRes.success) {
              toast.success(`Đã in phiếu tạm tính qua máy in [${targetPrinter}]!`);
              onClose();
              return;
            } else {
              toast.error(`Print Agent lỗi: ${agentRes.message || 'Không thể in'}. Mở hộp thoại in...`);
            }
          }

          // 2. Fallback in qua iframe nếu Print Agent không khả dụng
          if (printIframeRef.current) {
            const iframe = printIframeRef.current;
            iframe.srcdoc = html;
            iframe.onload = () => {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              setPrinting(false);
            };
            return;
          }
        }
      } catch (err) {
        console.warn('Backend print template render failed, using fallback:', err);
      } finally {
        setPrinting(false);
      }
    }
    // Fallback in trực tiếp nếu không có order.id hoặc lỗi mạng
    window.print();
  };

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDateTimeStr = (d: Date) =>
    `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const printTimeStr = formatDateTimeStr(now);
  const checkInTimeStr = order?.createdAt ? formatDateTimeStr(new Date(order.createdAt)) : printTimeStr;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col max-h-[95vh]">
        {/* Hidden Print Iframe */}
        <iframe ref={printIframeRef} className="hidden" title="Print Frame" />

        {/* Header Actions */}
        <div className="p-3.5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <span className="text-xs font-bold text-gray-700">Phiếu tạm tính / Hóa đơn</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#da251d] hover:bg-[#b81d16] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{printing ? 'Đang chuẩn bị...' : 'In phiếu'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container (80mm width look) */}
        <div className="p-6 overflow-y-auto bg-gray-100 flex justify-center">
          <div
            ref={printRef}
            className="w-full max-w-[340px] bg-white p-5 rounded-lg shadow-sm border border-gray-200 text-gray-800 font-mono text-[11px] leading-relaxed select-text"
          >
            {/* Restaurant Brand Header */}
            <div className="text-center pb-2 border-b border-dashed border-gray-300">
              <h2 className="text-sm font-extrabold tracking-wider text-gray-900 uppercase">
                AVORA RESTAURANT
              </h2>
              <div className="text-[10px] text-gray-500 font-sans mt-0.5">
                {branch?.name || 'Chi nhánh AVORA'}
              </div>
              <div className="text-[10px] text-gray-400 font-sans">
                {branch?.street || '15 Lê Thái Tổ'}, {branch?.province || 'Hà Nội'}
              </div>
              <div className="text-[10px] text-gray-400 font-sans">
                Hotline: {branch?.phone || '1900 8888'}
              </div>
              <div className="mt-1.5 text-xs font-bold uppercase tracking-widest text-gray-900 border-t border-gray-200 pt-1">
                PHIẾU TẠM TÍNH
              </div>
              <div className="text-[10px] font-bold text-gray-900 whitespace-nowrap">
                {order?.orderCode || 'POS-DRAFT'} - {printTimeStr}
              </div>
              <div className="text-[9.5px] italic text-gray-500">
                (Vui lòng kiểm tra lại món trước khi thanh toán)
              </div>
            </div>

            {/* Bill Info */}
            <div className="py-2 space-y-0.5 border-b border-dashed border-gray-300 text-[10px]">
              <div className="text-[10px] text-gray-900 pb-0.5 whitespace-nowrap">
                Bàn: <b>{table ? `${table.name} (${table.areaName})` : 'Mang về'}</b>
              </div>
              <div className="flex justify-between">
                <span>Giờ vào: <b>{checkInTimeStr}</b></span>
                <span>Số khách: <b>{guestCount}</b></span>
              </div>
              <div className="whitespace-normal break-words">
                Khách hàng: <b>{customerNameDisplay}</b>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-gray-300 space-y-1.5">
              <div className="grid grid-cols-12 font-bold text-[10px] text-gray-700 pb-1 border-b border-gray-300">
                <span className="col-span-6">Mặt hàng</span>
                <span className="col-span-2 text-center">SL</span>
                <span className="col-span-4 text-right">T.Tiền</span>
              </div>

              {cartItems.map((item) => (
                <div key={item.id} className="grid grid-cols-12 text-[10px] py-1 border-b border-dotted border-gray-200">
                  <div className="col-span-6 pr-1">
                    <div className="font-bold text-gray-900 leading-tight">{item.product.name}</div>
                    {/* Added By: Exact Staff + Added Time */}
                    <div className="text-[8.5px] text-gray-500 font-medium mt-0.5">
                      {getItemPriceBreakdown(item, order?.createdAt).addedByFormatted}
                    </div>
                    {/* Options Breakdown with strict right alignment */}
                    <ReceiptItemOptionsTable item={item} fallbackOrderCreatedAt={order?.createdAt} />
                    {item.note && (
                      <div className="text-[9px] text-amber-700 italic mt-0.5">Ghi chú: {item.note}</div>
                    )}
                  </div>
                  <div className="col-span-2 text-center font-bold text-gray-700 align-top">
                    {item.quantity}
                  </div>
                  <div className="col-span-4 text-right font-bold text-gray-900 align-top font-mono tabular-nums">
                    {(item.priceAtSale * item.quantity).toLocaleString('vi-VN')}đ
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Breakdown */}
            <div className="py-2 border-b border-dashed border-gray-300 space-y-1 text-[10px]">
              {isVatExcluded && taxAmount > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span>Tiền hàng trước VAT({totalItemQuantity}):</span>
                    <span className="font-bold">{subTotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT:</span>
                    <span className="font-bold">({vatPercentStr}) {taxAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                </>
              ) : taxAmount > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span>Tiền hàng({totalItemQuantity}):</span>
                    <span className="font-bold">{subTotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT (đã bao gồm):</span>
                    <span>({vatPercentStr}) {taxAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>Tạm tính({totalItemQuantity}):</span>
                  <span className="font-bold">{subTotal.toLocaleString('vi-VN')}đ</span>
                </div>
              )}

              {shippingFee > 0 && (
                <div className="flex justify-between">
                  <span>Phí vận chuyển:</span>
                  <span className="font-bold">{shippingFee.toLocaleString('vi-VN')}đ</span>
                </div>
              )}

              {serviceChargeTotal > 0 && (
                <div>
                  <div className="flex justify-between">
                    <span>Phụ phí / Dịch vụ:</span>
                    <span className="font-bold">+{serviceChargeTotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                  {serviceChargeDetails.map((sc, idx) => (
                    <div key={idx} className="flex justify-between text-[9px] text-gray-600 pl-2">
                      <span>+ {sc.name}</span>
                      <span>+ {sc.amount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                </div>
              )}

              {totalDiscount > 0 && (
                <div>
                  <div className="flex justify-between">
                    <span>Giảm giá:</span>
                    <span className="font-bold">-{totalDiscount.toLocaleString('vi-VN')}đ</span>
                  </div>
                  {discountDetails.map((d, idx) => (
                    <div key={idx} className="flex justify-between text-[9px] text-gray-600 pl-2">
                      <span>+ {d.label}</span>
                      <span>- {d.amount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-1.5 border-t border-dashed border-gray-400 flex justify-between text-xs font-bold text-gray-900">
                <span>TỔNG TIỀN:</span>
                <span className="text-sm font-black text-gray-900">
                  {grandTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* QR Code & Footer */}
            <div className="pt-4 flex flex-col items-center text-center space-y-2">
              <QRCodeSVG value={`AVORA:${order?.orderCode || 'POS-DRAFT'}:${grandTotal}`} size={70} />
              <div className="text-[9px] text-gray-400 font-sans">
                Quét mã để tra cứu hóa đơn điện tử hoặc thanh toán
              </div>
              <div className="text-[10px] font-bold text-gray-700 italic pt-1 font-sans">
                Cảm ơn Quý khách & Hẹn gặp lại!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
