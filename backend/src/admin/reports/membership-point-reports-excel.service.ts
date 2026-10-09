import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  CalculatedMembershipKPIs,
  CalculatedTierPerformanceItem,
  CalculatedPointDynamicsItem,
  CalculatedPointLiabilityItem,
  PointLedgerReconciliationItem,
  PointTransactionInput,
} from './membership-point-calculation.service';

@Injectable()
export class MembershipPointReportsExcelService {
  private readonly logger = new Logger(MembershipPointReportsExcelService.name);

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

  async exportMembershipPointExcel(
    kpis: CalculatedMembershipKPIs,
    tiers: CalculatedTierPerformanceItem[],
    dynamics: CalculatedPointDynamicsItem[],
    liabilities: CalculatedPointLiabilityItem[],
    reconciliations: PointLedgerReconciliationItem[],
    transactions: PointTransactionInput[],
    branchName = 'Toàn hệ thống',
    from = '',
    to = '',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Restaurant Enterprise Reporting Engine';
    workbook.created = new Date();

    // ==========================================
    // SHEET 1: TỔNG QUAN HỘI VIÊN & ĐIỂM THƯỞNG
    // ==========================================
    const wsSummary = workbook.addWorksheet('Tổng Quan Hội Viên & Điểm');
    wsSummary.views = [{ showGridLines: true }];

    // Title
    wsSummary.mergeCells('A1:J1');
    const titleCell = wsSummary.getCell('A1');
    titleCell.value = 'BÁO CÁO HỘI VIÊN & ĐIỂM TÍCH LŨY (CHỈ ĐƠN HOÀN THÀNH)';
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
      'Tổng Hội Viên Đăng Ký',
      'Hội Viên Có Đơn Hoàn Thành',
      'Doanh Thu Hội Viên (₫)',
      'AOV Đơn Hội Viên (₫)',
      'AOV Khách Thường (₫)',
      'Tổng Điểm Đã Cấp',
      'Tổng Điểm Đã Tiêu',
      'Điểm Tồn Hiện Tại',
      'Nghĩa Vụ Nợ Điểm Ước Tính (₫)',
      'Lệch Đối Soát Sổ Cái',
    ];
    const kpiRow = wsSummary.addRow(kpiHeaders);
    this.styleHeaderRow(kpiRow, this.BRAND_HEADER_BG);

