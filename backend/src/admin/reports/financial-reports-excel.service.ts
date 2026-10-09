import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  CalculatedOrderFinancials,
  FinancialKPIsSummary,
  BranchFinancialSummary,
  PaymentMethodFinancialSummary,
  VatRateFinancialSummary,
  DiscountFinancialSummary,
  DailyRevenueFinancialSummary,
} from './financial-report-calculation.service';

@Injectable()
export class FinancialReportsExcelService {
  private readonly logger = new Logger(FinancialReportsExcelService.name);

  // AVORA Brand Colors
  private readonly BRAND_PRIMARY = '800020'; // Burgundy
  private readonly BRAND_SECONDARY = 'B91C1C'; // Red
  private readonly BRAND_HEADER_BG = '1E293B'; // Slate 800
  private readonly BRAND_ZEBRA = 'F8FAFC'; // Slate 50
  private readonly BRAND_BORDER = 'E2E8F0'; // Slate 200
  private readonly BRAND_HIGHLIGHT = 'FEF2F2'; // Light Burgundy Tint

  /**
   * Helper format header cells
   */
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

  /**
   * Helper auto-fit column widths
   */
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

  /**
   * Helper border thin for data cells
   */
  private applyCellBorder(cell: ExcelJS.Cell) {
    cell.border = {
      top: { style: 'thin', color: { argb: this.BRAND_BORDER } },
      bottom: { style: 'thin', color: { argb: this.BRAND_BORDER } },
      left: { style: 'thin', color: { argb: this.BRAND_BORDER } },
      right: { style: 'thin', color: { argb: this.BRAND_BORDER } },
    };
  }

