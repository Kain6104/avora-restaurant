import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { FinancialReportCalculationService } from './financial-report-calculation.service';
import { OrderStatus, Prisma } from '@prisma/client';
import {
  parseVietnamDateRange,
  validateSevenDaysRule,
  formatVietnamDateTime,
  getVietnamNow,
} from '../../common/utils/vietnam-time.util';
import { COMPLETED_ORDER_STATUSES } from '../../common/utils/order-scope.util';

export interface EndOfDayQueryDto {
  from?: string; // YYYY-MM-DD hoặc ISO string
  to?: string;   // YYYY-MM-DD hoặc ISO string
  fromHour?: string | number;
  toHour?: string | number;
  branchId?: string; // UUID hoặc 'ALL'
  source?: string;   // ALL, POS, ONLINE, WEB, CHATBOT, QR_ORDER
  staffId?: string;  // cashierId
  shiftId?: string;  // cashShiftId
  includeItemDetails?: string | boolean;
}

export interface EndOfDayPeriodInfo {
  from: string; // VD: "13/09/2026 00:00"
  to: string;   // VD: "13/09/2026 13:50"
  fromUtc: string;
  toUtc: string;
  fromDateVn: string;
  toDateVn: string;
}

export interface EndOfDayBranchInfo {
  id: string;
  name: string;
  branchCode: string;
  address?: string;
  phone?: string;
}

export interface EndOfDayStaffInfo {
  id?: string;
  name?: string;
  shiftId?: string;
}

export interface EndOfDaySummary {
  completedOrderCount: number;
  cancelledOrderCount: number; // Chỉ để tham khảo
  totalGrossSales: number;     // Doanh thu gộp (tổng món + phụ thu)
  totalDirectItemDiscount: number;
  totalVoucherDiscount: number;
  totalShippingDiscount: number;
  totalDiscount: number;       // Tổng giảm giá
  totalVat: number;            // VAT thực tế
  netSales: number;            // Doanh thu ròng sau VAT và chiết khấu
  refundTotal: number;         // Tiền hoàn lại
  shippingFeeOriginal: number;
  shippingFeeCustomerPaid: number;
  serviceChargeTotal: number;
  totalActualCollected: number; // TỔNG THỰC THU
}

export interface EndOfDayPaymentMethodItem {
  method: string;
  label: string;
  count: number;
  amount: number;
  refunded: number;
  netAmount: number;
}

export interface EndOfDayCategorySalesItem {
  categoryId: string;
  categoryName: string;
  quantitySold: number;
  revenue: number;
}

export interface EndOfDayProductSalesItem {
  productId: string;
  itemCode: string;
  name: string;
  categoryName: string;
  quantitySold: number;
  unitPriceSnapshot: number;
  discountAmount: number;
  vatAmount: number;
  lineTotal: number;
}

export interface EndOfDayReconciliation {
  valid: boolean;
  difference: number;
  totalPaymentSum: number;
  totalCollectedSum: number;
  warnings: string[];
}

export interface EndOfDayReportResponse {
  period: EndOfDayPeriodInfo;
  branch: EndOfDayBranchInfo;
  staff: EndOfDayStaffInfo | null;
  summary: EndOfDaySummary;
  payments: EndOfDayPaymentMethodItem[];
  categorySales: EndOfDayCategorySalesItem[];
  productSales?: EndOfDayProductSalesItem[];
  reconciliation: EndOfDayReconciliation;
  generatedAt: string;
  generatedAtVn: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ ngân hàng',
  TRANSFER: 'Chuyển khoản',
  PAYOS: 'PayOS (QR)',
  MOMO: 'Ví MoMo',
  VNPAY: 'VNPAY',
  POINT: 'Điểm thưởng',
  COD: 'Thu hộ (COD)',
  OTHER: 'Khác',
};

@Injectable()
export class EndOfDayReportService {
  private readonly logger = new Logger(EndOfDayReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthorizationService,
    private readonly calcEngine: FinancialReportCalculationService,
  ) {}

