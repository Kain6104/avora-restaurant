"use client";

import React from 'react';
import { formatVNDRaw } from '@/lib/utils/vietnam-time';

export interface EndOfDayReportData {
  period: {
    from: string;
    to: string;
    fromUtc: string;
    toUtc: string;
  };
  branch: {
    id: string;
    name: string;
    branchCode: string;
    address?: string;
    phone?: string;
  };
  staff?: {
    id?: string;
    name?: string;
    shiftId?: string;
  } | null;
  summary: {
    completedOrderCount: number;
    cancelledOrderCount: number;
    totalGrossSales: number;
    totalDirectItemDiscount: number;
    totalVoucherDiscount: number;
    totalShippingDiscount: number;
    totalDiscount: number;
    totalVat: number;
    netSales: number;
    refundTotal: number;
    shippingFeeOriginal: number;
    shippingFeeCustomerPaid: number;
    serviceChargeTotal: number;
    totalActualCollected: number;
  };
  payments: Array<{
    method: string;
    label: string;
    count: number;
    amount: number;
    refunded: number;
    netAmount: number;
  }>;
  categorySales: Array<{
    categoryId: string;
    categoryName: string;
    quantitySold: number;
    revenue: number;
  }>;
  productSales?: Array<{
    productId: string;
    itemCode: string;
    name: string;
    categoryName: string;
    quantitySold: number;
    unitPriceSnapshot: number;
    discountAmount: number;
    vatAmount: number;
    lineTotal: number;
  }>;
  reconciliation: {
    valid: boolean;
    difference: number;
    totalPaymentSum: number;
    totalCollectedSum: number;
    warnings: string[];
  };
  generatedAtVn: string;
}

interface EndOfDayThermalReceiptProps {
  data: EndOfDayReportData;
  showItemDetails?: boolean;
}

/**
 * Mẫu in nhiệt 80mm Báo cáo Tổng kết cuối ngày / Kết ca (Chuẩn máy in XP-80C & ESC/POS)
 * Thiết kế monochrome đen trắng sắc nét, căn lề chuẩn monospace, không tràn mép, tiết kiệm giấy.
 */