    const kpiValRow = wsSummary.addRow([
      kpis.totalRegisteredMembers,
      kpis.activeMembersInPeriod,
      kpis.revenueFromMembers,
      kpis.memberAov,
      kpis.nonMemberAov,
      kpis.totalPointsIssued,
      kpis.totalPointsRedeemed,
      kpis.outstandingPointsBalance,
      kpis.estimatedPointLiabilityVnd,
      kpis.reconciliationDiscrepanciesCount,
    ]);
    kpiValRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      if ([3, 4, 5, 9].includes(colNumber)) {
        cell.numFmt = '#,##0 "₫"';
      } else {
        cell.numFmt = '#,##0';
      }
    });
    kpiValRow.height = 24;

    wsSummary.addRow([]);
    wsSummary.addRow(['HIỆU SUẤT THEO HẠNG THẺ HỘI VIÊN']);
    wsSummary.getCell('A6').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: this.BRAND_PRIMARY } };

    const tierHeaders = [
      'Hạng Thẻ',
      'Hạn Mức Chi Tiêu Tối Thiểu (₫)',
      'Hệ Số Nhân Điểm',
      'Chiết Khấu (%)',
      'Tổng Thành Viên',
      'Thành Viên Hoạt Động',
      'Đơn Hoàn Thành',
      'Doanh Thu Thu Được (₫)',
      'AOV (₫)',
      'Điểm Đã Cấp',
      'Điểm Đã Tiêu',
    ];
    const tierHeaderRow = wsSummary.addRow(tierHeaders);
    this.styleHeaderRow(tierHeaderRow, this.BRAND_PRIMARY);

    for (const t of tiers) {
      const row = wsSummary.addRow([
        t.tierName,
        t.minSpending,
        `${t.pointMultiplier}x`,
        `${t.discountPercent}%`,
        t.totalMembersCount,
        t.activeMembersCount,
        t.completedOrdersCount,
        t.revenue,
        t.aov,
        t.pointsEarned,
        t.pointsRedeemed,
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([2, 8, 9].includes(colNumber)) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if ([5, 6, 7, 10, 11].includes(colNumber)) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsSummary);

    // ==========================================
    // SHEET 2: NGHĨA VỤ NỢ ĐIỂM (POINT LIABILITY)
    // ==========================================
    const wsLiab = workbook.addWorksheet('Nghĩa Vụ Nợ Điểm');
    wsLiab.views = [{ showGridLines: true }];

    const liabHeaders = [
      'Hạng Thẻ',
      'Thành Viên Còn Điểm',
      'Số Điểm Đang Nợ Khách',
      'Giá Trị Quy Đổi Nợ (₫)',
      'Hết Hạn Trong 7 Ngày',
      'Hết Hạn Trong 30 Ngày',
      'Hết Hạn Trong 60 Ngày',
      'Hết Hạn Trong 90 Ngày',
    ];
    const liabHeaderRow = wsLiab.addRow(liabHeaders);
    this.styleHeaderRow(liabHeaderRow, this.BRAND_HEADER_BG);

    for (const l of liabilities) {
      const row = wsLiab.addRow([
        l.tierName,
        l.membersWithPointsCount,
        l.outstandingPoints,
        l.estimatedLiabilityVnd,
        l.expiringIn7Days,
        l.expiringIn30Days,
        l.expiringIn60Days,
        l.expiringIn90Days,
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if (colNumber === 4) {
          cell.numFmt = '#,##0 "₫"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNumber >= 2) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsLiab);

    // ==========================================
    // SHEET 3: ĐỐI SOÁT SỔ CÁI ĐIỂM (POINT RECONCILIATION)
    // ==========================================
    const wsRec = workbook.addWorksheet('Đối Soát Sổ Cái');
    wsRec.views = [{ showGridLines: true }];

    const recHeaders = [
      'Họ Và Tên',
      'Số Điện Thoại',
      'Mã Thẻ',
      'Hạng Thẻ',
      'Số Dư Đầu Kỳ',
      'Tổng Tích (Earn)',
      'Tổng Tiêu (Redeem)',
      'Tổng Hết Hạn (Expire)',
      'Điều Chỉnh (Adjustment)',
      'Số Dư Tính Toán Sổ Cái',
      'Số Dư Trong DB User',
      'Chênh Lệch Đối Soát',
      'Trạng Thái',
    ];
    const recHeaderRow = wsRec.addRow(recHeaders);
    this.styleHeaderRow(recHeaderRow, 'B91C1C');

    for (const r of reconciliations) {
      const row = wsRec.addRow([
        r.fullName,
        r.phone || '—',
        r.memberCode || '—',
        r.tierName,
        r.openingBalance,
        r.totalEarned,
        r.totalRedeemed,
        r.totalExpired,
        r.totalAdjusted,
        r.calculatedClosingBalance,
        r.databaseCurrentPoints,
        r.discrepancy,
        r.isReconciled ? 'KHỚP' : 'LỆCH ĐỐI SOÁT',
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if (colNumber >= 5 && colNumber <= 12) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsRec);

    // ==========================================
    // SHEET 4: GIAO DỊCH ĐIỂM (POINT TRANSACTIONS)
    // ==========================================
    const wsTx = workbook.addWorksheet('Lịch Sử Giao Dịch Điểm');
    wsTx.views = [{ showGridLines: true }];

    const txHeaders = [
      'Mã GD',
      'Thời Gian',
      'Khách Hàng',
      'Số Điện Thoại',
      'Loại Giao Dịch',
      'Số Dư Trước',
      'Điểm Biến Động',
      'Số Dư Sau',
      'Mã Đơn',
      'Hạn Sử Dụng',
      'Mô Tả / Lý Do',
    ];
    const txHeaderRow = wsTx.addRow(txHeaders);
    this.styleHeaderRow(txHeaderRow, this.BRAND_PRIMARY);

    for (const t of transactions) {
      const row = wsTx.addRow([
        t.id.slice(0, 8),
        new Date(t.createdAt).toLocaleString('vi-VN'),
        t.userName || '—',
        t.userPhone || '—',
        t.source,
        t.balanceBefore,
        t.amount > 0 ? `+${t.amount}` : t.amount,
        t.balanceAfter,
        t.orderCode || '—',
        t.expiresAt ? new Date(t.expiresAt).toLocaleDateString('vi-VN') : 'Vô thời hạn',
        t.description || '—',
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        if ([6, 7, 8].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    this.autoFitColumns(wsTx);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
