import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { OrderCancellationService } from './order-cancellation.service';
import { CancelUnpaidOrderDto } from './dto/cancel-unpaid-order.dto';
import { RequestPaidCancellationDto } from './dto/request-paid-cancellation.dto';
import { ReviewPaidCancellationDto } from './dto/review-paid-cancellation.dto';
import { ExecuteRefundDto } from './dto/execute-refund.dto';
import { TaxInvoiceActionDto } from './dto/tax-invoice-action.dto';
import { QueryCancellationsDto } from './dto/query-cancellations.dto';

@Controller('admin/cancellations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrderCancellationController {
  constructor(private readonly cancellationService: OrderCancellationService) {}

  // 1. Hủy đơn chưa thanh toán
  @Post('orders/:orderId/unpaid')
  @RequirePermission('orders.cancel_unpaid', {
    resourceResolver: async (req, prisma) => {
      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        select: { branchId: true },
      });
      return order?.branchId;
    },
  })
  async cancelUnpaidOrder(
    @Param('orderId') orderId: string,
    @Body() dto: CancelUnpaidOrderDto,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    return this.cancellationService.cancelUnpaidOrder(
      orderId,
      dto,
      req.user,
      branchIdScope,
    );
  }

  // 2. Yêu cầu hủy hóa đơn đã thanh toán
  @Post('orders/:orderId/paid/request')
  @RequirePermission('orders.request_paid_cancellation', {
    resourceResolver: async (req, prisma) => {
      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        select: { branchId: true },
      });
      return order?.branchId;
    },
  })
  async requestPaidCancellation(
    @Param('orderId') orderId: string,
    @Body() dto: RequestPaidCancellationDto,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    return this.cancellationService.requestPaidCancellation(
      orderId,
      dto,
      req.user,
      branchIdScope,
    );
  }

  // 3. Phê duyệt / Từ chối hủy hóa đơn đã thanh toán (Dual Approval)
  @Post('orders/:orderId/paid/review')
  @RequirePermission('orders.approve_paid_cancellation', {
    resourceResolver: async (req, prisma) => {
      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        select: { branchId: true },
      });
      return order?.branchId;
    },
  })
  async reviewPaidCancellation(
    @Param('orderId') orderId: string,
    @Body() dto: ReviewPaidCancellationDto,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    return this.cancellationService.reviewPaidCancellation(
      orderId,
      dto,
      req.user,
      branchIdScope,
    );
  }

  // 4. Thực thi chi tiền hoàn (Refund Execution)
  @Post('orders/:orderId/paid/refund')
  @RequirePermission('payments.refund.execute', {
    resourceResolver: async (req, prisma) => {
      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        select: { branchId: true },
      });
      return order?.branchId;
    },
  })
  async executeRefund(
    @Param('orderId') orderId: string,
    @Body() dto: ExecuteRefundDto,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    return this.cancellationService.executeRefund(
      orderId,
      dto,
      req.user,
      branchIdScope,
    );
  }

  // 5. Xử lý hóa đơn thuế VAT / Hóa đơn điện tử
  @Post('orders/:orderId/paid/tax-invoice')
  @RequirePermission('invoices.cancel', {
    resourceResolver: async (req, prisma) => {
      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        select: { branchId: true },
      });
      return order?.branchId;
    },
  })
  async handleTaxInvoice(
    @Param('orderId') orderId: string,
    @Body() dto: TaxInvoiceActionDto,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    return this.cancellationService.handleTaxInvoice(
      orderId,
      dto,
      req.user,
      branchIdScope,
    );
  }

  // 6. Báo cáo hủy đơn chưa thanh toán
  @Get('unpaid')
  @RequirePermission('orders.view_unpaid_cancellations')
  async getUnpaidReport(
    @Query() query: QueryCancellationsDto,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.cancellationService.getUnpaidCancellationReport(
      query,
      req.user,
      branchIdScope,
    );
    return { success: true, data };
  }

  // 7. Báo cáo hủy hóa đơn đã thanh toán
  @Get('paid')
  @RequirePermission('orders.view_paid_cancellations')
  async getPaidReport(
    @Query() query: QueryCancellationsDto,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.cancellationService.getPaidCancellationReport(
      query,
      req.user,
      branchIdScope,
    );
    return { success: true, data };
  }

  // 8. Chi tiết hồ sơ hủy
  @Get(':idOrCode')
  @RequirePermission('orders.view')
  async getDetail(
    @Param('idOrCode') idOrCode: string,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    return this.cancellationService.getCancellationDetail(
      idOrCode,
      req.user,
      branchIdScope,
    );
  }
}