export const EndOfDayThermalReceipt: React.FC<EndOfDayThermalReceiptProps> = ({
  data,
  showItemDetails = false,
}) => {
  const { period, branch, staff, summary, payments, categorySales, productSales, generatedAtVn } =
    data;

  return (
    <div
      id="avora-thermal-receipt-80mm"
      className="bg-white text-black font-mono text-[12px] leading-tight select-none print:m-0"
      style={{
        width: '76mm', // An toàn trong khổ in khả dụng của máy in 80mm
        margin: '0 auto',
        padding: '2mm 1mm',
        color: '#000',
        backgroundColor: '#fff',
      }}
    >
      {/* 1. Header Thương Hiệu */}
      <div className="text-center mb-2">
        <h1 className="text-[17px] font-black tracking-widest uppercase m-0 leading-none">
          AVORA
        </h1>
        <p className="text-[14px] font-bold uppercase mt-1 mb-1">TỔNG KẾT CUỐI NGÀY</p>
        <p className="text-[10.5px] font-medium text-gray-800">
          {period.from} - {period.to}
        </p>
        <p className="text-[10.5px] font-medium text-gray-800 truncate">
          Chi nhánh: {branch.name}
        </p>
        {staff?.name && (
          <p className="text-[10.5px] font-medium text-gray-800">
            Nhân viên: {staff.name}
          </p>
        )}
      </div>

      {/* Dải phân cách */}
      <div className="border-b border-dashed border-black my-1.5" />

      {/* 2. Bảng Tổng Kết Tài Chính */}
      <div className="flex justify-between items-center font-bold text-[12px] pb-1 border-b border-black">
        <span>TỔNG KẾT</span>
        <span>SỐ TIỀN</span>
      </div>

      <div className="space-y-1 py-1 text-[11.5px]">
        <div className="flex justify-between items-center">
          <span>1. Số đơn hoàn thành</span>
          <span className="font-bold">{summary.completedOrderCount}</span>
        </div>

        {summary.cancelledOrderCount > 0 && (
          <div className="flex justify-between items-center text-[10.5px] italic pl-2 text-gray-600">
            <span>(Số đơn hủy tham khảo)</span>
            <span>{summary.cancelledOrderCount}</span>
          </div>
        )}

        <div className="flex justify-between items-center font-semibold pt-0.5">
          <span>2. Tổng giảm giá</span>
          <span>{formatVNDRaw(summary.totalDiscount)}</span>
        </div>
        <div className="text-[10.5px] pl-3 space-y-0.5">
          <div className="flex justify-between">
            <span>- Giảm trên món</span>
            <span>{formatVNDRaw(summary.totalDirectItemDiscount)}</span>
          </div>
          <div className="flex justify-between">
            <span>- Voucher / Điểm</span>
            <span>{formatVNDRaw(summary.totalVoucherDiscount)}</span>
          </div>
          <div className="flex justify-between">
            <span>- Voucher vận chuyển</span>
            <span>{formatVNDRaw(summary.totalShippingDiscount)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center font-bold pt-1 border-t border-dotted border-gray-400">
          <span>3. Tổng doanh thu</span>
          <span className="text-[12.5px]">{formatVNDRaw(summary.totalGrossSales)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span>4. VAT</span>
          <span>{formatVNDRaw(summary.totalVat)}</span>
        </div>

        <div className="flex justify-between items-center font-bold">
          <span>5. Doanh thu ròng</span>
          <span>{formatVNDRaw(summary.netSales)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span>6. Refund (Hoàn tiền)</span>
          <span>{formatVNDRaw(summary.refundTotal)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span>7. Phí giao hàng</span>
          <span>{formatVNDRaw(summary.shippingFeeCustomerPaid)}</span>
        </div>
        {summary.serviceChargeTotal > 0 && (
          <div className="flex justify-between items-center">
            <span>   Phụ thu / Service</span>
            <span>{formatVNDRaw(summary.serviceChargeTotal)}</span>
          </div>
        )}

        <div className="flex justify-between items-center font-black text-[13px] pt-1.5 pb-1 border-t-2 border-black">
          <span>8. THỰC THU</span>
          <span>{formatVNDRaw(summary.totalActualCollected)}</span>
        </div>
      </div>

      {/* Dải phân cách */}
      <div className="border-b border-dashed border-black my-1.5" />

      {/* 3. Phương Thức Thanh Toán */}
      <div className="text-center font-bold text-[12px] uppercase mb-1">
        PHƯƠNG THỨC THANH TOÁN
      </div>

      <div className="space-y-1 text-[11.5px] py-1">
        {payments.length === 0 ? (
          <div className="text-center italic text-gray-500 py-1">Chưa có giao dịch thanh toán</div>
        ) : (
          payments.map((p) => (
            <div key={p.method} className="flex justify-between items-center">
              <span className="truncate pr-1">
                {p.label} ({p.count})
              </span>
              <span className="font-bold shrink-0">{formatVNDRaw(p.netAmount)}</span>
            </div>
          ))
        )}
      </div>

      {/* Dải phân cách */}
      <div className="border-b border-dashed border-black my-1.5" />

      {/* 4. Hàng Hóa Bán Ra */}
      <div className="text-center font-bold text-[12px] uppercase mb-1">HÀNG HÓA BÁN RA</div>

      {/* Bảng nhóm Category */}
      <div className="text-[11px] pb-1 border-b border-black flex justify-between font-bold">
        <span className="w-1/2">NHÓM HÀNG</span>
        <span className="w-1/6 text-center">SL</span>
        <span className="w-1/3 text-right">DOANH THU</span>
      </div>

      <div className="space-y-1 py-1 text-[11px]">
        {categorySales.map((cat) => (
          <div key={cat.categoryId} className="flex justify-between items-center">
            <span className="w-1/2 truncate font-semibold">{cat.categoryName}</span>
            <span className="w-1/6 text-center font-bold">{cat.quantitySold}</span>
            <span className="w-1/3 text-right font-bold">{formatVNDRaw(cat.revenue)}</span>
          </div>
        ))}
      </div>

      {/* Chi tiết từng mặt hàng nếu bật toggle */}
      {showItemDetails && productSales && productSales.length > 0 && (
        <div className="mt-2 pt-1 border-t border-dotted border-gray-400">
          <div className="text-center font-bold text-[11px] uppercase mb-1 text-gray-700">
            CHI TIẾT TỪNG MÓN
          </div>
          <div className="space-y-1 text-[10px]">
            {productSales.map((prod) => (
              <div key={prod.productId} className="flex justify-between items-start border-b border-gray-100 pb-0.5">
                <div className="w-3/5 truncate">
                  <p className="font-bold truncate">{prod.name}</p>
                  <p className="text-[9px] text-gray-500">{prod.itemCode}</p>
                </div>
                <div className="w-1/5 text-center font-bold">{prod.quantitySold}</div>
                <div className="w-1/5 text-right font-bold">{formatVNDRaw(prod.lineTotal)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dải phân cách */}
      <div className="border-b border-dashed border-black my-2" />

      {/* 5. Footer Phiếu In */}
      <div className="text-center text-[10.5px] space-y-0.5 mt-2">
        <p className="text-gray-700">{generatedAtVn}</p>
        <p className="font-black text-[12px] tracking-wider uppercase">AVORA POS</p>
      </div>
    </div>
  );
};
