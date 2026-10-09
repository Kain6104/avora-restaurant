import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  CalculatedCustomerKPIs,
  CustomerRFMSegmentItem,
  CustomerCohortRetentionRow,
  CalculatedTopCustomerItem,
  CustomerFrequencyDistributionItem,
} from './customer-report-calculation.service';

@Injectable()
export class CustomerReportsExcelService {
  private readonly logger = new Logger(CustomerReportsExcelService.name);

  private readonly BRAND_PRIMARY = '800020'; // Burgundy
  private readonly BRAND_HEADER_BG = '1E293B'; // Slate 800
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

  async exportCustomerExcel(
    kpis: CalculatedCustomerKPIs,
    segments: CustomerRFMSegmentItem[],
    cohorts: CustomerCohortRetentionRow[],
    topCustomers: CalculatedTopCustomerItem[],
    frequency: CustomerFrequencyDistributionItem[],
    branchName = 'Toàn hệ thống',
    from = '',
    to = '',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Restaurant Enterprise Reporting Engine';
    workbook.created = new Date();

    // ==========================================
    // SHEET 1: TỔNG QUAN KHÁCH HÀNG & TẦN SUẤT
    // ==========================================
    const wsSummary = workbook.addWorksheet('Tổng Quan Khách Hàng');
    wsSummary.views = [{ showGridLines: true }];

    // Title
    wsSummary.mergeCells('A1:J1');
    const titleCell = wsSummary.getCell('A1');
    titleCell.value = 'BÁO CÁO PHÂN TÍCH KHÁCH HÀNG (CHỈ ĐƠN HOÀN THÀNH)';
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
      'Tổng Khách Có Đơn Hoàn Thành',
      'Khách Mới Trong Kỳ (First Order)',
      'Khách Quay Lại (Returning)',
      'Đang Hoạt Động (<60 ngày)',
      'Có Nguy Cơ Rời Bỏ (60-90 ngày)',
      'Đã Rời Bỏ (>90 ngày)',
      'Tổng Đơn Hoàn Thành',
      'Tổng Doanh Thu Net (₫)',
      'Chi Tiêu Trung Bình/Khách (₫)',
      'AOV Trung Bình (₫)',
    ];
    const kpiRow = wsSummary.addRow(kpiHeaders);
    this.styleHeaderRow(kpiRow, this.BRAND_HEADER_BG);

