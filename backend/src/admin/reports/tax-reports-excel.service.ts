import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  CalculatedOrderTax,
  TaxKPIsSummary,
  TaxRateBreakdownItem,
  TaxBranchSummaryItem,
  TaxCategorySummaryItem,
  TaxProductSummaryItem,
  TaxDailyTrendItem,
} from './tax-report-calculation.service';

@Injectable()
export class TaxReportsExcelService {
  private readonly logger = new Logger(TaxReportsExcelService.name);

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
   * Tạo Workbook Excel 9 Sheets chuẩn Báo Cáo Thuế / VAT Doanh Nghiệp
   */
  async generateTaxExcelWorkbook(data: {
    kpis: TaxKPIsSummary;
    rates: TaxRateBreakdownItem[];
    branches: TaxBranchSummaryItem[];
    categories: TaxCategorySummaryItem[];
    products: TaxProductSummaryItem[];
    trends: TaxDailyTrendItem[];
    orders: CalculatedOrderTax[];
    filter?: any;
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ Thống Nhà Hàng Cao Cấp AVORA';
    workbook.lastModifiedBy = 'AVORA Tax & VAT Reporting Engine';
    workbook.created = new Date();

    const { kpis, rates, branches, categories, products, trends, orders } = data;

    // =========================================================================
    // SHEET 1: VAT Summary (Tổng quan thuế)
    // =========================================================================
    const wsSummary = workbook.addWorksheet('1. VAT Summary', {
      views: [{ showGridLines: true }],
    });

    wsSummary.mergeCells('A1:G1');
    const titleCell1 = wsSummary.getCell('A1');
    titleCell1.value = 'BÁO CÁO THUẾ GIÁ TRỊ GIA TĂNG (VAT) - HỆ THỐNG AVORA';
    titleCell1.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell1.alignment = { vertical: 'middle', horizontal: 'center' };
    wsSummary.getRow(1).height = 36;

    wsSummary.mergeCells('A2:G2');
    const subtitleCell1 = wsSummary.getCell('A2');
    subtitleCell1.value = `CHỈ TÍNH CÁC ĐƠN HÀNG ĐÃ HOÀN THÀNH (COMPLETED ONLY) | Ngày xuất: ${new Date().toLocaleString('vi-VN')}`;
    subtitleCell1.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '475569' } };
    subtitleCell1.alignment = { vertical: 'middle', horizontal: 'center' };
    wsSummary.getRow(2).height = 20;

    wsSummary.addRow([]);

    const summaryHeader = wsSummary.addRow([
      'Chỉ số Thuế / Doanh thu',
      'Giá trị ghi nhận (VND)',
      'Đơn vị tính',
      'Ghi chú nghiệp vụ',
    ]);
    this.styleHeaderRow(summaryHeader, this.BRAND_HEADER_BG);

