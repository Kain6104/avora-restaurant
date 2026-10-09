import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { OrderStatus } from '@prisma/client';
import {
  FlashSaleReportCalculationService,
  FlashSaleOrderItemInput,
  FlashSaleCampaignInput,
  CalculatedFlashSaleKPIs,
  CalculatedCampaignPerformanceItem,
  CalculatedFlashSaleProductPerformanceItem,
  FlashSaleStockReconciliationItem,
} from './flash-sale-report-calculation.service';
import { FlashSaleReportsExcelService } from './flash-sale-reports-excel.service';

export interface FlashSaleReportFilterDto {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  branchId?: string; // 'ALL' or specific branch UUID
  campaignId?: string;
  productId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class FlashSaleReportsService {
  private readonly logger = new Logger(FlashSaleReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthorizationService,
    private readonly calcEngine: FlashSaleReportCalculationService,
    private readonly excelService: FlashSaleReportsExcelService,
  ) {}

  async resolveBranchScope(
    userId: string,
    requestedBranchId?: string,
  ): Promise<{ allowedBranchIds: string[]; isAll: boolean }> {
    const permScope = await this.authService.getAllowedBranches(userId, 'reports.revenue.view');

    if (!permScope.isAll && permScope.branchIds.length === 0) {
      const fallbackScope = await this.authService.getAllowedBranches(userId, 'reports.view');
      if (!fallbackScope.isAll && fallbackScope.branchIds.length === 0) {
        throw new ForbiddenException({
          success: false,
          statusCode: 403,
          error: {
            code: 'FORBIDDEN_FLASH_SALE_REPORT_BRANCH',
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo flash sale tại bất kỳ chi nhánh nào.',
          },
        });
      }
      permScope.isAll = fallbackScope.isAll;
      permScope.branchIds = fallbackScope.branchIds;
    }

    if (
      requestedBranchId &&
      requestedBranchId !== 'ALL' &&
      requestedBranchId !== 'undefined' &&
      requestedBranchId !== 'null'
    ) {
      if (!permScope.isAll && !permScope.branchIds.includes(requestedBranchId)) {
        throw new ForbiddenException({
          success: false,
          statusCode: 403,
          error: {
            code: 'FORBIDDEN_BRANCH_ACCESS',
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo của chi nhánh này.',
          },
        });
      }
      return { allowedBranchIds: [requestedBranchId], isAll: false };
    }

    if (permScope.isAll) {
      const allBranches = await this.prisma.branch.findMany({ select: { id: true } });
      return { allowedBranchIds: allBranches.map((b) => b.id), isAll: true };
    }

    return { allowedBranchIds: permScope.branchIds, isAll: false };
  }

  buildOrderWhereClause(filter: FlashSaleReportFilterDto, allowedBranchIds: string[]): any {
    const where: any = {};

    // CARDINAL RULE: CHỈ LẤY ĐƠN COMPLETED
    where.status = OrderStatus.COMPLETED;
    where.branchId = { in: allowedBranchIds };

    let startDate: Date;
    let endDate: Date;

    if (filter.from && filter.to) {
      startDate = new Date(filter.from);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(filter.to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    where.OR = [
      {
        deliveredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      {
        deliveredAt: null,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    ];

    return where;
  }

  private async fetchCompletedFlashSaleOrderItems(orderWhere: any): Promise<FlashSaleOrderItemInput[]> {
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: orderWhere,
        OR: [{ isFlashSaleItem: true }, { flashSaleId: { not: null } }],
      },
      include: {
        order: {
          include: {
            branch: { select: { name: true } },
          },
        },
        product: {
          include: {
            category: { select: { name: true } },
          },
        },
      },
    });

    return orderItems.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      orderCode: item.order.orderCode,
      branchId: item.order.branchId,
      branchName: item.order.branch?.name,
      productId: item.productId,
      productName: item.product?.name || 'Sản phẩm Flash Sale',
      productCategoryName: item.product?.category?.name,
      quantity: item.quantity,
      priceAtSale: Number(item.priceAtSale) || Number(item.flashSalePriceSnapshot) || 0,
      originalPriceAtSale: Number(item.originalPriceAtSale) || Number(item.priceAtSale) || 0,
      isFlashSaleItem: item.isFlashSaleItem,
      flashSaleId: item.flashSaleId,
      flashSaleSlotId: item.flashSaleSlotId,
      flashSaleNameSnapshot: item.flashSaleNameSnapshot,
      flashSalePriceSnapshot: item.flashSalePriceSnapshot ? Number(item.flashSalePriceSnapshot) : null,
      orderDiscountAmount: Number(item.order.discountAmount) || 0,
      deliveredAt: item.order.deliveredAt,
      createdAt: item.order.createdAt,
      customerName: item.order.customerName,
      customerPhone: item.order.customerPhone,
    }));
  }

  private async fetchCampaigns(): Promise<FlashSaleCampaignInput[]> {
    const campaigns = await this.prisma.flashSale.findMany({
      include: {
        slots: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    });

    return campaigns.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      status: c.status,
      startTime: c.startTime,
      endTime: c.endTime,
      isActive: c.isActive,
      slots: c.slots.map((s) => ({
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      items: c.items.map((it) => ({
        id: it.id,
        flashSaleSlotId: it.flashSaleSlotId,
        productId: it.productId,
        productName: it.product?.name,
        flashSalePrice: Number(it.flashSalePrice) || 0,
        originalPriceSnapshot: it.originalPriceSnapshot ? Number(it.originalPriceSnapshot) : null,
        stock: it.stock,
        reservedStock: it.reservedStock,
        sold: it.sold,
        maxQuantityPerUser: it.maxQuantityPerUser,
        isActive: it.isActive,
      })),
    }));
  }

  async getOverview(userId: string, filter: FlashSaleReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const orderWhere = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [items, campaigns] = await Promise.all([
      this.fetchCompletedFlashSaleOrderItems(orderWhere),
      this.fetchCampaigns(),
    ]);

    const reconciliation = this.calcEngine.reconcileFlashSaleStock(campaigns, items);
    const kpis = this.calcEngine.calculateFlashSaleKPIs(campaigns, items, reconciliation);

    return {
      success: true,
      data: {
        kpis,
        totalItemsSoldInPeriod: items.length,
        activeCampaignsCount: campaigns.filter((c) => c.isActive).length,
      },
    };
  }

  async getCampaigns(userId: string, filter: FlashSaleReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const orderWhere = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [items, campaigns] = await Promise.all([
      this.fetchCompletedFlashSaleOrderItems(orderWhere),
      this.fetchCampaigns(),
    ]);

    const reconciliation = this.calcEngine.reconcileFlashSaleStock(campaigns, items);
    let list = this.calcEngine.calculateCampaignPerformance(campaigns, items, reconciliation);

    if (filter.campaignId && filter.campaignId !== 'ALL') {
      list = list.filter((c) => c.campaignId === filter.campaignId);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.campaignCode.toLowerCase().includes(q));
    }

    return {
      success: true,
      data: list,
    };
  }

  async getProducts(userId: string, filter: FlashSaleReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const orderWhere = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [items, campaigns] = await Promise.all([
      this.fetchCompletedFlashSaleOrderItems(orderWhere),
      this.fetchCampaigns(),
    ]);

    const reconciliation = this.calcEngine.reconcileFlashSaleStock(campaigns, items);
    let products = this.calcEngine.calculateProductPerformance(reconciliation, items);

    if (filter.campaignId && filter.campaignId !== 'ALL') {
      products = products.filter((p) => p.campaignId === filter.campaignId);
    }

    if (filter.productId && filter.productId !== 'ALL') {
      products = products.filter((p) => p.productId === filter.productId);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      products = products.filter((p) => p.productName.toLowerCase().includes(q));
    }

    return {
      success: true,
      data: products,
    };
  }

  async getTimeSlots(userId: string, filter: FlashSaleReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const orderWhere = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [items] = await Promise.all([
      this.fetchCompletedFlashSaleOrderItems(orderWhere),
    ]);

    const timeSlots = this.calcEngine.calculateTimeSlotAnalysis(items);

    return {
      success: true,
      data: timeSlots,
    };
  }

  async getStockReconciliation(userId: string, filter: FlashSaleReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const orderWhere = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [items, campaigns] = await Promise.all([
      this.fetchCompletedFlashSaleOrderItems(orderWhere),
      this.fetchCampaigns(),
    ]);

    const reconciliation = this.calcEngine.reconcileFlashSaleStock(campaigns, items);

    return {
      success: true,
      data: reconciliation,
      meta: {
        totalRecords: reconciliation.length,
        discrepanciesCount: reconciliation.filter((r) => r.hasReconciliationError).length,
        oversellingCount: reconciliation.filter((r) => r.isOverselling).length,
      },
    };
  }

  async exportExcel(userId: string, filter: FlashSaleReportFilterDto): Promise<Buffer> {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const orderWhere = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [items, campaigns] = await Promise.all([
      this.fetchCompletedFlashSaleOrderItems(orderWhere),
      this.fetchCampaigns(),
    ]);

    const reconciliation = this.calcEngine.reconcileFlashSaleStock(campaigns, items);
    const kpis = this.calcEngine.calculateFlashSaleKPIs(campaigns, items, reconciliation);
    const campaignPerf = this.calcEngine.calculateCampaignPerformance(campaigns, items, reconciliation);
    const productPerf = this.calcEngine.calculateProductPerformance(reconciliation, items);

    let branchName = 'Toàn hệ thống';
    if (filter.branchId && filter.branchId !== 'ALL') {
      const b = await this.prisma.branch.findUnique({
        where: { id: filter.branchId },
        select: { name: true },
      });
      if (b) branchName = b.name;
    }

    return this.excelService.exportFlashSaleExcel(
      kpis,
      campaignPerf,
      productPerf,
      reconciliation,
      branchName,
      filter.from,
      filter.to,
    );
  }
}