    const kpiValRow = wsSummary.addRow([
      kpis.totalCustomersWithCompletedOrders,
      kpis.newCustomersInPeriod,
      kpis.returningCustomersInPeriod,
      kpis.activeCustomersCount,
      kpis.atRiskCustomersCount,
      kpis.churnedCustomersCount,
      kpis.totalCompletedOrders,
      kpis.totalCustomerNetRevenue,
      kpis.averageCustomerSpend,
      kpis.averageOrderValue,
    ]);
    kpiValRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      if ([8, 9, 10].includes(colNumber)) {
        cell.numFmt = '#,##0 "₫"';
      } else {
        cell.numFmt = '#,##0';
      }
    });
    kpiValRow.height = 24;

    wsSummary.addRow([]);
    wsSummary.addRow(['PHÂN BỔ TẦN SUẤT MUA HÀNG (FREQUENCY DISTRIBUTION)']);
    wsSummary.getCell('A6').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: this.BRAND_PRIMARY } };

    const freqHeaders = ['Nhóm Tần Suất', 'Số Lượng Khách', 'Tỷ Lệ (%)', 'Tổng Doanh Thu (₫)', 'AOV Trung Bình (₫)'];
    const freqHeaderRow = wsSummary.addRow(freqHeaders);
    this.styleHeaderRow(freqHeaderRow, this.BRAND_PRIMARY);

    for (const f of frequency) {
      const row = wsSummary.addRow([
        f.bucket,
        f.customerCount,
        `${f.percentage}%`,
        f.totalRevenue,
        f.aov,
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([4, 5].includes(colNumber)) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNumber === 2) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsSummary);

    // ==========================================
    // SHEET 2: PHÂN KHÚC RFM
    // ==========================================
    const wsSeg = workbook.addWorksheet('Phân Khúc RFM');
    wsSeg.views = [{ showGridLines: true }];

    const segHeaders = [
      'Phân Khúc Khách Hàng',
      'Số Lượng Khách',
      'Tỷ Lệ (%)',
      'Tổng Doanh Thu (₫)',
      'AOV Trung Bình (₫)',
      'Số Ngày Mua Gần Nhất (Recency)',
      'Mô Tả & Hành Động Khuyến Nghị',
    ];
    const segHeaderRow = wsSeg.addRow(segHeaders);
    this.styleHeaderRow(segHeaderRow, this.BRAND_HEADER_BG);

    for (const s of segments) {
      const row = wsSeg.addRow([
        s.segment,
        s.customerCount,
        `${s.percentage}%`,
        s.totalRevenue,
        s.averageAov,
        `${s.averageRecencyDays} ngày`,
        s.description,
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([4, 5].includes(colNumber)) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNumber === 2) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsSeg);

    // ==========================================
    // SHEET 3: MA TRẬN GIỮ CHÂN (COHORT RETENTION)
    // ==========================================
    const wsCohort = workbook.addWorksheet('Ma Trận Giữ Chân (Cohort)');
    wsCohort.views = [{ showGridLines: true }];

    const cohortHeaders = [
      'Tháng Đơn Đầu (Cohort)',
      'Quy Mô Ban Đầu (Khách)',
      'Tháng 0 (M0)',
      'Tháng 1 (M1)',
      'Tháng 2 (M2)',
      'Tháng 3 (M3)',
      'Tháng 4 (M4)',
      'Tháng 5 (M5)',
    ];
    const cohortHeaderRow = wsCohort.addRow(cohortHeaders);
    this.styleHeaderRow(cohortHeaderRow, this.BRAND_PRIMARY);

    for (const c of cohorts) {
      const row = wsCohort.addRow([
        c.cohortMonth,
        c.initialCustomersCount,
        `${c.m0}%`,
        `${c.m1}%`,
        `${c.m2}%`,
        `${c.m3}%`,
        `${c.m4}%`,
        `${c.m5}%`,
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if (colNumber >= 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNumber === 2) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsCohort);

    // ==========================================
    // SHEET 4: TOP KHÁCH HÀNG CHI TIÊU
    // ==========================================
    const wsTop = workbook.addWorksheet('Top Khách Hàng Chi Tiêu');
    wsTop.views = [{ showGridLines: true }];

    const topHeaders = [
      'Họ Và Tên',
      'Số Điện Thoại',
      'Mã Thành Viên',
      'Hạng Thẻ',
      'Phân Khúc Phân Tích',
      'Đơn Hoàn Thành Đầu',
      'Đơn Gần Nhất',
      'Số Đơn Hoàn Thành',
      'Tổng Chi Tiêu Gross (₫)',
      'Chiết Khấu (₫)',
      'Thực Chi Lifetime (₫)',
      'AOV (₫)',
      'Chi Nhánh Ưa Thích',
      'PT Thanh Toán Thường Dùng',
    ];
    const topHeaderRow = wsTop.addRow(topHeaders);
    this.styleHeaderRow(topHeaderRow, this.BRAND_HEADER_BG);

    for (const u of topCustomers) {
      const row = wsTop.addRow([
        u.fullName,
        u.phone || '—',
        u.memberCode || '—',
        u.membershipTier || 'Tiêu chuẩn',
        u.analyticalSegment,
        u.firstCompletedOrderDate ? new Date(u.firstCompletedOrderDate).toLocaleDateString('vi-VN') : '—',
        u.lastCompletedOrderDate ? new Date(u.lastCompletedOrderDate).toLocaleDateString('vi-VN') : '—',
        u.completedOrdersCount,
        u.lifetimeGrossSpend,
        u.lifetimeDiscount,
        u.lifetimeNetSpend,
        u.aov,
        u.preferredBranch || '—',
        u.preferredPaymentMethod || '—',
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([9, 10, 11, 12].includes(colNumber)) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNumber === 8) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsTop);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
