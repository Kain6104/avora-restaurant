import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { PaymentMethodService } from './payment-method.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('payment-methods')
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  /**
   * Public / Client endpoint: Lấy danh sách phương thức thanh toán đang mở (lọc theo giỏ hàng)
   */
  @Get('active')
  async getActiveMethods(
    @Query('totalAmount') totalAmount?: string,
    @Query('branchId') branchId?: string,
  ) {
    const total = totalAmount ? parseFloat(totalAmount) : undefined;
    const data = await this.paymentMethodService.getActiveMethods(total, branchId);
    return { data };
  }

  /**
   * Public Webhook endpoint: Tiếp nhận callback thanh toán từ cổng điện tử (PayOS / MoMo / SePay)
   */
  @Post('webhook')
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
  ) {
    return this.paymentMethodService.handleWebhook(payload, signature);
  }

  /**
   * Admin: Lấy tất cả phương thức thanh toán (bao gồm cả đang tắt) để gán cho Voucher / Cấu hình
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('payment_methods.view')
  async getAdminAll() {
    const data = await this.paymentMethodService.findAll();
    return { success: true, data };
  }

  /**
   * Admin: Lấy tất cả phương thức thanh toán
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('payment_methods.view')
  async findAll() {
    const data = await this.paymentMethodService.findAll();
    return { success: true, data };
  }

  /**
   * Admin: Tạo phương thức thanh toán mới
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('payment_methods.create')
  async create(@Body() body: any) {
    const data = await this.paymentMethodService.create(body);
    return { data, message: 'Thêm phương thức thanh toán thành công' };
  }

  /**
   * Admin: Cập nhật phương thức thanh toán
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('payment_methods.update')
  async update(@Param('id') id: string, @Body() body: any) {
    const data = await this.paymentMethodService.update(id, body);
    return { data, message: 'Cập nhật phương thức thanh toán thành công' };
  }

  /**
   * Admin: Bật/tắt nhanh trạng thái isActive hoặc isActiveForPos
   */
  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('payment_methods.update')
  async toggleStatus(
    @Param('id') id: string,
    @Body('field') field: 'isActive' | 'isActiveForPos',
  ) {
    const data = await this.paymentMethodService.toggleStatus(id, field);
    return { data, message: 'Cập nhật trạng thái thành công' };
  }

  /**
   * Admin: Xóa phương thức thanh toán
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('payment_methods.delete')
  async delete(@Param('id') id: string) {
    await this.paymentMethodService.delete(id);
    return { success: true, message: 'Đã xóa phương thức thanh toán thành công' };
  }
}