  /**
   * Phân quyền phạm vi chi nhánh (RBAC):
   * - ADMIN: được xem tất cả hoặc từng chi nhánh được chọn.
   * - MANAGER / CASHIER: bị khóa cứng theo chi nhánh được phân công.
   */
  async resolveBranchScope(
    userId: string,
    requestedBranchId?: string,
  ): Promise<{ allowedBranchIds: string[]; isAll: boolean; activeBranch?: any }> {
    // Kiểm tra quyền cash_shift.view hoặc reports.revenue.view hoặc reports.view
    const permScope = await this.authService.getAllowedBranches(userId, 'cash_shift.view');

    let isAll = permScope.isAll;
    let allowedBranchIds = permScope.branchIds;

    if (!isAll && allowedBranchIds.length === 0) {
      // Fallback kiểm tra reports.revenue.view
      const revScope = await this.authService.getAllowedBranches(userId, 'reports.revenue.view');
      isAll = revScope.isAll;
      allowedBranchIds = revScope.branchIds;

      if (!isAll && allowedBranchIds.length === 0) {
        // Fallback kiểm tra reports.view
        const viewScope = await this.authService.getAllowedBranches(userId, 'reports.view');
        isAll = viewScope.isAll;
        allowedBranchIds = viewScope.branchIds;

        if (!isAll && allowedBranchIds.length === 0) {
          // Kiểm tra xem user có thuộc chi nhánh nào trực tiếp không
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { branchId: true, role: true },
          });

          if (user?.role === 'ADMIN') {
            isAll = true;
          } else if (user?.branchId) {
            allowedBranchIds = [user.branchId];
          } else {
            throw new ForbiddenException({
              success: false,
              statusCode: 403,
              error: {
                code: 'FORBIDDEN_REPORT_BRANCH',
                message: 'Bạn không có quyền xem báo cáo tổng kết tại bất kỳ chi nhánh nào.',
              },
            });
          }
        }
      }
    }

    if (
      requestedBranchId &&
      requestedBranchId !== 'ALL' &&
      requestedBranchId !== 'undefined' &&
      requestedBranchId !== 'null'
    ) {
      if (!isAll && !allowedBranchIds.includes(requestedBranchId)) {
        throw new ForbiddenException({
          success: false,
          statusCode: 403,
          error: {
            code: 'FORBIDDEN_BRANCH_ACCESS',
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo của chi nhánh này.',
          },
        });
      }

      const branch = await this.prisma.branch.findUnique({
        where: { id: requestedBranchId },
        select: { id: true, name: true, branchCode: true, street: true, phone: true },
      });

      return { allowedBranchIds: [requestedBranchId], isAll: false, activeBranch: branch };
    }

    if (isAll) {
      const allBranches = await this.prisma.branch.findMany({
        select: { id: true, name: true, branchCode: true, street: true, phone: true },
      });
      return {
        allowedBranchIds: allBranches.map((b) => b.id),
        isAll: true,
        activeBranch: {
          id: 'ALL',
          name: 'Tất cả chi nhánh',
          branchCode: 'ALL',
          street: 'Toàn hệ thống AVORA',
          phone: '1900-AVORA',
        },
      };
    }

    const firstBranch = await this.prisma.branch.findUnique({
      where: { id: allowedBranchIds[0] },
      select: { id: true, name: true, branchCode: true, street: true, phone: true },
    });

    return { allowedBranchIds, isAll: false, activeBranch: firstBranch };
  }

  /**
   * Tính toán báo cáo Tổng kết cuối ngày / Kết ca chuẩn xác tuyệt đối (Source of Truth)
   */
  async getEndOfDayReport(query: EndOfDayQueryDto, userId: string): Promise<EndOfDayReportResponse> {
    // 1. Phân quyền chi nhánh
    const branchScope = await this.resolveBranchScope(userId, query.branchId);

    // 2. Phân tích date range theo giờ Việt Nam
    const parsedRange = parseVietnamDateRange(
      query.from,
      query.to,
      query.fromHour,
      query.toHour,
    );

    // 3. Khóa cứng quy tắc 7 ngày gần nhất
    validateSevenDaysRule(parsedRange.startUtc, parsedRange.endUtc);

    // 4. Xây dựng mệnh đề where Prisma: CHỈ LẤY ĐƠN HOÀN THÀNH
    const baseWhere: Prisma.OrderWhereInput = {
      branchId: { in: branchScope.allowedBranchIds },
      createdAt: {
        gte: parsedRange.startUtc,
        lte: parsedRange.endUtc,
      },
    };

    // Lọc theo nguồn đơn
    if (query.source && query.source !== 'ALL') {
      if (query.source === 'POS') {
        baseWhere.orderSource = 'POS';
      } else if (query.source === 'ONLINE') {
        baseWhere.orderSource = { in: ['ONLINE', 'WEB', 'CHATBOT', 'VOICE', 'QR_ORDER'] };
      } else {
        baseWhere.orderSource = query.source as any;
      }
    }

    // Lọc theo thu ngân / nhân viên
    if (query.staffId && query.staffId !== 'ALL') {
      baseWhere.OR = [{ cashierId: query.staffId }, { userId: query.staffId }];
    }

    // Lọc theo ca làm việc nếu có
    if (query.shiftId) {
      baseWhere.payments = {
        some: { shiftId: query.shiftId },
      };
    }

    const completedWhere: Prisma.OrderWhereInput = {
      ...baseWhere,
      status: { in: COMPLETED_ORDER_STATUSES },
    };

    const cancelledWhere: Prisma.OrderWhereInput = {
      ...baseWhere,
      status: OrderStatus.CANCELLED,
    };

    // 5. Truy vấn đồng thời đơn hoàn thành và số lượng đơn hủy (đơn hủy chỉ tham khảo)
    const [completedOrders, cancelledOrderCount] = await Promise.all([
      this.prisma.order.findMany({
        where: completedWhere,
        include: {
          branch: {
            select: { id: true, name: true, branchCode: true, pointRedeemRate: true },
          },
          voucher: true,
          shippingVoucher: true,
          orderItems: {
            include: {
              product: {
                include: {
                  category: {
                    select: { id: true, name: true, slug: true, displayOrder: true },
                  },
                },
              },
              selectedOptions: true,
            },
          },
          payments: {
            include: {
              refunds: true,
            },
          },
          serviceCharges: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.count({ where: cancelledWhere }),
    ]);

    // 6. Tính toán tài chính từng đơn qua Financial Engine
    let totalGrossSales = 0;
    let totalDirectItemDiscount = 0;
    let totalVoucherDiscount = 0;
    let totalShippingDiscount = 0;
    let totalDiscount = 0;
    let totalVat = 0;
    let netSales = 0;
    let refundTotal = 0;
    let shippingFeeOriginal = 0;
    let shippingFeeCustomerPaid = 0;
    let serviceChargeTotal = 0;
    let totalActualCollected = 0;

    const paymentMap = new Map<
      string,
      { count: number; amount: number; refunded: number; netAmount: number }
    >();

    const categoryMap = new Map<
      string,
      { categoryId: string; categoryName: string; quantitySold: number; revenue: number }
    >();

    const productMap = new Map<
      string,
      {
        productId: string;
        itemCode: string;
        name: string;
        categoryName: string;
        quantitySold: number;
        unitPriceSnapshot: number;
        discountAmount: number;
        vatAmount: number;
        lineTotal: number;
      }
    >();

    for (const rawOrder of completedOrders) {
      const o = this.calcEngine.calculateOrderFinancials(rawOrder as any);

      // Cộng dồn KPIs
      totalGrossSales += o.grossSales;
      totalDirectItemDiscount += o.directItemDiscount;
      totalVoucherDiscount += (o.orderVoucherDiscount + o.pointsDiscount);
      totalShippingDiscount += o.shippingDiscount;
      totalDiscount += (o.totalItemDiscount + o.pointsDiscount);
      totalVat += o.vatTotalAmount;
      // Doanh thu ròng sau VAT
      netSales += (o.netSales - (o.vatPriceMode === 'VAT_INCLUDED' ? o.vatTotalAmount : 0));
      refundTotal += o.refundedAmount;
      shippingFeeOriginal += o.shippingFeeOriginal;
      shippingFeeCustomerPaid += o.shippingFeeCustomerPaid;
      serviceChargeTotal += o.serviceChargeTotal;
      totalActualCollected += o.netCollected;

      // Phương thức thanh toán
      if (rawOrder.payments && rawOrder.payments.length > 0) {
        for (const p of rawOrder.payments) {
          if (p.status === 'COMPLETED') {
            const m = p.paymentMethod || 'OTHER';
            const cur = paymentMap.get(m) || { count: 0, amount: 0, refunded: 0, netAmount: 0 };
            const pAmount = Math.round(Number(p.amount || 0));
            let pRefund = 0;
            for (const rf of p.refunds || []) {
              pRefund += Math.round(Number(rf.amount || 0));
            }
            cur.count += 1;
            cur.amount += pAmount;
            cur.refunded += pRefund;
            cur.netAmount += Math.max(0, pAmount - pRefund);
            paymentMap.set(m, cur);
          }
        }
      } else {
        // Fallback từ order.paymentMethod
        const m = rawOrder.paymentMethod || 'CASH';
        const cur = paymentMap.get(m) || { count: 0, amount: 0, refunded: 0, netAmount: 0 };
        const orderTotal = Math.round(Number(rawOrder.totalAmount || 0));
        cur.count += 1;
        cur.amount += orderTotal;
        cur.netAmount += orderTotal;
        paymentMap.set(m, cur);
      }

      // Hàng hóa bán ra (Category Sales & Product Sales)
      for (const item of o.items) {
        const rawItem = rawOrder.orderItems.find((ri) => ri.id === item.orderItemId);
        const category = rawItem?.product?.category;
        const catId = category?.id || 'UNGROUPED';
        const catName = category?.name || 'Món khác';

        // Doanh thu hàng hóa món = netAmountAfterDiscount (chưa tính ship)
        const itemLineRev = item.netAmountAfterDiscount;

        // Group Category
        const curCat = categoryMap.get(catId) || {
          categoryId: catId,
          categoryName: catName,
          quantitySold: 0,
          revenue: 0,
        };
        curCat.quantitySold += item.quantity;
        curCat.revenue += itemLineRev;
        categoryMap.set(catId, curCat);

        // Group Product (nếu yêu cầu chi tiết)
        if (query.includeItemDetails === true || query.includeItemDetails === 'true') {
          const pId = item.productId;
          const curProd = productMap.get(pId) || {
            productId: pId,
            itemCode: item.productCode || 'AVR',
            name: item.productName,
            categoryName: catName,
            quantitySold: 0,
            unitPriceSnapshot: item.unitPriceAtSale,
            discountAmount: 0,
            vatAmount: 0,
            lineTotal: 0,
          };
          curProd.quantitySold += item.quantity;
          curProd.discountAmount += item.totalDiscount;
          curProd.vatAmount += item.taxAmount;
          curProd.lineTotal += itemLineRev;
          productMap.set(pId, curProd);
        }
      }
    }

    // Format danh sách phương thức thanh toán
    const payments: EndOfDayPaymentMethodItem[] = Array.from(paymentMap.entries())
      .map(([method, val]) => ({
        method,
        label: PAYMENT_METHOD_LABELS[method] || method,
        count: val.count,
        amount: val.amount,
        refunded: val.refunded,
        netAmount: val.netAmount,
      }))
      .sort((a, b) => b.netAmount - a.netAmount);

    // Format danh sách nhóm hàng hóa
    const categorySales: EndOfDayCategorySalesItem[] = Array.from(categoryMap.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );

    // Format danh sách từng món
    const productSales: EndOfDayProductSalesItem[] | undefined =
      query.includeItemDetails === true || query.includeItemDetails === 'true'
        ? Array.from(productMap.values()).sort((a, b) => b.lineTotal - a.lineTotal)
        : undefined;

    // Reconciliation Check:
    // Tổng các phương thức thanh toán phải khớp với Thực thu
    const totalPaymentSum = payments.reduce((sum, p) => sum + p.netAmount, 0);
    const diff = Math.abs(totalPaymentSum - totalActualCollected);
    const warnings: string[] = [];

    if (diff > 500) { // Sai số lớn hơn 500đ
      warnings.push(
        `Phát hiện chênh lệch ${diff.toLocaleString('vi-VN')} đ giữa tổng phương thức thanh toán (${totalPaymentSum.toLocaleString('vi-VN')} đ) và tổng thực thu (${totalActualCollected.toLocaleString('vi-VN')} đ).`,
      );
    }

    // Thông tin nhân viên / ca
    let staffInfo: EndOfDayStaffInfo | null = null;
    if (query.staffId) {
      const staffUser = await this.prisma.user.findUnique({
        where: { id: query.staffId },
        select: { id: true, fullName: true },
      });
      if (staffUser) {
        staffInfo = {
          id: staffUser.id,
          name: staffUser.fullName,
          shiftId: query.shiftId,
        };
      }
    } else if (query.shiftId) {
      const shift = await this.prisma.cashShift.findUnique({
        where: { id: query.shiftId },
        include: { cashier: { select: { id: true, fullName: true } } },
      });
      if (shift) {
        staffInfo = {
          id: shift.cashierId,
          name: shift.cashier.fullName,
          shiftId: shift.id,
        };
      }
    }

    const nowVn = getVietnamNow();

    return {
      period: {
        from: parsedRange.startVnStr,
        to: parsedRange.endVnStr,
        fromUtc: parsedRange.startUtc.toISOString(),
        toUtc: parsedRange.endUtc.toISOString(),
        fromDateVn: parsedRange.fromDateVn,
        toDateVn: parsedRange.toDateVn,
      },
      branch: {
        id: branchScope.activeBranch?.id || 'ALL',
        name: branchScope.activeBranch?.name || 'Chi nhánh AVORA',
        branchCode: branchScope.activeBranch?.branchCode || 'AVR',
        address: branchScope.activeBranch?.street || 'TP. Hồ Chí Minh',
        phone: branchScope.activeBranch?.phone || '1900-AVORA',
      },
      staff: staffInfo,
      summary: {
        completedOrderCount: completedOrders.length,
        cancelledOrderCount,
        totalGrossSales,
        totalDirectItemDiscount,
        totalVoucherDiscount,
        totalShippingDiscount,
        totalDiscount,
        totalVat,
        netSales,
        refundTotal,
        shippingFeeOriginal,
        shippingFeeCustomerPaid,
        serviceChargeTotal,
        totalActualCollected,
      },
      payments,
      categorySales,
      productSales,
      reconciliation: {
        valid: diff <= 500,
        difference: diff,
        totalPaymentSum,
        totalCollectedSum: totalActualCollected,
        warnings,
      },
      generatedAt: nowVn.toISOString(),
      generatedAtVn: formatVietnamDateTime(nowVn.toDate()),
    };
  }
}
