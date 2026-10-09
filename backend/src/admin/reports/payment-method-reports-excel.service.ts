import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  PaymentMethodKPIsSummary,
  PaymentMethodSummaryItem,
  PaymentMethodBranchSummaryItem,
  PaymentMethodTrendItem,
  CalculatedOrderPaymentAudit,
  PaymentMethodReconciliationResult,
} from './payment-method-report-calculation.service';

@Injectable()
export class PaymentMethodReportsExcelService {
  private readonly logger = new Logger(PaymentMethodReportsExcelService.name);

  // Corporate Brand Colors
  private readonly BRAND_PRIMARY = '800020'; // Burgundy
  private readonly BRAND_HEADER_BG = '1E293B'; // Slate 800
  private readonly BRAND_ZEBRA = 'F8FAFC'; // Slate 50
  private readonly BRAND_BORDER = 'CBD5E1'; // Slate 300
  private readonly BRAND_SUCCESS = '15803D'; // Emerald 700
  private readonly BRAND_DANGER = 'B91C1C'; // Red 700
  private readonly BRAND_WARNING = 'D97706'; // Amber 600

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
    row.height = 28;
  }

  private autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 12, maxWidth = 45) {
    worksheet.columns.forEach((column) => {
      let maxLen = minWidth;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const valStr = cell.value ? cell.value.toString() : '';
        const len = valStr.length + 3;
        if (len > maxLen) {
          maxLen = len;
        }
      });
      column.width = Math.min(maxLen, maxWidth);
    });
  }

  private applyCellBorder(cell: ExcelJS.Cell) {
    cell.border = {
      top: { style: 'thin', color: { argb: this.BRAND_BORDER } },
      bottom: { style: 'thin', color: { argb: this.BRAND_BORDER } },
      left: { style: 'thin', color: { argb: this.BRAND_BORDER } },
      right: { style: 'thin', color: { argb: this.BRAND_BORDER } },
    };
  }

  /**
   * Tạo Workbook Excel 6 Sheets chuẩn Báo Cáo Phương Thức Thanh Toán AVORA
   */
  async generatePaymentMethodExcelWorkbook(data: {
    kpis: PaymentMethodKPIsSummary;
    methods: PaymentMethodSummaryItem[];
    branches: PaymentMethodBranchSummaryItem[];
    trend: PaymentMethodTrendItem[];
    transactions: CalculatedOrderPaymentAudit[];
    reconciliation: PaymentMethodReconciliationResult;
    filterInfo: {
      from: string;
      to: string;
      branchName?: string;
      orderSource?: string;
      orderType?: string;
    };
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Restaurant Enterprise Management System';
    workbook.lastModifiedBy = 'AVORA Payment Reconciliation Engine';
    workbook.created = new Date();
    workbook.modified = new Date();

    // -------------------------------------------------------------
    // SHEET 1: TỔNG QUAN (SUMMARY & KPIS)
    // -------------------------------------------------------------
    const wsSummary = workbook.addWorksheet('1. Tổng Quan KPI');
    wsSummary.views = [{ showGridLines: true }];

    wsSummary.mergeCells('A1:F2');
    const titleCell = wsSummary.getCell('A1');
    titleCell.value = 'BÁO CÁO PHƯƠNG THỨC THANH TOÁN AVORA (COMPLETED ORDERS ONLY)';
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    wsSummary.addRow([]);
    wsSummary.addRow(['Thời gian báo cáo:', `${data.filterInfo.from} đến ${data.filterInfo.to}`]);
    wsSummary.addRow(['Chi nhánh:', data.filterInfo.branchName || 'Tất cả chi nhánh']);
    wsSummary.addRow(['Nguồn đơn:', data.filterInfo.orderSource || 'Tất cả']);
    wsSummary.addRow(['Loại đơn:', data.filterInfo.orderType || 'Tất cả']);
    wsSummary.addRow(['Thời điểm xuất file:', new Date().toLocaleString('vi-VN')]);
    wsSummary.addRow([]);

    const kpiHeaderRow = wsSummary.addRow(['Chỉ Số KPI', 'Giá Trị', 'Đơn Vị', 'Ghi Chú Nghiệp Vụ']);
    this.styleHeaderRow(kpiHeaderRow, this.BRAND_HEADER_BG);

    const kpiRows = [
      ['Tổng đơn hoàn thành (Completed Orders)', data.kpis.totalCompletedOrders, 'Đơn', 'Chỉ tính đơn trạng thái COMPLETED'],
      ['Tổng doanh thu (Gross Revenue)', data.kpis.totalGrossRevenue, 'VND', 'Tổng giá trị đơn hoàn thành'],
      ['Tổng tiền thực thu (Actual Collected)', data.kpis.totalCollectedRevenue, 'VND', 'Tổng tiền đã thanh toán'],
      ['Tổng hoàn tiền (Refunded Amount)', data.kpis.totalRefundedAmount, 'VND', 'Tổng tiền đã hoàn trả khách'],
      ['Doanh thu ròng (Net Collected)', data.kpis.netCollected, 'VND', 'Thực thu - Hoàn tiền'],
      ['Giá trị trung bình/đơn (AOV)', data.kpis.overallAov, 'VND', 'Tổng DT / Tổng đơn hoàn thành'],
      ['Số phương thức đang hoạt động', data.kpis.activeMethodCount, 'Phương thức', 'Có phát sinh giao dịch trong kỳ'],
      ['Phương thức doanh thu cao nhất', data.kpis.topMethodByRevenue ? `${data.kpis.topMethodByRevenue.methodName} (${data.kpis.topMethodByRevenue.grossRevenue.toLocaleString('vi-VN')} đ)` : 'N/A', 'Phương thức', data.kpis.topMethodByRevenue ? `${data.kpis.topMethodByRevenue.revenueSharePercent.toFixed(2)}% tổng DT` : '-'],
      ['Phương thức nhiều đơn nhất', data.kpis.topMethodByOrders ? `${data.kpis.topMethodByOrders.methodName} (${data.kpis.topMethodByOrders.orderCount} đơn)` : 'N/A', 'Phương thức', data.kpis.topMethodByOrders ? `${data.kpis.topMethodByOrders.orderSharePercent.toFixed(2)}% tổng đơn` : '-'],
      ['Tỷ lệ Tiền mặt (Cash Rate)', `${(100 - data.kpis.cashlessRatePercent).toFixed(2)}%`, '%', 'Đơn tiền mặt / Tổng đơn'],
      ['Tỷ lệ Không tiền mặt (Cashless Rate)', `${data.kpis.cashlessRatePercent.toFixed(2)}%`, '%', 'Chuyển khoản, Thẻ, QR, Ví điện tử...'],
    ];

    kpiRows.forEach((row, idx) => {
      const addedRow = wsSummary.addRow(row);
      addedRow.eachCell((cell, colIdx) => {
        this.applyCellBorder(cell);
        if (colIdx === 2 && typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      });
      if (idx % 2 === 1) {
        addedRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsSummary);

    // -------------------------------------------------------------
    // SHEET 2: THEO PHƯƠNG THỨC THANH TOÁN (BREAKDOWN)
    // -------------------------------------------------------------
    const wsMethods = workbook.addWorksheet('2. Theo Phương Thức');
    wsMethods.views = [{ showGridLines: true }];

    const methodHeader = wsMethods.addRow([
      'Mã Phương Thức',
      'Tên Phương Thức',
      'Số Đơn Hoàn Thành',
      'Tỷ Trọng Số Đơn (%)',
      'Số Giao Dịch',
      'Tổng Doanh Thu (VND)',
      'Tỷ Trọng Doanh Thu (%)',
      'Hoàn Tiền (VND)',
      'Net Thu (VND)',
      'AOV (VND)',
      'Loại (Cash/Cashless)',
    ]);
    this.styleHeaderRow(methodHeader);

    data.methods.forEach((m, idx) => {
      const row = wsMethods.addRow([
        m.methodCode,
        m.methodName,
        m.orderCount,
        m.orderSharePercent,
        m.transactionCount,
        m.grossRevenue,
        m.revenueSharePercent,
        m.refundedAmount,
        m.netCollected,
        m.averageOrderValue,
        m.isCash ? 'Cash' : 'Cashless',
      ]);
      row.eachCell((cell, colIdx) => {
        this.applyCellBorder(cell);
        if ([3, 5, 6, 8, 9, 10].includes(colIdx)) {
          cell.numFmt = '#,##0';
        } else if ([4, 7].includes(colIdx)) {
          cell.numFmt = '0.00"%"';
        }
      });
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    // Dòng TỔNG CỘNG
    const methodTotalRow = wsMethods.addRow([
      'TỔNG CỘNG',
      `${data.kpis.activeMethodCount} phương thức`,
      data.kpis.totalCompletedOrders,
      100.0,
      data.methods.reduce((sum, m) => sum + m.transactionCount, 0),
      data.kpis.totalGrossRevenue,
      100.0,
      data.kpis.totalRefundedAmount,
      data.kpis.netCollected,
      data.kpis.overallAov,
      '-',
    ]);
    methodTotalRow.eachCell((cell, colIdx) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_HEADER_BG } };
      this.applyCellBorder(cell);
      if ([3, 5, 6, 8, 9, 10].includes(colIdx)) {
        cell.numFmt = '#,##0';
      } else if ([4, 7].includes(colIdx)) {
        cell.numFmt = '0.00"%"';
      }
    });

    this.autoFitColumns(wsMethods);

    // -------------------------------------------------------------
    // SHEET 3: THEO CHI NHÁNH (BRANCH BREAKDOWN)
    // -------------------------------------------------------------
    const wsBranches = workbook.addWorksheet('3. So Sánh Chi Nhánh');
    wsBranches.views = [{ showGridLines: true }];

    const branchHeader = wsBranches.addRow([
      'Mã Chi Nhánh',
      'Tên Chi Nhánh',
      'Tổng Đơn Hoàn Thành',
      'Tổng Doanh Thu (VND)',
      'Tổng Hoàn Tiền (VND)',
      'Net Thu (VND)',
      'Đơn Tiền Mặt',
      'Đơn Không Tiền Mặt',
      'Tỷ Lệ Cashless (%)',
    ]);
    this.styleHeaderRow(branchHeader);

    data.branches.forEach((b, idx) => {
      const row = wsBranches.addRow([
        b.branchCode,
        b.branchName,
        b.totalOrders,
        b.totalRevenue,
        b.totalRefunded,
        b.netCollected,
        b.cashOrders,
        b.cashlessOrders,
        b.cashlessRatePercent,
      ]);
      row.eachCell((cell, colIdx) => {
        this.applyCellBorder(cell);
        if ([3, 4, 5, 6, 7, 8].includes(colIdx)) {
          cell.numFmt = '#,##0';
        } else if (colIdx === 9) {
          cell.numFmt = '0.00"%"';
        }
      });
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsBranches);

    // -------------------------------------------------------------
    // SHEET 4: XU HƯỚNG THEO NGÀY (DAILY TREND)
    // -------------------------------------------------------------
    const wsTrend = workbook.addWorksheet('4. Xu Hướng Thời Gian');
    wsTrend.views = [{ showGridLines: true }];

    const trendHeader = wsTrend.addRow([
      'Ngày',
      'Hiển Thị',
      'Số Đơn Hoàn Thành',
      'Doanh Thu (VND)',
      'Hoàn Tiền (VND)',
      'Net Thu (VND)',
    ]);
    this.styleHeaderRow(trendHeader);

    data.trend.forEach((t, idx) => {
      const row = wsTrend.addRow([
        t.dateKey,
        t.displayDate,
        t.totalOrders,
        t.totalRevenue,
        t.refundedAmount,
        t.netCollected,
      ]);
      row.eachCell((cell, colIdx) => {
        this.applyCellBorder(cell);
        if ([3, 4, 5, 6].includes(colIdx)) {
          cell.numFmt = '#,##0';
        }
      });
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsTrend);

    // -------------------------------------------------------------
    // SHEET 5: DRILL-DOWN GIAO DỊCH (TRANSACTIONS)
    // -------------------------------------------------------------
    const wsTrans = workbook.addWorksheet('5. Chi Tiết Giao Dịch');
    wsTrans.views = [{ showGridLines: true }];

    const transHeader = wsTrans.addRow([
      'Mã Đơn Hàng',
      'Thời Điểm Hoàn Thành',
      'Chi Nhánh',
      'Khách Hàng',
      'Phương Thức Chính',
      'Tổng Tiền Đơn (VND)',
      'Thực Thu (VND)',
      'Hoàn Tiền (VND)',
      'Net Thu (VND)',
      'Trạng Thái TT',
      'Split Payment',
      'Nguồn Đơn',
      'Loại Đơn',
      'Thu Ngân',
    ]);
    this.styleHeaderRow(transHeader);

    data.transactions.forEach((tx, idx) => {
      const row = wsTrans.addRow([
        tx.orderCode,
        tx.completionTimestamp ? new Date(tx.completionTimestamp).toLocaleString('vi-VN') : '',
        tx.branchName,
        tx.customerName,
        tx.primaryPaymentMethodName,
        tx.orderTotalAmount,
        tx.collectedRevenue,
        tx.refundedAmount,
        tx.netCollected,
        tx.paymentStatus,
        tx.isSplitPayment ? 'Có' : 'Không',
        tx.orderSource,
        tx.orderType,
        tx.cashierName || '-',
      ]);
      row.eachCell((cell, colIdx) => {
        this.applyCellBorder(cell);
        if ([6, 7, 8, 9].includes(colIdx)) {
          cell.numFmt = '#,##0';
        }
      });
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsTrans);

    // -------------------------------------------------------------
    // SHEET 6: ĐỐI SOÁT TOÁN HỌC (RECONCILIATION)
    // -------------------------------------------------------------
    const wsRecon = workbook.addWorksheet('6. Đối Soát Toán Học');
    wsRecon.views = [{ showGridLines: true }];

    wsRecon.mergeCells('A1:E2');
    const reconTitleCell = wsRecon.getCell('A1');
    reconTitleCell.value = 'KẾT QUẢ ĐỐI SOÁT PHƯƠNG THỨC THANH TOÁN (ZERO-TOLERANCE RECONCILIATION)';
    reconTitleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: data.reconciliation.isReconciled ? this.BRAND_SUCCESS : this.BRAND_DANGER } };
    reconTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    wsRecon.addRow([]);
    wsRecon.addRow(['Trạng thái đối soát:', data.reconciliation.isReconciled ? 'CHÍNH XÁC TUYỆT ĐỐI (100% RECONCILED)' : 'CẢNH BÁO LỆCH SỐ LIỆU']);
    wsRecon.addRow([]);

    const reconHeader = wsRecon.addRow(['Mục Đối Soát', 'Giá Trị Kỳ Vọng (Expected)', 'Giá Trị Thực Tế (Actual)', 'Chênh Lệch (Difference)', 'Trạng Thái']);
    this.styleHeaderRow(reconHeader, this.BRAND_HEADER_BG);

    const reconItems = [
      ['Tổng Doanh Thu (Gross Revenue)', data.reconciliation.expectedRevenue, data.reconciliation.actualRevenue, data.reconciliation.discrepancyRevenue],
      ['Tổng Số Đơn Hoàn Thành (Orders)', data.reconciliation.expectedOrderCount, data.reconciliation.actualOrderCount, data.reconciliation.discrepancyOrderCount],
      ['Tổng Hoàn Tiền (Refunded)', data.reconciliation.expectedRefund, data.reconciliation.actualRefund, data.reconciliation.discrepancyRefund],
      ['Tổng Doanh Thu Ròng (Net Collected)', data.reconciliation.expectedNetCollected, data.reconciliation.actualNetCollected, data.reconciliation.discrepancyNetCollected],
    ];

    reconItems.forEach((item, idx) => {
      const diff = Number(item[3]);
      const status = diff === 0 ? 'KHỚP TUYỆT ĐỐI' : 'LỆCH SỐ LIỆU';
      const row = wsRecon.addRow([item[0], item[1], item[2], diff, status]);
      row.eachCell((cell, colIdx) => {
        this.applyCellBorder(cell);
        if ([2, 3, 4].includes(colIdx)) {
          cell.numFmt = '#,##0';
        }
        if (colIdx === 5) {
          cell.font = { bold: true, color: { argb: diff === 0 ? this.BRAND_SUCCESS : this.BRAND_DANGER } };
        }
      });
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    if (data.reconciliation.notes.length > 0) {
      wsRecon.addRow([]);
      const warnHeader = wsRecon.addRow(['Danh Sách Ghi Chú / Cảnh Báo Đối Soát']);
      this.styleHeaderRow(warnHeader, this.BRAND_WARNING);
      data.reconciliation.notes.forEach((w) => {
        wsRecon.addRow([w]);
      });
    }

    this.autoFitColumns(wsRecon);

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }
}
