import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  CalculatedOrderItem,
  CategoryReportItem,
  ProductReportKPIs,
  SingleProductDetailReport,
} from './product-report-calculation.service';

@Injectable()
export class ProductReportsExcelService {
  private readonly logger = new Logger(ProductReportsExcelService.name);

  // AVORA Brand Colors
  private readonly BRAND_PRIMARY = '800020'; // Burgundy
  private readonly BRAND_SECONDARY = 'B91C1C'; // Red
  private readonly BRAND_HEADER_BG = '1E293B'; // Slate 800
  private readonly BRAND_ZEBRA = 'F8FAFC'; // Slate 50
  private readonly BRAND_BORDER = 'E2E8F0'; // Slate 200

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
          maxLen = Math.min(len, maxWidth);
        }
      });
      column.width = maxLen;
    });
  }

  /**
   * Xuất toàn bộ báo cáo tổng hợp danh mục + mặt hàng ra file Excel 9 Sheets
   */
  async exportProductReportWorkbook(params: {
    kpis: ProductReportKPIs;
    categories: CategoryReportItem[];
    items: CalculatedOrderItem[];
    filterDescription: Record<string, string>;
  }): Promise<Buffer> {
    const { kpis, categories, items, filterDescription } = params;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Enterprise POS & F&B SaaS';
    workbook.created = new Date();

    // =========================================================================
    // SHEET 1: TỔNG QUAN (KPIS & BỘ LỌC)
    // =========================================================================
    const wsOverview = workbook.addWorksheet('1. Tổng quan', {
      views: [{ showGridLines: true }],
    });

    // Title
    wsOverview.mergeCells('A1:D1');
    const titleCell = wsOverview.getCell('A1');
    titleCell.value = 'HỆ THỐNG AVORA - BÁO CÁO DOANH THU MẶT HÀNG & DANH MỤC';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    wsOverview.getRow(1).height = 32;

    // Filter Info
    wsOverview.addRow(['Ngày xuất file:', new Date().toLocaleString('vi-VN')]);
    Object.entries(filterDescription).forEach(([k, v]) => {
      wsOverview.addRow([k + ':', v]);
    });
    wsOverview.addRow([]);

    // KPI Table Header
    const kpiHeaderRow = wsOverview.addRow(['Mã chỉ số', 'Tên chỉ số KPI', 'Giá trị', 'Đơn vị / Ghi chú']);
    this.styleHeaderRow(kpiHeaderRow, this.BRAND_HEADER_BG);

    const kpiRows: [string, string, number, string][] = [
      ['KPI_01', 'Tổng số lượng mặt hàng đã bán', kpis.totalSoldQuantity, 'Sản phẩm'],
      ['KPI_02', 'Tổng số lượng ròng', kpis.totalNetQuantity, 'Sản phẩm'],
      ['KPI_03', 'Tổng số đơn hàng thành công', kpis.totalOrderCount, 'Đơn hàng'],
      ['KPI_04', 'Số khách hàng phát sinh đơn', kpis.distinctCustomerCount, 'Khách hàng'],
      ['KPI_05', 'Tổng tiền hàng trước giảm giá (Gross)', kpis.grossProductSales, 'VNĐ'],
      ['KPI_06', 'Doanh thu từ tùy chọn món (Option Revenue)', kpis.optionRevenue, 'VNĐ'],
      ['KPI_07', 'Giảm giá trực tiếp trên mặt hàng', kpis.directItemDiscount, 'VNĐ'],
      ['KPI_08', 'Giảm giá cấp đơn hàng phân bổ', kpis.allocatedOrderDiscount, 'VNĐ'],
      ['KPI_09', 'Tổng giảm giá liên quan mặt hàng', kpis.totalProductDiscount, 'VNĐ'],
      ['KPI_10', 'Doanh thu mặt hàng sau giảm', kpis.netProductSalesAfterDiscount, 'VNĐ'],
      ['KPI_11', 'Doanh thu mặt hàng chưa thuế (Before VAT)', kpis.productRevenueBeforeTax, 'VNĐ'],
      ['KPI_12', 'Tổng thuế VAT mặt hàng', kpis.productTaxAmount, 'VNĐ'],
      ['KPI_13', 'Doanh thu mặt hàng có thuế (With VAT)', kpis.productRevenueWithTax, 'VNĐ'],
      ['KPI_14', 'Phí giao hàng gốc của đơn', kpis.orderShippingFeeTotal, 'VNĐ (Order-Level)'],
      ['KPI_15', 'Giảm phí giao hàng của đơn', kpis.orderShippingDiscountTotal, 'VNĐ (Order-Level)'],
      ['KPI_16', 'Phí giao hàng thực thu', kpis.orderNetShippingFeeTotal, 'VNĐ (Order-Level)'],
      ['KPI_17', 'Phụ phí dịch vụ (Service Charge)', kpis.orderServiceChargeTotal, 'VNĐ (Order-Level)'],
      ['KPI_18', 'Thuế VAT của phụ phí dịch vụ', kpis.orderServiceChargeTaxTotal, 'VNĐ (Order-Level)'],
      ['KPI_19', 'Tổng tiền hoàn trả (Payment Refund)', kpis.orderRefundTotal, 'VNĐ (Order-Level)'],
      ['KPI_20', 'DOANH THU RÒNG TOÀN HỆ THỐNG (Net Revenue)', kpis.netRevenueOverall, 'VNĐ'],
    ];

    kpiRows.forEach((r, idx) => {
      const row = wsOverview.addRow(r);
      const isVnd = r[3].includes('VNĐ');
      if (isVnd) {
        row.getCell(3).numFmt = '#,##0 "đ"';
      } else {
        row.getCell(3).numFmt = '#,##0';
      }
      if (idx % 2 === 1) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
      row.height = 22;
    });

    this.autoFitColumns(wsOverview, 15, 50);

    // =========================================================================
    // SHEET 2: DANH MỤC (CATEGORY SUMMARY)
    // =========================================================================
    const wsCategory = workbook.addWorksheet('2. Danh mục', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const catHeaders = [
      'Mã danh mục',
      'Tên danh mục',
      'SL bán',
      '% SL',
      'Tiền trước giảm',
      'Doanh thu Option',
      'Giảm trực tiếp',
      'Giảm order phân bổ',
      'Tổng giảm',
      'Tiền sau giảm',
      'Tiền chưa VAT',
      'Tiền VAT',
      'Tiền có VAT',
      '% Doanh thu',
      'Số đơn liên quan',
      'Phí ship đơn liên quan',
      'Phụ phí đơn liên quan',
    ];
    const catHeaderRow = wsCategory.addRow(catHeaders);
    this.styleHeaderRow(catHeaderRow);

    categories.forEach((cat, idx) => {
      const row = wsCategory.addRow([
        cat.categoryId,
        cat.categoryName,
        cat.soldQuantity,
        cat.quantitySharePercent / 100,
        cat.grossAmount,
        cat.optionRevenue,
        cat.directItemDiscount,
        cat.allocatedOrderDiscount,
        cat.totalDiscount,
        cat.amountAfterDiscount,
        cat.revenueBeforeTax,
        cat.taxAmount,
        cat.revenueWithTax,
        cat.revenueSharePercent / 100,
        cat.orderCount,
        cat.relatedOrderShippingFee,
        cat.relatedOrderServiceCharge,
      ]);

      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '0.0%';
      [5, 6, 7, 8, 9, 10, 11, 12, 16, 17].forEach((colIdx) => {
        row.getCell(colIdx).numFmt = '#,##0 "đ"';
      });
      row.getCell(14).numFmt = '0.0%';
      row.getCell(15).numFmt = '#,##0';

      if (idx % 2 === 1) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
      row.height = 22;
    });

    this.autoFitColumns(wsCategory, 12, 35);

    // =========================================================================
    // SHEET 3: MẶT HÀNG (PRODUCT SUMMARY)
    // =========================================================================
    const wsProduct = workbook.addWorksheet('3. Mặt hàng', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const prodHeaders = [
      'Mã món (Item Code)',
      'Tên món ăn',
      'Danh mục',
      'Đơn vị tính',
      'SL bán',
      '% SL',
      'Giá bán TB',
      'Tiền trước giảm',
      'Doanh thu Option',
      'Giảm trực tiếp',
      'Giảm order phân bổ',
      'Tổng giảm',
      'Tiền sau giảm',
      'Tiền chưa VAT',
      'Tiền VAT',
      'Tiền có VAT',
      '% Doanh thu',
      'Mức thuế VAT',
      'Kiểu VAT',
      'Số đơn hàng',
    ];
    const prodHeaderRow = wsProduct.addRow(prodHeaders);
    this.styleHeaderRow(prodHeaderRow);

    let pIdx = 0;
    categories.forEach((cat) => {
      cat.products.forEach((p) => {
        const row = wsProduct.addRow([
          p.productCode || p.productId.substring(0, 8),
          p.productName,
          p.categoryName,
          p.productUnit,
          p.soldQuantity,
          p.quantitySharePercent / 100,
          p.avgUnitPrice,
          p.grossAmount,
          p.optionRevenue,
          p.directItemDiscount,
          p.allocatedOrderDiscount,
          p.totalDiscount,
          p.amountAfterDiscount,
          p.revenueBeforeTax,
          p.taxAmount,
          p.revenueWithTax,
          p.revenueSharePercent / 100,
          p.vatRateDisplay,
          p.vatModeDisplay,
          p.orderCount,
        ]);

        row.getCell(5).numFmt = '#,##0';
        row.getCell(6).numFmt = '0.0%';
        [7, 8, 9, 10, 11, 12, 13, 14, 15, 16].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = '#,##0 "đ"';
        });
        row.getCell(17).numFmt = '0.0%';
        row.getCell(20).numFmt = '#,##0';

        if (pIdx % 2 === 1) {
          row.eachCell((c) => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
          });
        }
        row.height = 22;
        pIdx++;
      });
    });

    this.autoFitColumns(wsProduct, 12, 40);

    // =========================================================================
    // SHEET 4: CHI TIẾT GIAO DỊCH (ORDERITEM TRANSACTIONS)
    // =========================================================================
    const wsTx = workbook.addWorksheet('4. Chi tiết giao dịch', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const txHeaders = [
      'Thời gian',
      'Mã đơn hàng',
      'Chi nhánh',
      'Kênh bán',
      'Loại đơn',
      'Khách hàng',
      'SĐT',
      'Mã món',
      'Tên món',
      'SL',
      'Giá bán tại thời điểm',
      'Tùy chọn (Options)',
      'Tiền Option',
      'Tiền trước giảm',
      'Giảm trực tiếp',
      'Giảm order phân bổ',
      'Tổng giảm',
      'Sau giảm',
      'Thuế suất %',
      'Kiểu giá VAT',
      'Tiền chưa VAT',
      'Tiền VAT',
      'Tổng có VAT',
      'Flash Sale?',
      'Mã voucher giảm',
      'Phí ship của đơn',
      'Giảm ship của đơn',
      'Ship thực thu đơn',
      'Phụ phí của đơn',
      'PT thanh toán',
      'Trạng thái đơn',
    ];
    const txHeaderRow = wsTx.addRow(txHeaders);
    this.styleHeaderRow(txHeaderRow);

    items.forEach((it, idx) => {
      const row = wsTx.addRow([
        it.createdAt ? it.createdAt.toISOString().replace('T', ' ').substring(0, 19) : '',
        it.orderCode,
        it.branchName,
        it.orderSource,
        it.orderType,
        it.customerName,
        it.customerPhone,
        it.productCode,
        it.productName,
        it.quantity,
        it.priceAtSale,
        it.optionsTextSnapshot || 'Không có',
        it.totalOptionRevenue,
        it.grossLineTotal,
        it.totalDirectDiscount,
        it.allocatedOrderDiscount,
        it.totalDiscount,
        it.netAmountAfterDiscount,
        it.taxPercentage,
        it.isVatInclusive ? 'Giá gồm VAT' : 'Giá chưa VAT',
        it.revenueBeforeTax,
        it.taxAmount,
        it.revenueWithTax,
        it.isFlashSaleItem ? 'CÓ' : 'KHÔNG',
        it.orderVoucherCode || '',
        it.orderShippingFee,
        it.orderShippingDiscount,
        it.orderNetShippingFee,
        it.orderServiceChargeTotal,
        it.paymentMethod,
        it.orderStatus,
      ]);

      row.getCell(10).numFmt = '#,##0';
      [11, 13, 14, 15, 16, 17, 18, 21, 22, 23, 26, 27, 28, 29].forEach((colIdx) => {
        row.getCell(colIdx).numFmt = '#,##0 "đ"';
      });
      row.getCell(19).numFmt = '0"%"';

      if (idx % 2 === 1) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
      row.height = 20;
    });

    this.autoFitColumns(wsTx, 12, 40);

    // =========================================================================
    // SHEET 5: THUẾ VAT (VAT BREAKDOWN)
    // =========================================================================
    const wsVat = workbook.addWorksheet('5. Thuế VAT', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const vatHeaders = ['Thuế suất', 'Kiểu giá', 'Số lượng bán', 'Doanh thu trước VAT', 'Tiền thuế VAT', 'Doanh thu có VAT'];
    const vatHeaderRow = wsVat.addRow(vatHeaders);
    this.styleHeaderRow(vatHeaderRow);

    // Group items by VAT rate and mode
    const vatMap = new Map<string, { rate: number; mode: string; qty: number; net: number; tax: number; gross: number }>();
    items.forEach((it) => {
      const k = `${it.taxPercentage}_${it.vatPriceMode}`;
      if (!vatMap.has(k)) {
        vatMap.set(k, {
          rate: it.taxPercentage,
          mode: it.isVatInclusive ? 'Giá gồm VAT' : 'Giá chưa VAT',
          qty: 0,
          net: 0,
          tax: 0,
          gross: 0,
        });
      }
      const entry = vatMap.get(k)!;
      entry.qty += it.quantity;
      entry.net += it.revenueBeforeTax;
      entry.tax += it.taxAmount;
      entry.gross += it.revenueWithTax;
    });

    Array.from(vatMap.values())
      .sort((a, b) => a.rate - b.rate)
      .forEach((v, idx) => {
        const row = wsVat.addRow([
          `${v.rate}%`,
          v.mode,
          v.qty,
          v.net,
          v.tax,
          v.gross,
        ]);
        row.getCell(3).numFmt = '#,##0';
        [4, 5, 6].forEach((c) => (row.getCell(c).numFmt = '#,##0 "đ"'));
        if (idx % 2 === 1) {
          row.eachCell((c) => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
          });
        }
        row.height = 22;
      });

    this.autoFitColumns(wsVat, 15, 30);

    // =========================================================================
    // SHEET 6: TÙY CHỌN MÓN (OPTIONS BREAKDOWN)
    // =========================================================================
    const wsOpt = workbook.addWorksheet('6. Tùy chọn món', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const optHeaders = ['Mã option', 'Tên tùy chọn', 'Số lần chọn', 'Tổng số lượng', 'Phụ thu TB', 'Doanh thu Option'];
    const optHeaderRow = wsOpt.addRow(optHeaders);
    this.styleHeaderRow(optHeaderRow);

    const optMap = new Map<string, { id: string; name: string; count: number; qty: number; sumAdj: number; rev: number }>();
    items.forEach((it) => {
      it.selectedOptions.forEach((opt) => {
        const k = opt.optionItemId || opt.nameAtSale;
        if (!optMap.has(k)) {
          optMap.set(k, { id: k, name: opt.nameAtSale, count: 0, qty: 0, sumAdj: 0, rev: 0 });
        }
        const e = optMap.get(k)!;
        e.count += 1;
        e.qty += it.quantity;
        e.sumAdj += opt.priceAdjustmentAtSale;
        e.rev += it.quantity * opt.priceAdjustmentAtSale;
      });
    });

    Array.from(optMap.values())
      .sort((a, b) => b.rev - a.rev)
      .forEach((o, idx) => {
        const avg = o.count > 0 ? Math.round(o.sumAdj / o.count) : 0;
        const row = wsOpt.addRow([o.id, o.name, o.count, o.qty, avg, o.rev]);
        row.getCell(3).numFmt = '#,##0';
        row.getCell(4).numFmt = '#,##0';
        row.getCell(5).numFmt = '#,##0 "đ"';
        row.getCell(6).numFmt = '#,##0 "đ"';
        if (idx % 2 === 1) {
          row.eachCell((c) => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
          });
        }
        row.height = 22;
      });

    this.autoFitColumns(wsOpt, 15, 35);

    // =========================================================================
    // SHEET 7: CHI NHÁNH (BRANCH SUMMARY)
    // =========================================================================
    const wsBranch = workbook.addWorksheet('7. Chi nhánh', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const bHeaders = ['Mã chi nhánh', 'Tên chi nhánh', 'SL bán', 'Số đơn hàng', 'Doanh thu mặt hàng', 'Thuế VAT', '% Tỷ trọng'];
    const bHeaderRow = wsBranch.addRow(bHeaders);
    this.styleHeaderRow(bHeaderRow);

    const bMap = new Map<string, { id: string; name: string; qty: number; orderIds: Set<string>; rev: number; tax: number }>();
    items.forEach((it) => {
      const k = it.branchId || 'b_default';
      if (!bMap.has(k)) {
        bMap.set(k, { id: k, name: it.branchName, qty: 0, orderIds: new Set<string>(), rev: 0, tax: 0 });
      }
      const e = bMap.get(k)!;
      e.qty += it.quantity;
      e.orderIds.add(it.orderId);
      e.rev += it.revenueWithTax;
      e.tax += it.taxAmount;
    });

    Array.from(bMap.values())
      .sort((a, b) => b.rev - a.rev)
      .forEach((b, idx) => {
        const share = kpis.productRevenueWithTax > 0 ? (b.rev / kpis.productRevenueWithTax) * 100 : 0;
        const row = wsBranch.addRow([b.id, b.name, b.qty, b.orderIds.size, b.rev, b.tax, share / 100]);
        row.getCell(3).numFmt = '#,##0';
        row.getCell(4).numFmt = '#,##0';
        row.getCell(5).numFmt = '#,##0 "đ"';
        row.getCell(6).numFmt = '#,##0 "đ"';
        row.getCell(7).numFmt = '0.0%';
        if (idx % 2 === 1) {
          row.eachCell((c) => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
          });
        }
        row.height = 22;
      });

    this.autoFitColumns(wsBranch, 15, 35);

    // =========================================================================
    // SHEET 8: KÊNH BÁN & LOẠI ĐƠN (SALES CHANNELS & ORDER TYPES)
    // =========================================================================
    const wsChannel = workbook.addWorksheet('8. Kênh bán & Loại đơn', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const chHeaders = ['Phân loại', 'Giá trị', 'Số lượng bán', 'Số đơn hàng', 'Doanh thu', '% Tỷ trọng'];
    const chHeaderRow = wsChannel.addRow(chHeaders);
    this.styleHeaderRow(chHeaderRow);

    // Group by source
    const srcMap = new Map<string, { name: string; qty: number; orderIds: Set<string>; rev: number }>();
    items.forEach((it) => {
      const k = it.orderSource || 'WEB';
      if (!srcMap.has(k)) srcMap.set(k, { name: k, qty: 0, orderIds: new Set<string>(), rev: 0 });
      const e = srcMap.get(k)!;
      e.qty += it.quantity;
      e.orderIds.add(it.orderId);
      e.rev += it.revenueWithTax;
    });

    Array.from(srcMap.values()).forEach((s) => {
      const share = kpis.productRevenueWithTax > 0 ? (s.rev / kpis.productRevenueWithTax) * 100 : 0;
      const row = wsChannel.addRow(['Kênh bán (Source)', s.name, s.qty, s.orderIds.size, s.rev, share / 100]);
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '#,##0';
      row.getCell(5).numFmt = '#,##0 "đ"';
      row.getCell(6).numFmt = '0.0%';
      row.height = 22;
    });

    wsChannel.addRow([]);

    // Group by type
    const typeMap = new Map<string, { name: string; qty: number; orderIds: Set<string>; rev: number }>();
    items.forEach((it) => {
      const k = it.orderType || 'DELIVERY';
      if (!typeMap.has(k)) typeMap.set(k, { name: k, qty: 0, orderIds: new Set<string>(), rev: 0 });
      const e = typeMap.get(k)!;
      e.qty += it.quantity;
      e.orderIds.add(it.orderId);
      e.rev += it.revenueWithTax;
    });

    Array.from(typeMap.values()).forEach((t) => {
      const share = kpis.productRevenueWithTax > 0 ? (t.rev / kpis.productRevenueWithTax) * 100 : 0;
      const row = wsChannel.addRow(['Loại đơn (Order Type)', t.name, t.qty, t.orderIds.size, t.rev, share / 100]);
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '#,##0';
      row.getCell(5).numFmt = '#,##0 "đ"';
      row.getCell(6).numFmt = '0.0%';
      row.height = 22;
    });

    this.autoFitColumns(wsChannel, 15, 30);

    // =========================================================================
    // SHEET 9: VẬN CHUYỂN & PHỤ PHÍ (SHIPPING & SERVICE CHARGE)
    // =========================================================================
    const wsShip = workbook.addWorksheet('9. Vận chuyển & Phụ phí', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const shipHeaders = [
      'Chỉ số tài chính cấp Đơn hàng (Order-Level)',
      'Tổng số tiền',
      'Đơn vị',
      'Quy tắc đối soát / Ghi chú',
    ];
    const shipHeaderRow = wsShip.addRow(shipHeaders);
    this.styleHeaderRow(shipHeaderRow, this.BRAND_HEADER_BG);

    const shipData = [
      ['Tổng phí giao hàng gốc của đơn', kpis.orderShippingFeeTotal, 'VNĐ', 'Tổng hợp theo DISTINCT Order, không nhân theo món'],
      ['Tổng giảm giá phí giao hàng (Freeship / Voucher)', kpis.orderShippingDiscountTotal, 'VNĐ', 'Giảm trừ phí ship cấp đơn, không làm giảm doanh thu món'],
      ['Tổng phí giao hàng thực thu khách trả', kpis.orderNetShippingFeeTotal, 'VNĐ', 'MAX(0, Phí ship gốc - Giảm ship)'],
      ['Tổng phụ phí dịch vụ (Service Charge)', kpis.orderServiceChargeTotal, 'VNĐ', 'Phụ phí bàn, phòng VIP, lễ tết của toàn đơn'],
      ['Tổng thuế VAT phụ phí dịch vụ', kpis.orderServiceChargeTaxTotal, 'VNĐ', 'Thuế phụ phí chịu thuế'],
      ['Tổng tiền hoàn trả (Payment Refund)', kpis.orderRefundTotal, 'VNĐ', 'Tiền hoàn trả cấp thanh toán'],
    ];

    shipData.forEach((s, idx) => {
      const row = wsShip.addRow(s);
      row.getCell(2).numFmt = '#,##0 "đ"';
      if (idx % 2 === 1) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
      row.height = 24;
    });

    this.autoFitColumns(wsShip, 20, 50);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Xuất chi tiết chuyên sâu 1 mặt hàng ra file Excel
   */
  async exportSingleProductWorkbook(params: {
    detail: SingleProductDetailReport;
    items: CalculatedOrderItem[];
    filterDescription: Record<string, string>;
  }): Promise<Buffer> {
    const { detail, items, filterDescription } = params;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Enterprise POS & F&B SaaS';
    workbook.created = new Date();

    const info = detail.currentProductInfo;

    // Sheet 1: Tổng quan món
    const ws1 = workbook.addWorksheet('Tổng quan mặt hàng');
    ws1.mergeCells('A1:E1');
    const titleCell = ws1.getCell('A1');
    titleCell.value = `BÁO CÁO CHI TIẾT MẶT HÀNG: ${info.name.toUpperCase()} (${info.itemCode || info.id.substring(0, 8)})`;
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    ws1.getRow(1).height = 32;

    ws1.addRow(['Danh mục:', info.category.name]);
    ws1.addRow(['Đơn vị tính:', info.unit]);
    ws1.addRow(['Giá niêm yết hiện tại:', info.currentPrice]);
    ws1.getCell('B4').numFmt = '#,##0 "đ"';
    ws1.addRow(['Thuế VAT hiện tại:', `${info.currentTaxPercentage}%`]);
    ws1.addRow(['Lưu ý tài chính:', 'Số liệu lịch sử bên dưới sử dụng 100% snapshot tại thời điểm bán, không phụ thuộc vào giá/thuế hiện tại.']);
    ws1.addRow([]);

    // KPI row
    const kpiHeader = ws1.addRow(['Chỉ số', 'Giá trị', 'Đơn vị']);
    this.styleHeaderRow(kpiHeader);

    const kpiData = [
      ['Tổng số lượng đã bán', detail.kpis.totalSoldQuantity, 'Phần'],
      ['Số đơn hàng có món', detail.kpis.totalOrderCount, 'Đơn'],
      ['Số khách hàng đã mua', detail.kpis.distinctCustomerCount, 'Khách'],
      ['Giá bán thấp nhất lúc bán', detail.kpis.minSoldPrice, 'VNĐ'],
      ['Giá bán cao nhất lúc bán', detail.kpis.maxSoldPrice, 'VNĐ'],
      ['Giá bán trung bình', detail.kpis.avgUnitPrice, 'VNĐ'],
      ['Tiền hàng trước giảm (Gross)', detail.kpis.grossProductSales, 'VNĐ'],
      ['Doanh thu Option của món', detail.kpis.optionRevenue, 'VNĐ'],
      ['Giảm giá trực tiếp trên món', detail.kpis.directItemDiscount, 'VNĐ'],
      ['Giảm giá voucher phân bổ', detail.kpis.allocatedOrderDiscount, 'VNĐ'],
      ['Tổng giảm giá liên quan món', detail.kpis.totalProductDiscount, 'VNĐ'],
      ['Doanh thu sau giảm', detail.kpis.netProductSalesAfterDiscount, 'VNĐ'],
      ['Doanh thu chưa VAT', detail.kpis.productRevenueBeforeTax, 'VNĐ'],
      ['Tổng tiền VAT', detail.kpis.productTaxAmount, 'VNĐ'],
      ['Doanh thu có VAT', detail.kpis.productRevenueWithTax, 'VNĐ'],
      ['SL bán trong Flash Sale', detail.kpis.flashSaleQuantity, 'Phần'],
      ['Doanh thu Flash Sale', detail.kpis.flashSaleRevenue, 'VNĐ'],
    ];

    kpiData.forEach((r, idx) => {
      const row = ws1.addRow(r);
      if (r[2] === 'VNĐ') {
        row.getCell(2).numFmt = '#,##0 "đ"';
      } else {
        row.getCell(2).numFmt = '#,##0';
      }
      if (idx % 2 === 1) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
      row.height = 22;
    });

    this.autoFitColumns(ws1, 15, 50);

    // Sheet 2: Phân rã giá & VAT
    const ws2 = workbook.addWorksheet('Phân rã Giá & Thuế VAT');
    const pHeader = ws2.addRow(['Giá bán thực tế', 'Giá gốc lúc bán', 'Loại giá', 'SL bán', 'Doanh thu trước giảm', 'Doanh thu có VAT']);
    this.styleHeaderRow(pHeader);

    detail.priceBreakdown.forEach((p) => {
      const row = ws2.addRow([p.price, p.originalPrice, p.type, p.quantity, p.grossRevenue, p.netRevenue]);
      [1, 2, 5, 6].forEach((c) => (row.getCell(c).numFmt = '#,##0 "đ"'));
      row.getCell(4).numFmt = '#,##0';
      row.height = 22;
    });

    ws2.addRow([]);
    const vatHeader = ws2.addRow(['Thuế suất', 'Kiểu giá', 'SL bán', 'Giá trị tính thuế', 'Tiền thuế VAT', 'Tổng có VAT']);
    this.styleHeaderRow(vatHeader);

    detail.vatBreakdown.forEach((v) => {
      const row = ws2.addRow([
        `${v.taxPercentage}%`,
        v.vatPriceMode === 'VAT_INCLUDED' ? 'Giá gồm VAT' : 'Giá chưa VAT',
        v.quantity,
        v.taxableAmount,
        v.taxAmount,
        v.totalAmountWithTax,
      ]);
      row.getCell(3).numFmt = '#,##0';
      [4, 5, 6].forEach((c) => (row.getCell(c).numFmt = '#,##0 "đ"'));
      row.height = 22;
    });

    this.autoFitColumns(ws2, 15, 30);

    // Sheet 3: Tùy chọn món (Options)
    const ws3 = workbook.addWorksheet('Tùy chọn kèm theo');
    const optHeader = ws3.addRow(['Tên tùy chọn', 'Số lần chọn', 'Tổng SL món', 'Phụ thu TB', 'Doanh thu Option', '% Tỷ lệ chọn']);
    this.styleHeaderRow(optHeader);

    detail.optionBreakdown.forEach((opt) => {
      const row = ws3.addRow([
        opt.optionName,
        opt.selectionCount,
        opt.totalQuantity,
        opt.avgPriceAdjustment,
        opt.totalOptionRevenue,
        opt.attachRatePercent / 100,
      ]);
      row.getCell(2).numFmt = '#,##0';
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '#,##0 "đ"';
      row.getCell(5).numFmt = '#,##0 "đ"';
      row.getCell(6).numFmt = '0.0%';
      row.height = 22;
    });

    this.autoFitColumns(ws3, 15, 35);

    // Sheet 4: Lịch sử từng lần bán (OrderItems)
    const ws4 = workbook.addWorksheet('Lịch sử giao dịch');
    const txHeader = ws4.addRow([
      'Thời gian',
      'Mã đơn hàng',
      'Chi nhánh',
      'Kênh bán',
      'Loại đơn',
      'Khách hàng',
      'SL',
      'Giá bán lúc mua',
      'Tùy chọn',
      'Tiền Option',
      'Tiền trước giảm',
      'Giảm trực tiếp',
      'Giảm voucher phân bổ',
      'Sau giảm',
      'VAT %',
      'Tiền VAT',
      'Tổng có VAT',
      'PT thanh toán',
      'Trạng thái đơn',
    ]);
    this.styleHeaderRow(txHeader);

    items.forEach((it, idx) => {
      const row = ws4.addRow([
        it.createdAt ? it.createdAt.toISOString().replace('T', ' ').substring(0, 19) : '',
        it.orderCode,
        it.branchName,
        it.orderSource,
        it.orderType,
        it.customerName,
        it.quantity,
        it.priceAtSale,
        it.optionsTextSnapshot || 'Không',
        it.totalOptionRevenue,
        it.grossLineTotal,
        it.totalDirectDiscount,
        it.allocatedOrderDiscount,
        it.netAmountAfterDiscount,
        it.taxPercentage,
        it.taxAmount,
        it.revenueWithTax,
        it.paymentMethod,
        it.orderStatus,
      ]);

      row.getCell(7).numFmt = '#,##0';
      [8, 10, 11, 12, 13, 14, 16, 17].forEach((c) => (row.getCell(c).numFmt = '#,##0 "đ"'));
      row.getCell(15).numFmt = '0"%"';
      if (idx % 2 === 1) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.BRAND_ZEBRA } };
        });
      }
      row.height = 20;
    });

    this.autoFitColumns(ws4, 12, 40);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