  /**
   * Xuất toàn bộ báo cáo tài chính AVORA ra file Excel 8 Sheets
   */
  async generateFinancialWorkbook(data: {
    filterSummary: string;
    summary: FinancialKPIsSummary;
    branchBreakdown: BranchFinancialSummary[];
    paymentBreakdown: PaymentMethodFinancialSummary[];
    vatBreakdown: VatRateFinancialSummary[];
    discountBreakdown: DiscountFinancialSummary;
    dailyTrend: DailyRevenueFinancialSummary[];
    orders: CalculatedOrderFinancials[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ Thống Nhà Hàng Cao Cấp AVORA';
    workbook.lastModifiedBy = 'AVORA Financial Reconciliation Engine';
    workbook.created = new Date();
    workbook.modified = new Date();

    // =========================================================================
    // SHEET 1: TỔNG QUAN KPI TÀI CHÍNH
    // =========================================================================
    const wsOverview = workbook.addWorksheet('1. Tổng Quan KPI');
    wsOverview.views = [{ showGridLines: true }];

    wsOverview.addRow(['AVORA RESTAURANT ENTERPRISE - BÁO CÁO TÀI CHÍNH CHI TIẾT']);
    wsOverview.mergeCells('A1:D1');
    const titleCell = wsOverview.getCell('A1');
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell.alignment = { vertical: 'middle' };
    wsOverview.getRow(1).height = 32;

    wsOverview.addRow([`Bộ lọc & Thời gian: ${data.filterSummary}`]);
    wsOverview.mergeCells('A2:D2');
    wsOverview.getCell('A2').font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };

    wsOverview.addRow([`Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')} | Đơn vị tiền tệ: VND (₫)`]);
    wsOverview.mergeCells('A3:D3');
    wsOverview.getCell('A3').font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };
    wsOverview.addRow([]);

    // Bảng KPI
    const headerRow = wsOverview.addRow(['STT', 'CHỈ SỐ TÀI CHÍNH (KPI)', 'GIÁ TRỊ', 'ĐƠN VỊ']);
    this.styleHeaderRow(headerRow, this.BRAND_PRIMARY);

    const s = data.summary;
    const kpiRows = [
      ['1', 'Tổng số đơn hàng phát sinh', s.totalOrderCount, 'Đơn'],
      ['2', 'Đơn hàng thành công (Completed)', s.completedOrderCount, 'Đơn'],
      ['3', 'Đơn hàng đã hủy (Cancelled)', s.cancelledOrderCount, 'Đơn'],
      ['4', 'Đơn hàng có phát sinh hoàn tiền (Refunded)', s.refundedOrderCount, 'Đơn'],
      ['5', 'Tổng số lượng món ăn phục vụ', s.totalItemsSold, 'Món'],
      ['6', 'Số lượng khách hàng giao dịch', s.distinctCustomerCount, 'Khách'],
      ['7', 'Tổng tiền hàng trước giảm giá (Gross Item Amount)', s.grossItemAmount, '₫'],
      ['8', 'Tổng tiền Topping / Option', s.optionAmount, '₫'],
      ['9', 'Tổng tiền món gốc niêm yết', s.baseItemAmount, '₫'],
      ['10', 'Tổng giảm giá Flash Sale', s.flashSaleDiscount, '₫'],
      ['11', 'Tổng giảm giá trực tiếp trên món', s.directItemDiscount, '₫'],
      ['12', 'Tổng Voucher giảm giá toàn đơn', s.orderVoucherDiscount, '₫'],
      ['13', 'Tổng Voucher & Miễn giảm phí giao hàng', s.shippingDiscount, '₫'],
      ['14', 'Tổng điểm thưởng Loyalty đã quy đổi', s.pointsDiscount, '₫'],
      ['15', 'Tổng chiết khấu & Khuyến mãi toàn hệ thống', s.totalDiscountOverall, '₫'],
      ['16', 'Tổng phụ phí dịch vụ tại quầy (Service Charge)', s.serviceChargeTotal, '₫'],
      ['17', 'Tổng thuế VAT (Món ăn + Phụ thu dịch vụ)', s.vatTotalAmount, '₫'],
      ['18', 'Doanh thu thuần trước thuế (Taxable Revenue)', s.revenueBeforeVat, '₫'],
      ['19', 'Doanh thu thuần sau thuế', s.revenueWithVat, '₫'],
      ['20', 'Gross Sales (Tổng giá trị thực phẩm & dịch vụ)', s.grossSales, '₫'],
      ['21', 'Net Sales (Doanh thu ròng từ món & dịch vụ)', s.netSales, '₫'],
      ['22', 'Phí vận chuyển gốc tính theo khoảng cách', s.shippingFeeOriginal, '₫'],
      ['23', 'Phí vận chuyển khách thực trả', s.shippingFeeCustomerPaid, '₫'],
      ['24', 'Phí vận chuyển do AVORA hỗ trợ', s.shippingFeeSubsidized, '₫'],
      ['25', 'Tổng tiền khách hàng thanh toán (Grand Total)', s.totalCustomerPayable, '₫'],
      ['26', 'Tổng tiền thực tế đã thu (Collected Revenue)', s.totalCollectedRevenue, '₫'],
      ['27', 'Tổng tiền công nợ / chưa thu (Outstanding)', s.totalOutstandingRevenue, '₫'],
      ['28', 'Tổng tiền hoàn trả khách (Refunded Amount)', s.totalRefundedAmount, '₫'],
      ['29', 'Thực thu ròng sau hoàn tiền (Net Collected)', s.netCollectedRevenue, '₫'],
      ['30', 'Giá trị đơn hàng trung bình (AOV)', s.averageOrderValue, '₫'],
      ['31', 'Tỷ lệ đối soát chuẩn xác tuyệt đối', `${s.reconciliationHealth.reconciliationRatePercent}%`, '%'],
    ];

    kpiRows.forEach((r, idx) => {
      const row = wsOverview.addRow(r);
      const isZebra = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        this.applyCellBorder(cell);
        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        }
        if (colNum === 1) cell.alignment = { horizontal: 'center' };
        if (colNum === 3 && typeof r[2] === 'number') {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
          cell.font = { bold: true };
        }
      });
    });

    this.autoFitColumns(wsOverview, 15, 60);

    // =========================================================================
    // SHEET 2: CHI NHÁNH & SO SÁNH ĐA CHIỀU (DÒNG TỔNG CỘNG KHỚP 100%)
    // =========================================================================
    const wsBranch = workbook.addWorksheet('2. So Sánh Chi Nhánh');
    wsBranch.views = [{ showGridLines: true }];

    const bHeader = wsBranch.addRow([
      'Mã CN',
      'Tên Chi Nhánh',
      'Số Đơn',
      'Đơn Thành Công',
      'Món Đã Bán',
      'Gross Sales',
      'Tổng Giảm Giá',
      'VAT',
      'Phí Ship Thu',
      'Phụ Thu',
      'Net Sales',
      'Thực Thu',
      'Hoàn Tiền',
      'Thực Thu Ròng',
      'AOV',
      'Lệch Đối Soát',
    ]);
    this.styleHeaderRow(bHeader, this.BRAND_HEADER_BG);

    let sumOrders = 0;
    let sumCompleted = 0;
    let sumItems = 0;
    let sumGross = 0;
    let sumDiscount = 0;
    let sumVat = 0;
    let sumShip = 0;
    let sumSc = 0;
    let sumNet = 0;
    let sumCollected = 0;
    let sumRefund = 0;
    let sumNetCollected = 0;
    let sumUnreconciled = 0;

    data.branchBreakdown.forEach((b, idx) => {
      sumOrders += b.orderCount;
      sumCompleted += b.completedOrderCount;
      sumItems += b.itemsSold;
      sumGross += b.grossSales;
      sumDiscount += b.totalDiscount;
      sumVat += b.vatAmount;
      sumShip += b.shippingPaid;
      sumSc += b.serviceCharge;
      sumNet += b.netSales;
      sumCollected += b.collectedRevenue;
      sumRefund += b.refundedAmount;
      sumNetCollected += b.netCollected;
      sumUnreconciled += b.unreconciledCount;

      const row = wsBranch.addRow([
        b.branchCode,
        b.branchName,
        b.orderCount,
        b.completedOrderCount,
        b.itemsSold,
        b.grossSales,
        b.totalDiscount,
        b.vatAmount,
        b.shippingPaid,
        b.serviceCharge,
        b.netSales,
        b.collectedRevenue,
        b.refundedAmount,
        b.netCollected,
        b.aov,
        b.unreconciledCount,
      ]);

      const isZebra = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        this.applyCellBorder(cell);
        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        }
        if (colNum >= 3 && colNum <= 5) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        } else if (colNum >= 6 && colNum <= 15) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        } else if (colNum === 16) {
          cell.alignment = { horizontal: 'center' };
          if (b.unreconciledCount > 0) {
            cell.font = { bold: true, color: { argb: this.BRAND_SECONDARY } };
          }
        }
      });
    });

    // DÒNG TỔNG CỘNG KHỚP 100%
    const totalAov = sumCompleted > 0 ? Math.round(sumNet / sumCompleted) : 0;
    const totalRow = wsBranch.addRow([
      'TOTAL',
      'TỔNG CỘNG TOÀN HỆ THỐNG',
      sumOrders,
      sumCompleted,
      sumItems,
      sumGross,
      sumDiscount,
      sumVat,
      sumShip,
      sumSc,
      sumNet,
      sumCollected,
      sumRefund,
      sumNetCollected,
      totalAov,
      sumUnreconciled,
    ]);

    totalRow.eachCell((cell, colNum) => {
      this.applyCellBorder(cell);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: this.BRAND_PRIMARY } };
      if (colNum >= 3 && colNum <= 15) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      } else if (colNum === 16) {
        cell.alignment = { horizontal: 'center' };
      }
    });

    this.autoFitColumns(wsBranch, 12, 35);

    // =========================================================================
    // SHEET 3: PHƯƠNG THỨC THANH TOÁN
    // =========================================================================
    const wsPayment = workbook.addWorksheet('3. Phương Thức TT');
    wsPayment.views = [{ showGridLines: true }];

    const pHeader = wsPayment.addRow([
      'Phương Thức',
      'Số Giao Dịch',
      'Thực Thu (Collected)',
      'Hoàn Trả (Refunded)',
      'Thực Thu Ròng (Net)',
      'Tỷ Trọng (%)',
    ]);
    this.styleHeaderRow(pHeader, this.BRAND_PRIMARY);

    data.paymentBreakdown.forEach((p, idx) => {
      const row = wsPayment.addRow([
        p.paymentMethod,
        p.orderCount,
        p.collectedAmount,
        p.refundedAmount,
        p.netCollectedAmount,
        `${p.sharePercent}%`,
      ]);
      const isZebra = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        this.applyCellBorder(cell);
        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        }
        if (colNum >= 2 && colNum <= 5) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        } else if (colNum === 6) {
          cell.alignment = { horizontal: 'center' };
          cell.font = { bold: true };
        }
      });
    });

    this.autoFitColumns(wsPayment, 15, 30);

    // =========================================================================
    // SHEET 4: PHÂN RÃ THUẾ VAT (0%, 5%, 8%, 10%)
    // =========================================================================
    const wsVat = workbook.addWorksheet('4. Phân Rã VAT');
    wsVat.views = [{ showGridLines: true }];

    const vHeader = wsVat.addRow([
      'Thuế Suất (%)',
      'Chế Độ Thuế',
      'Số Lượng Món',
      'Doanh Thu Tính Thuế',
      'Tiền Thuế VAT',
      'Tổng Tiền Có Thuế',
    ]);
    this.styleHeaderRow(vHeader, this.BRAND_HEADER_BG);

    data.vatBreakdown.forEach((v, idx) => {
      const row = wsVat.addRow([
        `${v.rate}%`,
        v.vatPriceMode === 'VAT_INCLUDED' ? 'Giá đã gồm VAT' : 'Giá chưa gồm VAT',
        v.itemCount,
        v.taxableAmount,
        v.vatAmount,
        v.totalAmountWithTax,
      ]);
      const isZebra = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        this.applyCellBorder(cell);
        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        }
        if (colNum >= 3 && colNum <= 6) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        } else {
          cell.alignment = { horizontal: 'center' };
        }
      });
    });

    this.autoFitColumns(wsVat, 18, 30);

    // =========================================================================
    // SHEET 5: KHUYẾN MÃI & CHIẾT KHẤU
    // =========================================================================
    const wsDiscount = workbook.addWorksheet('5. Khuyến Mãi & Chiết Khấu');
    wsDiscount.views = [{ showGridLines: true }];

    const dHeader = wsDiscount.addRow(['Loại Khuyến Mại / Chiết Khấu', 'Giá Trị Giảm', 'Đơn Vị']);
    this.styleHeaderRow(dHeader, this.BRAND_PRIMARY);

    const disc = data.discountBreakdown;
    const discRows = [
      ['Giảm giá Flash Sale sản phẩm', disc.flashSaleDiscount, '₫'],
      ['Giảm giá trực tiếp trên món ăn', disc.itemDirectDiscount, '₫'],
      ['Voucher giảm giá cấp đơn hàng', disc.orderVoucherDiscount, '₫'],
      ['Voucher / Miễn phí vận chuyển', disc.shippingDiscount, '₫'],
      ['Điểm thưởng Loyalty quy đổi', disc.pointsDiscount, '₫'],
      ['TỔNG KHUYẾN MÃI TOÀN HỆ THỐNG', disc.totalDiscount, '₫'],
    ];

    discRows.forEach((r, idx) => {
      const row = wsDiscount.addRow(r);
      const isLast = idx === discRows.length - 1;
      row.eachCell((cell, colNum) => {
        this.applyCellBorder(cell);
        if (isLast) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
          cell.font = { bold: true, color: { argb: this.BRAND_PRIMARY } };
        }
        if (colNum === 2) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        }
      });
    });

    this.autoFitColumns(wsDiscount, 20, 40);

    // =========================================================================
    // SHEET 6: DOANH THU THEO NGÀY (DAILY TREND)
    // =========================================================================
    const wsDaily = workbook.addWorksheet('6. Xu Hướng Ngày');
    wsDaily.views = [{ showGridLines: true }];

    const dayHeader = wsDaily.addRow([
      'Ngày',
      'Số Đơn',
      'Đơn Thành Công',
      'Gross Sales',
      'Net Sales',
      'VAT',
      'Thực Thu',
      'Hoàn Tiền',
      'Thực Thu Ròng',
    ]);
    this.styleHeaderRow(dayHeader, this.BRAND_HEADER_BG);

    data.dailyTrend.forEach((d, idx) => {
      const row = wsDaily.addRow([
        d.dateStr,
        d.orderCount,
        d.completedOrderCount,
        d.grossSales,
        d.netSales,
        d.vatAmount,
        d.collectedRevenue,
        d.refundedAmount,
        d.netCollected,
      ]);
      const isZebra = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        this.applyCellBorder(cell);
        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        }
        if (colNum === 1) cell.alignment = { horizontal: 'center' };
        if (colNum >= 2 && colNum <= 3) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        }
        if (colNum >= 4) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        }
      });
    });

    this.autoFitColumns(wsDaily, 15, 30);

    // =========================================================================
    // SHEET 7: CHI TIẾT TỪNG GIAO DỊCH ĐỐI SOÁT (22 CỘT MINH BẠCH)
    // =========================================================================
    const wsOrders = workbook.addWorksheet('7. Chi Tiết Giao Dịch');
    wsOrders.views = [{ showGridLines: true }];

    const oHeader = wsOrders.addRow([
      'Mã Đơn',
      'Ngày Giờ',
      'Chi Nhánh',
      'Khách Hàng',
      'Số Điện Thoại',
      'Nguồn Đơn',
      'Loại Đơn',
      'Tiền Hàng (Subtotal)',
      'Topping',
      'Giảm Món',
      'Giảm Voucher',
      'Điểm Đổi',
      'Phụ Thu',
      'VAT',
      'Phí Ship Khách Trả',
      'Tổng Đơn (Total)',
      'Thực Thu',
      'Hoàn Trả',
      'Thực Thu Ròng',
      'Phương Thức TT',
      'Trạng Thái TT',
      'Trạng Thái Đơn',
      'Đối Soát',
    ]);
    this.styleHeaderRow(oHeader, this.BRAND_PRIMARY);

    data.orders.forEach((o, idx) => {
      const row = wsOrders.addRow([
        o.orderCode,
        o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : '',
        o.branchName,
        o.customerName,
        o.customerPhone,
        o.orderSource,
        o.orderType,
        o.grossItemAmount,
        o.optionAmount,
        o.directItemDiscount,
        o.orderVoucherDiscount,
        o.pointsDiscount,
        o.serviceChargeTotal,
        o.vatTotalAmount,
        o.shippingFeeCustomerPaid,
        o.orderTotalAmount,
        o.collectedRevenue,
        o.refundedAmount,
        o.netCollected,
        o.paymentMethod,
        o.paymentStatus,
        o.orderStatus,
        o.reconciliation.isReconciled ? 'KHỚP' : 'LỆCH ĐỐI SOÁT',
      ]);

      const isZebra = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        this.applyCellBorder(cell);
        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        }
        if (colNum >= 8 && colNum <= 19) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        }
        if (colNum === 23) {
          cell.alignment = { horizontal: 'center' };
          if (!o.reconciliation.isReconciled) {
            cell.font = { bold: true, color: { argb: this.BRAND_SECONDARY } };
          }
        }
      });
    });

    this.autoFitColumns(wsOrders, 12, 35);

    // =========================================================================
    // SHEET 8: DANH SÁCH BẤT THƯỜNG ĐỐI SOÁT (RECONCILIATION AUDIT ALERTS)
    // =========================================================================
    const wsAlerts = workbook.addWorksheet('8. Cảnh Báo Đối Soát');
    wsAlerts.views = [{ showGridLines: true }];

    const aHeader = wsAlerts.addRow([
      'Mã Đơn',
      'Chi Nhánh',
      'Tổng Tiền Thực Tế',
      'Tổng Tiền Tính Lại',
      'Số Tiền Lệch',
      'Chi Tiết Nguyên Nhân Sai Lệch',
    ]);
    this.styleHeaderRow(aHeader, '991B1B'); // Dark Red

    const unreconciledOrders = data.orders.filter((o) => !o.reconciliation.isReconciled);
    if (unreconciledOrders.length === 0) {
      const okRow = wsAlerts.addRow([
        '100% HỢP LỆ',
        'Tất cả chi nhánh',
        0,
        0,
        0,
        'Tuyệt vời! Không phát hiện bất kỳ sai lệch nào. Tất cả giao dịch đều thỏa mãn 4 Invariants toán học.',
      ]);
      okRow.getCell(6).font = { bold: true, color: { argb: '16A34A' } };
    } else {
      unreconciledOrders.forEach((o) => {
        const row = wsAlerts.addRow([
          o.orderCode,
          o.branchName,
          o.orderTotalAmount,
          o.reconciliation.expectedTotalAmount,
          o.reconciliation.discrepancyTotal,
          o.reconciliation.notes.join(' | '),
        ]);
        row.eachCell((cell, colNum) => {
          this.applyCellBorder(cell);
          if (colNum >= 3 && colNum <= 5) {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right' };
          }
          if (colNum === 5) {
            cell.font = { bold: true, color: { argb: this.BRAND_SECONDARY } };
          }
        });
      });
    }

    this.autoFitColumns(wsAlerts, 15, 60);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