    const kpiRows = [
      ['Tổng số đơn hàng hoàn thành (Completed Orders)', kpis.completedOrders, 'Đơn hàng', 'Chỉ tính trạng thái COMPLETED'],
      ['Tổng số dòng món ăn bán ra (Completed Order Items)', kpis.completedOrderItems, 'Món', 'Dòng món trong các đơn hoàn thành'],
      ['Tổng khách hàng phát sinh đơn', kpis.distinctCustomers, 'Khách hàng', 'Khách hàng phân biệt theo số điện thoại'],
      ['Tổng doanh số gộp (Gross Sales)', kpis.grossSales, 'VND', 'Bao gồm tiền món và phí dịch vụ'],
      ['Doanh thu chịu thuế (Taxable Revenue)', kpis.taxableRevenue, 'VND', 'Căn cứ tính thuế sau khi trừ chiết khấu'],
      ['Doanh thu không chịu thuế (0% / Miễn thuế)', kpis.nonTaxableRevenue, 'VND', 'Mặt hàng áp thuế suất 0%'],
      ['Doanh thu áp dụng giá đã gồm thuế (VAT Included)', kpis.vatIncludedRevenue, 'VND', 'Doanh thu niêm yết giá gồm VAT'],
      ['Doanh thu áp dụng giá chưa gồm thuế (VAT Excluded)', kpis.vatExcludedRevenue, 'VND', 'Doanh thu cộng thêm VAT'],
      ['Tổng thuế VAT phát sinh (Total VAT)', kpis.totalVat, 'VND', 'Tổng thuế bán hàng tại thời điểm hoàn thành'],
      ['Thuế VAT đã hoàn lại (Refunded VAT)', kpis.vatRefunded, 'VND', 'Thuế được giảm trừ khi khách hoàn tiền'],
      ['Thuế VAT thực nộp (Net VAT)', kpis.netVat, 'VND', 'Net VAT = Total VAT - Refunded VAT'],
      ['Thuế VAT bình quân / Đơn hoàn thành', kpis.averageVatPerCompletedOrder, 'VND/Đơn', 'Total VAT / Completed Orders'],
      ['Tiền thuế VAT mức 0%', kpis.vat0Amount, 'VND', 'Thuế VAT mức 0%'],
      ['Tiền thuế VAT mức 5%', kpis.vat5Amount, 'VND', 'Thuế VAT mức 5%'],
      ['Tiền thuế VAT mức 8%', kpis.vat8Amount, 'VND', 'Thuế VAT ưu đãi 8% theo nghị định'],
      ['Tiền thuế VAT mức 10%', kpis.vat10Amount, 'VND', 'Thuế VAT chuẩn 10%'],
      ['Tiền thuế VAT mức khác', kpis.vatOtherAmount, 'VND', 'Các mức thuế đặc thù khác'],
      ['Đơn hàng có nhiều mức thuế hỗn hợp', kpis.ordersWithMixedVatRates, 'Đơn', 'Đơn chứa các món có thuế suất khác nhau'],
      ['Bản ghi dùng timestamp fallback (Legacy)', kpis.legacyVatRecordsCount, 'Đơn', 'Dữ liệu cũ chưa có deliveredAt, dùng updatedAt'],
      ['Số đơn phát hiện sai lệch đối soát (Errors)', kpis.reconciliationErrorsCount, 'Đơn', 'Được gắn cờ VAT_RECONCILIATION_ERROR'],
      ['Số đơn cảnh báo thanh toán (Warnings)', kpis.paymentWarningCount, 'Đơn', 'Hoàn thành nhưng paymentStatus chưa hoàn tất'],
    ];

    kpiRows.forEach((row, idx) => {
      const r = wsSummary.addRow(row);
      r.height = 22;
      r.getCell(1).font = { name: 'Segoe UI', size: 10, bold: idx === 8 || idx === 10 };
      r.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: idx === 10 ? this.BRAND_PRIMARY : '000000' } };
      r.getCell(2).numFmt = typeof row[1] === 'number' ? '#,##0' : '@';
      r.getCell(2).alignment = { horizontal: 'right' };
      r.eachCell((cell) => this.applyCellBorder(cell));
      if (idx % 2 === 1) {
        r.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsSummary);

    // =========================================================================
    // SHEET 2: VAT Rates (Theo mức thuế 0%, 5%, 8%, 10%)
    // =========================================================================
    const wsRates = workbook.addWorksheet('2. VAT Rates', { views: [{ showGridLines: true }] });

    wsRates.mergeCells('A1:I1');
    const titleCell2 = wsRates.getCell('A1');
    titleCell2.value = 'BẢNG PHÂN BỔ THUẾ THEO TỪNG MỨC THUẾ SUẤT';
    titleCell2.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell2.alignment = { vertical: 'middle', horizontal: 'center' };
    wsRates.getRow(1).height = 32;

