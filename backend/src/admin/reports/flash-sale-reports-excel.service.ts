import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  CalculatedFlashSaleKPIs,
  CalculatedCampaignPerformanceItem,
  CalculatedFlashSaleProductPerformanceItem,
  FlashSaleStockReconciliationItem,
} from './flash-sale-report-calculation.service';

@Injectable()
export class FlashSaleReportsExcelService {
  private readonly logger = new Logger(FlashSaleReportsExcelService.name);

  // AVORA Brand Styling
  private readonly BRAND_PRIMARY = '800020'; // Burgundy
  private readonly BRAND_HEADER_BG = '1E293B'; // Slate 800
  private readonly BRAND_ZEBRA = 'F8FAFC';
  private readonly BRAND_BORDER = 'CBD5E1';

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

  async exportFlashSaleExcel(
    kpis: CalculatedFlashSaleKPIs,
    campaigns: CalculatedCampaignPerformanceItem[],
    products: CalculatedFlashSaleProductPerformanceItem[],
    reconciliation: FlashSaleStockReconciliationItem[],
    branchName = 'Toàn hệ thống',
    from = '',
    to = '',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Restaurant Enterprise Reporting Engine';
    workbook.created = new Date();

    // ==========================================
    // SHEET 1: TỔNG QUAN & CHIẾN DỊCH
    // ==========================================
    const wsSummary = workbook.addWorksheet('Tổng Quan Chiến Dịch');
    wsSummary.views = [{ showGridLines: true }];

    // Title
    wsSummary.mergeCells('A1:J1');
    const titleCell = wsSummary.getCell('A1');
    titleCell.value = 'BÁO CÁO HIỆU SUẤT FLASH SALE (CHỈ ĐƠN HOÀN THÀNH)';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: this.BRAND_PRIMARY } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsSummary.getRow(1).height = 30;

    wsSummary.mergeCells('A2:J2');
    const subCell = wsSummary.getCell('A2');
    subCell.value = `Chi nhánh: ${branchName} | Thời gian: ${from || 'Toàn thời gian'} đến ${to || 'Hiện tại'} | Ngày xuất: ${new Date().toLocaleString('vi-VN')}`;
    subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: '64748B' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // KPI Cards
    wsSummary.addRow([]);
    const kpiHeaders = [
      'Chiến Dịch Đang Chạy',
      'Đơn Hoàn Thành Flash Sale',
      'Món Flash Sale Đã Bán',
      'Khách Mua Duy Nhất',
      'Doanh Thu Flash Sale (₫)',
      'Giá Trị Gốc (₫)',
      'Chi Phí Giảm Giá (₫)',
      'AOV Flash Sale (₫)',
      'Tỷ Lệ Bán Hết (Sell-through)',
      'Lỗi Đối Soát Tồn',
    ];
    const kpiRow = wsSummary.addRow(kpiHeaders);
    this.styleHeaderRow(kpiRow, this.BRAND_HEADER_BG);

