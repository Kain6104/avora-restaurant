import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PrintTemplateService } from './print-template.service';
import { PrintTemplateTagsService } from './print-template-tags.service';
import { CreatePrintTemplateDto } from './dto/create-print-template.dto';
import { UpdatePrintTemplateDto } from './dto/update-print-template.dto';
import { PreviewPrintTemplateDto } from './dto/preview-print-template.dto';
import { DuplicatePrintTemplateDto } from './dto/duplicate-print-template.dto';
import { KitchenTicketRenderDto } from './dto/kitchen-ticket-render.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PrintTemplateType } from '@prisma/client';

@Controller('print-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PrintTemplateController {
  constructor(
    private readonly printTemplateService: PrintTemplateService,
    private readonly tagsService: PrintTemplateTagsService,
  ) {}

  /**
   * Lấy danh mục thẻ dữ liệu động (Searchable & Grouped)
   */
  @Get('tags')
  @RequirePermission('print_templates.view')
  getTags() {
    const categories = this.tagsService.getCategorizedTags();
    const allTags = this.tagsService.getTagRegistry();
    return {
      success: true,
      data: {
        categories,
        allTags,
      },
    };
  }

  /**
   * Xem trước mẫu in (Mock data hoặc Đơn hàng thật)
   */
  @Post('preview')
  @RequirePermission('print_templates.view')
  async preview(@Body() dto: PreviewPrintTemplateDto) {
    const result = await this.printTemplateService.preview(dto);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Render hóa đơn thật cho POS (Receipt, Temp bill, Online, Item label)
   */
  @Get('render/order/:orderId')
  @RequirePermission('pos.receipt.print')
  async renderForOrder(
    @Param('orderId') orderId: string,
    @Query('type') type: PrintTemplateType = PrintTemplateType.RECEIPT,
    @Query('qrPayload') qrPayload?: string,
    @Query('paperSize') paperSize?: string,
  ) {
    const result = await this.printTemplateService.renderForOrder(orderId, type, qrPayload, paperSize);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Render Phiếu Bếp Vi Sai (Kitchen Ticket Differential Printing) với Idempotency
   */
  @Post('render/kitchen-ticket')
  @RequirePermission('pos.kitchen_ticket.reprint')
  async renderKitchenTicket(@Body() dto: KitchenTicketRenderDto, @Req() req: any) {
    const result = await this.printTemplateService.renderKitchenTicket(dto, req.user);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Lấy danh sách mẫu in theo branchId
   */
  @Get()
  @RequirePermission('print_templates.view')
  async findByBranch(
    @Query('branchId') branchId: string,
    @Query('type') type?: PrintTemplateType,
    @Req() req?: any,
  ) {
    const effectiveBranchId = req.user?.branchId || branchId;
    const templates = await this.printTemplateService.findByBranch(effectiveBranchId, type);
    return {
      success: true,
      data: templates,
    };
  }

  /**
   * Lấy chi tiết mẫu in
   */
  @Get(':id')
  @RequirePermission('print_templates.view')
  async findOne(@Param('id') id: string) {
    const template = await this.printTemplateService.findOne(id);
    return {
      success: true,
      data: template,
    };
  }

  /**
   * Tạo mới mẫu in
   */
  @Post()
  @RequirePermission('print_templates.create')
  async create(@Body() dto: CreatePrintTemplateDto, @Req() req: any) {
    const template = await this.printTemplateService.create(dto, req.user);
    return {
      success: true,
      data: template,
      message: 'Đã tạo mẫu in thành công',
    };
  }

  /**
   * Cập nhật mẫu in kèm version kiểm soát xung đột
   */
  @Put(':id')
  @RequirePermission('print_templates.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePrintTemplateDto,
    @Req() req: any,
  ) {
    const template = await this.printTemplateService.update(id, dto, req.user);
    return {
      success: true,
      data: template,
      message: 'Đã lưu mẫu in thành công',
    };
  }

  /**
   * Xóa mẫu in
   */
  @Delete(':id')
  @RequirePermission('print_templates.delete')
  async delete(@Param('id') id: string, @Req() req: any) {
    const result = await this.printTemplateService.delete(id, req.user);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Đặt mẫu in làm mặc định cho loại
   */
  @Patch(':id/default')
  @RequirePermission('print_templates.update')
  async setDefault(@Param('id') id: string, @Req() req: any) {
    const template = await this.printTemplateService.setDefault(id, req.user);
    return {
      success: true,
      data: template,
      message: 'Đã đặt làm mẫu in mặc định',
    };
  }

  /**
   * Nhân bản mẫu in sang chi nhánh khác
   */
  @Post(':id/duplicate')
  @RequirePermission('print_templates.create')
  async duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicatePrintTemplateDto,
    @Req() req: any,
  ) {
    const template = await this.printTemplateService.duplicate(
      id,
      dto.targetBranchId,
      dto.newName,
      req.user,
    );
    return {
      success: true,
      data: template,
      message: 'Đã nhân bản mẫu in thành công',
    };
  }

  /**
   * Lấy lịch sử các phiên bản của mẫu in
   */
  @Get(':id/versions')
  @RequirePermission('print_templates.history.view')
  async getVersions(@Param('id') id: string) {
    const versions = await this.printTemplateService.getVersions(id);
    return {
      success: true,
      data: versions,
    };
  }

  /**
   * Khôi phục phiên bản cũ (Rollback)
   */
  @Post(':id/restore-version/:versionId')
  @RequirePermission('print_templates.restore')
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: any,
  ) {
    const template = await this.printTemplateService.restoreVersion(id, versionId, req.user);
    return {
      success: true,
      data: template,
      message: `Đã khôi phục thành công (Tạo phiên bản mới v${template.version})`,
    };
  }
}