    const rateHeader = wsRates.addRow([
      'Mức thuế suất',
      'Số đơn hoàn thành',
      'Số lượng món bán',
      'Doanh thu tính thuế (VND)',
      'Thuế VAT phát sinh (VND)',
      'Tổng tiền sau thuế (VND)',
      'Thuế VAT hoàn trả (VND)',
      'Thuế VAT thực thu (Net VAT)',
      'Thuế suất thực tế (%)',
    ]);
    this.styleHeaderRow(rateHeader, this.BRAND_PRIMARY);

    rates.forEach((r, idx) => {
      const row = wsRates.addRow([
        r.rateLabel,
        r.completedOrdersCount,
        r.quantitySold,
        r.taxableAmount,
        r.taxAmount,
        r.grossAmount,
        r.refundedTaxAmount,
        r.netTaxAmount,
        `${r.effectiveTaxRatePercent}%`,
      ]);
      row.height = 22;
      row.getCell(2).numFmt = '#,##0';
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '#,##0 ₫';
      row.getCell(5).numFmt = '#,##0 ₫';
      row.getCell(6).numFmt = '#,##0 ₫';
      row.getCell(7).numFmt = '#,##0 ₫';
      row.getCell(8).numFmt = '#,##0 ₫';
      row.eachCell((cell) => this.applyCellBorder(cell));
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsRates);

    // =========================================================================
    // SHEET 3: Branch VAT (Theo Chi nhánh)
    // =========================================================================
    const wsBranches = workbook.addWorksheet('3. Branch VAT', { views: [{ showGridLines: true }] });

    wsBranches.mergeCells('A1:L1');
    const titleCell3 = wsBranches.getCell('A1');
    titleCell3.value = 'BÁO CÁO THUẾ VAT CHI TIẾT THEO TỪNG CHI NHÁNH';
    titleCell3.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell3.alignment = { vertical: 'middle', horizontal: 'center' };
    wsBranches.getRow(1).height = 32;

    const branchHeader = wsBranches.addRow([
      'Mã CN',
      'Tên Chi Nhánh',
      'Đơn Hoàn Thành',
      'Số Món Bán',
      'Doanh Thu Tính Thuế',
      'VAT 0%',
      'VAT 5%',
      'VAT 8%',
      'VAT 10%',
      'Tổng Thuế VAT',
      'Hoàn Thuế',
      'Thuế VAT Ròng (Net VAT)',
    ]);
    this.styleHeaderRow(branchHeader, this.BRAND_PRIMARY);

    branches.forEach((b, idx) => {
      const row = wsBranches.addRow([
        b.branchCode || b.branchId.substring(0, 6),
        b.branchName,
        b.completedOrders,
        b.itemsSold,
        b.taxableAmount,
        b.vat0Amount,
        b.vat5Amount,
        b.vat8Amount,
        b.vat10Amount,
        b.totalVat,
        b.refundedVat,
        b.netVat,
      ]);
      row.height = 22;
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '#,##0';
      for (let c = 5; c <= 12; c++) {
        row.getCell(c).numFmt = '#,##0 ₫';
      }
      row.eachCell((cell) => this.applyCellBorder(cell));
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsBranches);

    // =========================================================================
    // SHEET 4: Category VAT (Theo Danh mục món ăn)
    // =========================================================================
    const wsCategories = workbook.addWorksheet('4. Category VAT', { views: [{ showGridLines: true }] });

    wsCategories.mergeCells('A1:I1');
    const titleCell4 = wsCategories.getCell('A1');
    titleCell4.value = 'BÁO CÁO THUẾ VAT THEO DANH MỤC MÓN ĂN';
    titleCell4.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell4.alignment = { vertical: 'middle', horizontal: 'center' };
    wsCategories.getRow(1).height = 32;

    const catHeader = wsCategories.addRow([
      'Mã Danh Mục',
      'Tên Danh Mục',
      'Đơn Hoàn Thành',
      'Số Lượng Món',
      'Doanh Thu Bán',
      'Doanh Thu Tính Thuế',
      'Thuế VAT Phát Sinh',
      'Hoàn Thuế VAT',
      'Tỷ Trọng Đóng Góp (%)',
    ]);
    this.styleHeaderRow(catHeader, this.BRAND_PRIMARY);

    categories.forEach((c, idx) => {
      const row = wsCategories.addRow([
        c.categoryId.substring(0, 8),
        c.categoryName,
        c.completedOrdersCount,
        c.quantitySold,
        c.grossRevenue,
        c.taxableAmount,
        c.vatAmount,
        c.refundedVatAmount,
        `${c.contributionPercent}%`,
      ]);
      row.height = 22;
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '#,##0';
      row.getCell(5).numFmt = '#,##0 ₫';
      row.getCell(6).numFmt = '#,##0 ₫';
      row.getCell(7).numFmt = '#,##0 ₫';
      row.getCell(8).numFmt = '#,##0 ₫';
      row.eachCell((cell) => this.applyCellBorder(cell));
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsCategories);

    // =========================================================================
    // SHEET 5: Product VAT (Theo Từng sản phẩm món ăn)
    // =========================================================================
    const wsProducts = workbook.addWorksheet('5. Product VAT', { views: [{ showGridLines: true }] });

    wsProducts.mergeCells('A1:L1');
    const titleCell5 = wsProducts.getCell('A1');
    titleCell5.value = 'BÁO CÁO THUẾ VAT CHI TIẾT THEO TỪNG SẢN PHẨM / MÓN ĂN';
    titleCell5.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell5.alignment = { vertical: 'middle', horizontal: 'center' };
    wsProducts.getRow(1).height = 32;

    const prodHeader = wsProducts.addRow([
      'Mã Món',
      'Tên Món Ăn',
      'Danh Mục',
      'Số Đơn Hoàn Thành',
      'Số Lượng Bán',
      'Đơn Giá Gốc',
      'Đơn Giá Bán Bình Quân',
      'Tổng Giảm Giá',
      'Thuế Suất (%)',
      'Doanh Thu Tính Thuế',
      'Thuế VAT Phát Sinh',
      'Thuế VAT Ròng',
    ]);
    this.styleHeaderRow(prodHeader, this.BRAND_PRIMARY);

    products.forEach((p, idx) => {
      const row = wsProducts.addRow([
        p.itemCode || p.productId.substring(0, 8),
        p.productName,
        p.categoryName,
        p.completedOrdersCount,
        p.quantitySold,
        p.originalPrice,
        p.averageSalePrice,
        p.totalDiscount,
        `${p.taxPercentage}%`,
        p.taxableAmount,
        p.vatAmount,
        p.netVatAmount,
      ]);
      row.height = 22;
      row.getCell(4).numFmt = '#,##0';
      row.getCell(5).numFmt = '#,##0';
      row.getCell(6).numFmt = '#,##0 ₫';
      row.getCell(7).numFmt = '#,##0 ₫';
      row.getCell(8).numFmt = '#,##0 ₫';
      row.getCell(10).numFmt = '#,##0 ₫';
      row.getCell(11).numFmt = '#,##0 ₫';
      row.getCell(12).numFmt = '#,##0 ₫';
      row.eachCell((cell) => this.applyCellBorder(cell));
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsProducts);

    // =========================================================================
    // SHEET 6: Transaction Detail (Chi tiết từng dòng giao dịch món)
    // =========================================================================
    const wsTx = workbook.addWorksheet('6. Transaction Detail', { views: [{ showGridLines: true }] });

    wsTx.mergeCells('A1:R1');
    const titleCell6 = wsTx.getCell('A1');
    titleCell6.value = 'BẢNG ĐỐI SOÁT CHI TIẾT TỪNG DÒNG MÓN ĂN TRONG ĐƠN HOÀN THÀNH';
    titleCell6.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell6.alignment = { vertical: 'middle', horizontal: 'center' };
    wsTx.getRow(1).height = 32;

    const txHeader = wsTx.addRow([
      'Mã Đơn Hàng',
      'Thời Điểm Hoàn Thành',
      'Chi Nhánh',
      'Khách Hàng',
      'Mã Món',
      'Tên Món Ăn',
      'Danh Mục',
      'Số Lượng',
      'Đơn Giá Bán',
      'Tiền Topping (Option)',
      'Giảm Giá Món',
      'Phân Bổ Voucher',
      'Chế Độ Thuế',
      'Thuế Suất (%)',
      'Doanh Thu Tính Thuế',
      'Tiền Thuế VAT',
      'PT Thanh Toán',
      'Trạng Thái Đơn',
    ]);
    this.styleHeaderRow(txHeader, this.BRAND_PRIMARY);

    orders.forEach((ord) => {
      ord.items.forEach((it, idx) => {
        const row = wsTx.addRow([
          ord.orderCode,
          ord.completionTimestamp.toLocaleString('vi-VN'),
          ord.branchName,
          ord.customerName,
          it.productCode || it.productId.substring(0, 6),
          it.productName,
          it.categoryName,
          it.quantity,
          it.unitPriceAtSale,
          it.totalOptionAmount,
          it.totalDirectDiscount,
          it.allocatedOrderDiscount,
          it.vatPriceMode,
          `${it.taxPercentage}%`,
          it.taxableAmount,
          it.taxAmount,
          ord.paymentMethod,
          ord.orderStatus,
        ]);
        row.height = 20;
        row.getCell(8).numFmt = '#,##0';
        row.getCell(9).numFmt = '#,##0 ₫';
        row.getCell(10).numFmt = '#,##0 ₫';
        row.getCell(11).numFmt = '#,##0 ₫';
        row.getCell(12).numFmt = '#,##0 ₫';
        row.getCell(15).numFmt = '#,##0 ₫';
        row.getCell(16).numFmt = '#,##0 ₫';
        row.eachCell((cell) => this.applyCellBorder(cell));
      });
    });

    this.autoFitColumns(wsTx);

    // =========================================================================
    // SHEET 7: Refund VAT (Chi tiết các khoản hoàn tiền / hoàn thuế)
    // =========================================================================
    const wsRefund = workbook.addWorksheet('7. Refund VAT', { views: [{ showGridLines: true }] });

    wsRefund.mergeCells('A1:H1');
    const titleCell7 = wsRefund.getCell('A1');
    titleCell7.value = 'BÁO CÁO CÁC KHOẢN HOÀN TIỀN VÀ GIẢM TRỪ THUẾ VAT';
    titleCell7.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell7.alignment = { vertical: 'middle', horizontal: 'center' };
    wsRefund.getRow(1).height = 32;

    const refundHeader = wsRefund.addRow([
      'Mã Đơn Hàng',
      'Thời Điểm Hoàn Thành',
      'Chi Nhánh',
      'Tổng Tiền Đơn Gốc',
      'Thuế VAT Gốc',
      'Số Tiền Hoàn Khách',
      'Thuế VAT Được Hoàn',
      'Thuế VAT Còn Lại (Net VAT)',
    ]);
    this.styleHeaderRow(refundHeader, this.BRAND_PRIMARY);

    const refundedOrders = orders.filter((o) => o.refundedAmountTotal > 0);
    refundedOrders.forEach((ord, idx) => {
      const row = wsRefund.addRow([
        ord.orderCode,
        ord.completionTimestamp.toLocaleString('vi-VN'),
        ord.branchName,
        ord.orderTotalAmount,
        ord.vatTotalAmount,
        ord.refundedAmountTotal,
        ord.refundedTaxTotal,
        ord.netVatTotal,
      ]);
      row.height = 22;
      for (let c = 4; c <= 8; c++) {
        row.getCell(c).numFmt = '#,##0 ₫';
      }
      row.eachCell((cell) => this.applyCellBorder(cell));
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsRefund);

    // =========================================================================
    // SHEET 8: Reconciliation Errors (Các trường hợp sai lệch đối soát)
    // =========================================================================
    const wsErrors = workbook.addWorksheet('8. Reconciliation Errors', { views: [{ showGridLines: true }] });

    wsErrors.mergeCells('A1:H1');
    const titleCell8 = wsErrors.getCell('A1');
    titleCell8.value = 'DANH SÁCH CÁC TRƯỜNG HỢP PHÁT HIỆN SAI LỆCH ĐỐI SOÁT THUẾ';
    titleCell8.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_DANGER } };
    titleCell8.alignment = { vertical: 'middle', horizontal: 'center' };
    wsErrors.getRow(1).height = 32;

    const errHeader = wsErrors.addRow([
      'Mã Đơn Hàng',
      'Thời Điểm Hoàn Thành',
      'Chi Nhánh',
      'Mã Lỗi Đối Soát',
      'Cảnh Báo Thanh Toán',
      'Lệch Tiền Tổng (₫)',
      'Lệch Tiền Thuế (₫)',
      'Chi Tiết Nguyên Nhân / Ghi Chú',
    ]);
    this.styleHeaderRow(errHeader, this.BRAND_DANGER);

    const issueOrders = orders.filter((o) => !o.reconciliation.isReconciled || o.reconciliation.hasWarning);
    issueOrders.forEach((ord, idx) => {
      const row = wsErrors.addRow([
        ord.orderCode,
        ord.completionTimestamp.toLocaleString('vi-VN'),
        ord.branchName,
        ord.reconciliation.errorCode,
        ord.reconciliation.warningCode || 'NONE',
        ord.reconciliation.discrepancyTotal,
        ord.reconciliation.discrepancyTax,
        ord.reconciliation.notes.join('; '),
      ]);
      row.height = 22;
      row.getCell(6).numFmt = '#,##0 ₫';
      row.getCell(7).numFmt = '#,##0 ₫';
      row.eachCell((cell) => this.applyCellBorder(cell));
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsErrors);

    // =========================================================================
    // SHEET 9: Legacy Records (Các đơn hàng sử dụng mốc thời gian / fallback)
    // =========================================================================
    const wsLegacy = workbook.addWorksheet('9. Legacy Records', { views: [{ showGridLines: true }] });

    wsLegacy.mergeCells('A1:G1');
    const titleCell9 = wsLegacy.getCell('A1');
    titleCell9.value = 'DANH SÁCH CÁC ĐƠN HÀNG SỬ DỤNG MỐC THỜI GIAN FALLBACK (LEGACY)';
    titleCell9.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_WARNING } };
    titleCell9.alignment = { vertical: 'middle', horizontal: 'center' };
    wsLegacy.getRow(1).height = 32;

    const legacyHeader = wsLegacy.addRow([
      'Mã Đơn Hàng',
      'Thời Điểm Hoàn Thành (Fallback)',
      'Chi Nhánh',
      'Khách Hàng',
      'Doanh Số Bán',
      'Tiền Thuế VAT',
      'Ghi Chú Đánh Dấu',
    ]);
    this.styleHeaderRow(legacyHeader, this.BRAND_WARNING);

    const legacyOrders = orders.filter((o) => o.isLegacyTimestampFallback);
    legacyOrders.forEach((ord, idx) => {
      const row = wsLegacy.addRow([
        ord.orderCode,
        ord.completionTimestamp.toLocaleString('vi-VN'),
        ord.branchName,
        ord.customerName,
        ord.orderTotalAmount,
        ord.vatTotalAmount,
        'LEGACY_TIMESTAMP_FALLBACK (Sử dụng updatedAt làm thời điểm hoàn thành do deliveredAt null)',
      ]);
      row.height = 22;
      row.getCell(5).numFmt = '#,##0 ₫';
      row.getCell(6).numFmt = '#,##0 ₫';
      row.eachCell((cell) => this.applyCellBorder(cell));
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
    });

    this.autoFitColumns(wsLegacy);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