    const kpiValRow = wsSummary.addRow([
      kpis.totalActiveCampaigns,
      kpis.totalCompletedFlashSaleOrders,
      kpis.totalFlashSaleItemsSold,
      kpis.uniqueBuyers,
      kpis.grossFlashSaleRevenue,
      kpis.originalValueTotal,
      kpis.flashSaleDiscountCost,
      kpis.averageFlashSaleOrderValue,
      `${kpis.overallSellThroughRate}%`,
      kpis.reconciliationErrorsCount,
    ]);
    kpiValRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      if ([5, 6, 7, 8].includes(colNumber)) {
        cell.numFmt = '#,##0 "₫"';
      } else if ([1, 2, 3, 4, 10].includes(colNumber)) {
        cell.numFmt = '#,##0';
      }
    });
    kpiValRow.height = 24;

    wsSummary.addRow([]);
    wsSummary.addRow(['DANH SÁCH CHIẾN DỊCH FLASH SALE']);
    wsSummary.getCell('A6').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: this.BRAND_PRIMARY } };

    const campHeaders = [
      'Tên Chiến Dịch',
      'Mã',
      'Trạng Thái',
      'Thời Gian Bắt Đầu',
      'Thời Gian Kết Thúc',
      'Đơn Hoàn Thành',
      'Khách Mua',
      'Số Lượng Bán',
      'Giá Trị Gốc (₫)',
      'Chi Phí Giảm (₫)',
      'Doanh Thu (₫)',
      'Tỷ Lệ Bán Hết (%)',
      'Cảnh Báo Tồn',
    ];
    const campHeaderRow = wsSummary.addRow(campHeaders);
    this.styleHeaderRow(campHeaderRow, this.BRAND_PRIMARY);

    for (const c of campaigns) {
      const row = wsSummary.addRow([
        c.name,
        c.campaignCode,
        c.status,
        c.startTime ? new Date(c.startTime).toLocaleString('vi-VN') : '—',
        c.endTime ? new Date(c.endTime).toLocaleString('vi-VN') : '—',
        c.completedOrdersCount,
        c.uniqueBuyersCount,
        c.itemsSoldCount,
        c.originalValue,
        c.discountCost,
        c.revenue,
        `${c.sellThroughRate}%`,
        c.hasStockError ? 'CÓ LỖI TỒN' : 'Chuẩn',
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([9, 10, 11].includes(colNumber)) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if ([6, 7, 8].includes(colNumber)) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsSummary);

    // ==========================================
    // SHEET 2: HIỆU SUẤT TỪNG SẢN PHẨM
    // ==========================================
    const wsProd = workbook.addWorksheet('Sản Phẩm Flash Sale');
    wsProd.views = [{ showGridLines: true }];

    const prodHeaders = [
      'Tên Sản Phẩm',
      'Danh Mục',
      'Chiến Dịch',
      'Giá Flash Sale (₫)',
      'Giá Gốc (₫)',
      '% Giảm',
      'Tồn Ban Đầu',
      'Đã Bán Hoàn Thành',
      'Tồn Thực Tế Còn Lại',
      'Đơn Hoàn Thành',
      'Khách Mua',
      'Doanh Thu Thu Được (₫)',
      'Chi Phí Giảm Giá (₫)',
      'Tỷ Lệ Bán Hết (%)',
      'Bất Thường Tồn',
    ];
    const prodHeaderRow = wsProd.addRow(prodHeaders);
    this.styleHeaderRow(prodHeaderRow, this.BRAND_HEADER_BG);

    for (const p of products) {
      const row = wsProd.addRow([
        p.productName,
        p.categoryName,
        p.campaignName,
        p.flashPrice,
        p.originalPrice,
        `${p.discountPercent}%`,
        p.initialStock,
        p.soldQuantity,
        p.remainingStock,
        p.completedOrdersCount,
        p.uniqueBuyersCount,
        p.revenue,
        p.discountCost,
        `${p.sellThroughRate}%`,
        p.hasStockAnomaly ? 'BẤT THƯỜNG' : 'Khớp',
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([4, 5, 12, 13].includes(colNumber)) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if ([7, 8, 9, 10, 11].includes(colNumber)) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsProd);

    // ==========================================
    // SHEET 3: ĐỐI SOÁT TỒN KHO & BẤT THƯỜNG
    // ==========================================
    const wsRec = workbook.addWorksheet('Đối Soát Tồn Kho');
    wsRec.views = [{ showGridLines: true }];

    const recHeaders = [
      'Chiến Dịch',
      'Khung Giờ',
      'Sản Phẩm',
      'Giá Flash (₫)',
      'Tồn Ban Đầu',
      'Bộ Đếm Hệ Thống Báo Bán',
      'Đã Bán Thực Tế (Đơn Hoàn Thành)',
      'Tồn Kho Còn Lại',
      'Tồn Kho Dự Kiến (Ban Đầu - Bán)',
      'Chênh Lệch Đối Soát',
      'Bán Vượt Tồn (Oversell)',
      'Tồn Âm (Negative)',
      'Trạng Thái Đối Soát',
    ];
    const recHeaderRow = wsRec.addRow(recHeaders);
    this.styleHeaderRow(recHeaderRow, 'B91C1C');

    for (const r of reconciliation) {
      const row = wsRec.addRow([
        r.campaignName,
        r.slotName,
        r.productName,
        r.flashPrice,
        r.initialStock,
        r.systemSoldCounter,
        r.actualCompletedSoldQuantity,
        r.remainingStock,
        r.calculatedExpectedStock,
        r.discrepancyQuantity,
        r.isOverselling ? 'CÓ (Oversell)' : 'Không',
        r.isNegativeStock ? 'CÓ (Tồn Âm)' : 'Không',
        r.reconciliationStatus,
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if (colNumber === 4) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if ([5, 6, 7, 8, 9, 10].includes(colNumber)) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsRec);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
