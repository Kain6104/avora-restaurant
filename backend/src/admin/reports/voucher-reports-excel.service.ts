import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  CalculatedVoucherKPIs,
  CalculatedVoucherPerformanceItem,
  VoucherFraudSignalItem,
  VoucherOrderInput,
} from './voucher-report-calculation.service';

@Injectable()
export class VoucherReportsExcelService {
  private readonly logger = new Logger(VoucherReportsExcelService.name);

  // AVORA Brand Colors
  private readonly BRAND_PRIMARY = '800020'; // Burgundy
  private readonly BRAND_HEADER_BG = '1E293B'; // Slate 800
  private readonly BRAND_ZEBRA = 'F8FAFC'; // Slate 50
  private readonly BRAND_BORDER = 'E2E8F0'; // Slate 200

  private styleHeaderRow(row: ExcelJS.Row, bgColor = this.BRAND_PRIMARY, fontColor = 'FFFFFF') {
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor },
      };
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: true,
        color: { argb: fontColor },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: this.BRAND_BORDER } },
        bottom: { style: 'medium', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: this.BRAND_BORDER } },
        right: { style: 'thin', color: { argb: this.BRAND_BORDER } },
      };
    });
    row.height = 26;
  }

  private autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 12, maxWidth = 45) {
    worksheet.columns.forEach((column) => {
      let maxLen = minWidth;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const valStr = cell.value ? cell.value.toString() : '';
        const len = valStr.length + 3;
        if (len > maxLen) maxLen = len;
      });
      column.width = Math.min(maxLen, maxWidth);
    });
  }

  async exportVoucherExcel(
    kpis: CalculatedVoucherKPIs,
    performanceList: CalculatedVoucherPerformanceItem[],
    transactions: VoucherOrderInput[],
    fraudSignals: VoucherFraudSignalItem[],
    branchName: string = 'Toàn hệ thống',
    from: string = '',
    to: string = '',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Restaurant Enterprise Reporting Engine';
    workbook.created = new Date();

    // ==========================================
    // SHEET 1: HIỆU SUẤT VOUCHER & KHUYẾN MÃI
    // ==========================================
    const wsSummary = workbook.addWorksheet('Hiệu Suất Voucher');
    wsSummary.views = [{ showGridLines: true }];

    // Title
    wsSummary.mergeCells('A1:J1');
    const titleCell = wsSummary.getCell('A1');
    titleCell.value = 'BÁO CÁO HIỆU SUẤT VOUCHER & MÃ KHUYẾN MÃI (CHỈ ĐƠN HOÀN THÀNH)';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsSummary.getRow(1).height = 30;

    wsSummary.mergeCells('A2:J2');
    const subCell = wsSummary.getCell('A2');
    subCell.value = `Chi nhánh: ${branchName} | Thời gian: ${from || 'Toàn thời gian'} đến ${to || 'Hiện tại'} | Ngày xuất: ${new Date().toLocaleString('vi-VN')}`;
    subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: '64748B' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // KPI Blocks
    wsSummary.addRow([]);
    const kpiHeaders = [
      'Đơn Hoàn Thành Có Mã',
      'Doanh Thu Trước Giảm (Gross)',
      'Tổng Chi Phí Giảm Giá (Cost)',
      'Doanh Thu Thuần (Net)',
      'Tỷ Lệ Doanh Thu/Discount (ROI)',
      'AOV Có Voucher',
      'AOV Không Voucher',
      'Tăng Trưởng AOV (Incremental)',
      'Khách Mới Dùng Mã',
      'Cảnh Báo Bất Thường',
    ];
    const kpiRow = wsSummary.addRow(kpiHeaders);
    this.styleHeaderRow(kpiRow, this.BRAND_HEADER_BG);

    const kpiValues = [
      kpis.totalCompletedOrdersWithVoucher,
      kpis.grossRevenueGenerated,
      kpis.totalDiscountCost,
      kpis.netRevenueGenerated,
      `${kpis.revenueToDiscountRatio}x`,
      kpis.voucherAov,
      kpis.nonVoucherAov,
      kpis.incrementalAov,
      kpis.firstOrderVoucherUsageCount,
      kpis.potentialAbuseSignalsCount,
    ];
    const kpiValRow = wsSummary.addRow(kpiValues);
    kpiValRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      if ([2, 3, 4, 6, 7, 8].includes(colNumber)) {
        cell.numFmt = '#,##0 "₫"';
      } else if ([1, 9, 10].includes(colNumber)) {
        cell.numFmt = '#,##0';
      }
    });
    kpiValRow.height = 24;

    wsSummary.addRow([]);
    wsSummary.addRow(['DANH SÁCH HIỆU SUẤT TỪNG VOUCHER']);
    wsSummary.getCell('A6').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: this.BRAND_PRIMARY } };

    // Table Headers
    const perfHeaders = [
      'Mã Voucher',
      'Tên Chương Trình',
      'Loại Giảm Giá',
      'Số Lượt Dùng Hoàn Thành',
      'Số Khách Duy Nhất',
      'Doanh Thu Gross (₫)',
      'Chi Phí Giảm Giá (₫)',
      'Doanh Thu Net (₫)',
      'AOV (₫)',
      'Tỷ Lệ Doanh Thu/Chiết Khấu (ROI)',
    ];
    const perfHeaderRow = wsSummary.addRow(perfHeaders);
    this.styleHeaderRow(perfHeaderRow, this.BRAND_PRIMARY);

    for (const v of performanceList) {
      const row = wsSummary.addRow([
        v.code,
        v.title,
        v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : v.discountType === 'FREE_SHIP' ? 'Freeship' : `${v.discountValue.toLocaleString('vi-VN')}₫`,
        v.completedUses,
        v.uniqueUsers,
        v.grossRevenue,
        v.totalDiscountCost,
        v.netRevenue,
        v.aov,
        `${v.revenueToDiscountRatio}x`,
      ]);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([6, 7, 8, 9].includes(colNumber)) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if ([4, 5].includes(colNumber)) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    }

    this.autoFitColumns(wsSummary);

    // ==========================================
    // SHEET 2: DANH SÁCH GIAO DỊCH ĐƠN HÀNG VOUCHER
    // ==========================================
    const wsTx = workbook.addWorksheet('Giao Dịch Đơn Voucher');
    wsTx.views = [{ showGridLines: true }];

    const txHeaders = [
      'Mã Đơn Hàng',
      'Ngày Hoàn Thành',
      'Khách Hàng',
      'Số Điện Thoại',
      'Chi Nhánh',
      'Mã Voucher',
      'Nguồn Đơn',
      'Doanh Thu Gross (₫)',
      'Giảm Giá Voucher (₫)',
      'Giảm Giá Ship (₫)',
      'Thực Thu (₫)',
      'PT Thanh Toán',
    ];
    const txHeaderRow = wsTx.addRow(txHeaders);
    this.styleHeaderRow(txHeaderRow, this.BRAND_HEADER_BG);

    for (const tx of transactions) {
      const vCode = tx.discountVoucherCodeSnapshot || tx.shippingVoucherCodeSnapshot || (tx.voucherId ? 'VOUCHER' : '—');
      const row = wsTx.addRow([
        tx.orderCode || tx.id.slice(0, 8),
        tx.deliveredAt ? new Date(tx.deliveredAt).toLocaleString('vi-VN') : new Date(tx.createdAt).toLocaleString('vi-VN'),
        tx.customerName || 'Khách vãng lai',
        tx.customerPhone || '—',
        tx.branchName || tx.branchId,
        vCode,
        tx.orderSource,
        tx.subTotal,
        tx.discountAmount,
        tx.shippingDiscount,
        tx.totalAmount,
        tx.paymentMethod,
      ]);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([8, 9, 10, 11].includes(colNumber)) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsTx);

    // ==========================================
    // SHEET 3: DẤU HIỆU BẤT THƯỜNG / GIAN LẬN
    // ==========================================
    const wsFraud = workbook.addWorksheet('Dấu Hiệu Bất Thường');
    wsFraud.views = [{ showGridLines: true }];

    const fraudHeaders = [
      'Mã Đơn Hàng',
      'Mã Voucher',
      'Khách Hàng',
      'Số Điện Thoại',
      'Thời Điểm',
      'Loại Dấu Hiệu',
      'Mức Độ Rủi Ro',
      'Giá Trị Đơn (₫)',
      'Số Tiền Giảm (₫)',
      'Mô Tả Chi Tiết',
    ];
    const fraudHeaderRow = wsFraud.addRow(fraudHeaders);
    this.styleHeaderRow(fraudHeaderRow, 'B91C1C'); // Red alert header

    for (const sig of fraudSignals) {
      const row = wsFraud.addRow([
        sig.orderCode,
        sig.voucherCode,
        sig.customerName,
        sig.customerPhone,
        new Date(sig.completedAt).toLocaleString('vi-VN'),
        sig.signalType,
        sig.severity,
        sig.grossAmount,
        sig.discountAmount,
        sig.description,
      ]);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([8, 9].includes(colNumber)) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsFraud);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
