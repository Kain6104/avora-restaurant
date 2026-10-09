import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrintTemplateType, OrderStatus } from '@prisma/client';
import { CreatePrintTemplateDto } from './dto/create-print-template.dto';
import { UpdatePrintTemplateDto } from './dto/update-print-template.dto';
import { PreviewPrintTemplateDto } from './dto/preview-print-template.dto';
import { KitchenTicketRenderDto } from './dto/kitchen-ticket-render.dto';
import { PrintTemplateTagsService } from './print-template-tags.service';
import { PrintTemplateValidatorService } from './print-template-validator.service';
import { PrintTemplateRendererService, RenderContext, RenderItemData } from './print-template-renderer.service';

@Injectable()
export class PrintTemplateService {
  private readonly logger = new Logger(PrintTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tagsService: PrintTemplateTagsService,
    private readonly validator: PrintTemplateValidatorService,
    private readonly renderer: PrintTemplateRendererService,
  ) {}

  /**
   * Lấy danh sách mẫu in theo chi nhánh, tự động seed nếu chi nhánh chưa có mẫu nào
   */
  async findByBranch(branchId: string, type?: PrintTemplateType) {
    let templates = await this.prisma.printTemplate.findMany({
      where: {
        branchId,
        ...(type ? { type } : {}),
      },
      orderBy: [{ isDefault: 'desc' }, { type: 'asc' }, { updatedAt: 'desc' }],
    });

    if (templates.length === 0 && !type) {
      // Tự động seed 5 mẫu chuẩn cho chi nhánh nếu chưa có bất kỳ mẫu nào
      await this.seedDefaultTemplatesForBranch(branchId);
      templates = await this.prisma.printTemplate.findMany({
        where: { branchId },
        orderBy: [{ isDefault: 'desc' }, { type: 'asc' }, { updatedAt: 'desc' }],
      });
    }

    return templates;
  }

  /**
   * Lấy chi tiết mẫu in theo ID
   */
  async findOne(id: string) {
    const template = await this.prisma.printTemplate.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
      },
    });

    if (!template) {
      throw new NotFoundException(`Không tìm thấy mẫu in với ID: ${id}`);
    }

    return template;
  }

  /**
   * Tạo mẫu in mới (kèm transaction đặt default duy nhất và lưu version 1)
   */
  async create(dto: CreatePrintTemplateDto, user: any) {
    // 1. Kiểm tra cú pháp template
    this.validator.assertValid(dto.content, dto.type, dto.paperSize);

    // 2. Transaction tạo template và đồng bộ isDefault
    const createdTemplate = await this.prisma.$transaction(async (tx) => {
      // Nếu đặt làm default, reset các mẫu khác cùng loại của chi nhánh thành false
      if (dto.isDefault) {
        await tx.printTemplate.updateMany({
          where: { branchId: dto.branchId, type: dto.type, isDefault: true },
          data: { isDefault: false },
        });
      }

      // Tạo mẫu mới
      const newTemplate = await tx.printTemplate.create({
        data: {
          name: dto.name,
          type: dto.type,
          content: dto.content,
          branchId: dto.branchId,
          isDefault: Boolean(dto.isDefault),
          paperSize: dto.paperSize || '80mm',
          settings: dto.settings || {},
          version: 1,
        },
      });

      // Tạo snapshot version 1
      await tx.printTemplateVersion.create({
        data: {
          printTemplateId: newTemplate.id,
          version: 1,
          content: newTemplate.content,
          paperSize: newTemplate.paperSize,
          settings: newTemplate.settings as any,
          createdBy: user?.fullName || user?.email || 'Admin',
        },
      });

      return newTemplate;
    });

    // 3. Ghi chép AuditLog
    await this.logAudit(
      user?.id,
      'CREATE_PRINT_TEMPLATE',
      `PrintTemplate:${createdTemplate.id}`,
      null,
      JSON.stringify({ name: createdTemplate.name, type: createdTemplate.type, branchId: createdTemplate.branchId }),
    );

    return createdTemplate;
  }

  /**
   * Cập nhật mẫu in kèm Optimistic Concurrency Control (kiểm tra version)
   */
  async update(id: string, dto: UpdatePrintTemplateDto, user: any) {
    const existing = await this.findOne(id);

    // Kiểm tra quyền hạn branch nếu không phải ADMIN
    if (user.role === 'MANAGER' && user.branchId && user.branchId !== existing.branchId) {
      throw new ForbiddenException('Bạn chỉ có quyền quản lý mẫu in của chi nhánh mình.');
    }

    // 1. Kiểm tra xung đột đồng thời (Optimistic Concurrency Control)
    if (existing.version !== dto.version) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Mẫu in đã được chỉnh sửa bởi người khác. Vui lòng tải lại phiên bản mới nhất.',
        currentVersion: existing.version,
        sentVersion: dto.version,
      });
    }

    // 2. Kiểm tra cú pháp template nếu có sửa content
    if (dto.content) {
      this.validator.assertValid(
        dto.content,
        dto.type || existing.type,
        dto.paperSize || existing.paperSize,
      );
    }

    const nextVersion = existing.version + 1;

    // 3. Transaction cập nhật và lưu snapshot version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Nếu bật isDefault, đặt các mẫu khác cùng branch và type thành false
      if (dto.isDefault) {
        await tx.printTemplate.updateMany({
          where: {
            branchId: existing.branchId,
            type: dto.type || existing.type,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }

      const templateUpdated = await tx.printTemplate.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          type: dto.type ?? existing.type,
          content: dto.content ?? existing.content,
          isDefault: dto.isDefault !== undefined ? dto.isDefault : existing.isDefault,
          paperSize: dto.paperSize ?? existing.paperSize,
          settings: dto.settings ?? (existing.settings as any),
          version: nextVersion,
        },
      });

      // Lưu snapshot vào PrintTemplateVersion
      await tx.printTemplateVersion.create({
        data: {
          printTemplateId: id,
          version: nextVersion,
          content: templateUpdated.content,
          paperSize: templateUpdated.paperSize,
          settings: templateUpdated.settings as any,
          createdBy: user?.fullName || user?.email || 'Admin',
        },
      });

      return templateUpdated;
    });

    // 4. Ghi chép AuditLog
    await this.logAudit(
      user?.id,
      'UPDATE_PRINT_TEMPLATE',
      `PrintTemplate:${id}`,
      JSON.stringify({ version: existing.version }),
      JSON.stringify({ version: nextVersion, name: updated.name }),
    );

    return updated;
  }

  /**
   * Xóa mẫu in
   */
  async delete(id: string, user: any) {
    const existing = await this.findOne(id);

    if (user.role === 'MANAGER' && user.branchId && user.branchId !== existing.branchId) {
      throw new ForbiddenException('Bạn chỉ có quyền quản lý mẫu in của chi nhánh mình.');
    }

    await this.prisma.printTemplate.delete({
      where: { id },
    });

    await this.logAudit(
      user?.id,
      'DELETE_PRINT_TEMPLATE',
      `PrintTemplate:${id}`,
      JSON.stringify({ name: existing.name, branchId: existing.branchId }),
      null,
    );

    return { message: 'Đã xóa mẫu in thành công' };
  }

  /**
   * Đặt mẫu in làm mặc định duy nhất cho cặp (branchId, type)
   */
  async setDefault(id: string, user: any) {
    const existing = await this.findOne(id);

    if (user.role === 'MANAGER' && user.branchId && user.branchId !== existing.branchId) {
      throw new ForbiddenException('Bạn chỉ có quyền quản lý mẫu in của chi nhánh mình.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Set tất cả mẫu khác cùng branch và type về false
      await tx.printTemplate.updateMany({
        where: {
          branchId: existing.branchId,
          type: existing.type,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });

      return tx.printTemplate.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    await this.logAudit(
      user?.id,
      'SET_DEFAULT_PRINT_TEMPLATE',
      `PrintTemplate:${id}`,
      null,
      JSON.stringify({ branchId: existing.branchId, type: existing.type }),
    );

    return updated;
  }

  /**
   * Nhân bản mẫu in sang chi nhánh khác
   */
  async duplicate(id: string, targetBranchId: string, newName: string, user: any) {
    const source = await this.findOne(id);

    const duplicated = await this.prisma.$transaction(async (tx) => {
      const copy = await tx.printTemplate.create({
        data: {
          name: newName,
          type: source.type,
          content: source.content,
          branchId: targetBranchId,
          isDefault: false, // Mặc định khi nhân bản là false
          paperSize: source.paperSize,
          settings: source.settings as any,
          version: 1,
        },
      });

      await tx.printTemplateVersion.create({
        data: {
          printTemplateId: copy.id,
          version: 1,
          content: copy.content,
          paperSize: copy.paperSize,
          settings: copy.settings as any,
          createdBy: `${user?.fullName || user?.email || 'Admin'} (Nhân bản từ ${source.name})`,
        },
      });

      return copy;
    });

    await this.logAudit(
      user?.id,
      'DUPLICATE_PRINT_TEMPLATE',
      `PrintTemplate:${duplicated.id}`,
      JSON.stringify({ sourceId: id }),
      JSON.stringify({ newName, targetBranchId }),
    );

    return duplicated;
  }

  /**
   * Xem danh sách lịch sử phiên bản của 1 mẫu in
   */
  async getVersions(templateId: string) {
    return this.prisma.printTemplateVersion.findMany({
      where: { printTemplateId: templateId },
      orderBy: { version: 'desc' },
      take: 30,
    });
  }

  /**
   * Khôi phục phiên bản cũ (Rollback) tạo thành version mới kế tiếp
   */
  async restoreVersion(templateId: string, versionId: string, user: any) {
    const template = await this.findOne(templateId);
    const targetVersion = await this.prisma.printTemplateVersion.findUnique({
      where: { id: versionId },
    });

    if (!targetVersion || targetVersion.printTemplateId !== templateId) {
      throw new NotFoundException('Không tìm thấy phiên bản cần khôi phục');
    }

    const nextVersion = template.version + 1;

    const restored = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.printTemplate.update({
        where: { id: templateId },
        data: {
          content: targetVersion.content,
          paperSize: targetVersion.paperSize,
          settings: targetVersion.settings as any,
          version: nextVersion,
        },
      });

      await tx.printTemplateVersion.create({
        data: {
          printTemplateId: templateId,
          version: nextVersion,
          content: targetVersion.content,
          paperSize: targetVersion.paperSize,
          settings: targetVersion.settings as any,
          createdBy: `${user?.fullName || user?.email || 'Admin'} (Khôi phục từ v${targetVersion.version})`,
        },
      });

      return updated;
    });

    await this.logAudit(
      user?.id,
      'RESTORE_PRINT_TEMPLATE_VERSION',
      `PrintTemplate:${templateId}`,
      JSON.stringify({ restoredFromVersion: targetVersion.version }),
      JSON.stringify({ newVersion: nextVersion }),
    );

    return restored;
  }

  /**
   * Xem trước mẫu in bằng Mock data hoặc Đơn hàng thật
   */
  async preview(dto: PreviewPrintTemplateDto): Promise<{ html: string }> {
    let context: RenderContext;

    if (dto.realOrderId) {
      // Nạp dữ liệu từ đơn hàng thật
      context = await this.buildOrderRenderContext(dto.realOrderId);
    } else {
      // Dùng mock context chuẩn
      context = this.renderer.createMockContext();
      if (dto.branchId) {
        const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
        if (branch) {
          context.branchName = branch.name;
          context.branchCode = branch.branchCode;
          context.branchAddress = `${branch.street || ''}, ${branch.ward || ''}, ${branch.district || ''}, ${branch.province || ''}`.replace(/^[\s,]+|[\s,]+$/g, '');
          context.branchPhone = branch.phone || '';
        }
      }
    }

    const html = await this.renderer.renderTemplate(
      dto.content,
      context,
      dto.paperSize || '80mm',
      dto.settings,
    );

    return { html };
  }

  /**
   * Render hóa đơn thật theo orderId và type (POS gọi trực tiếp)
   */
  async renderForOrder(
    orderId: string,
    type: PrintTemplateType,
    customQrPayload?: string,
    overridePaperSize?: string,
  ): Promise<{ html: string; paperSize: string; receiptPayload?: any }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        branchId: true,
        paymentStatus: true,
        status: true,
        branch: { select: { defaultPaperSize: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderId}`);
    }

    if (type === PrintTemplateType.RECEIPT) {
      const isPaid = order.paymentStatus === 'PAID' || order.status === OrderStatus.COMPLETED;
      if (!isPaid) {
        throw new BadRequestException('Chỉ được in hóa đơn thanh toán cho đơn hàng đã thanh toán (PAID).');
      }
    }

    // 1. Tìm template mặc định của chi nhánh
    let template = await this.prisma.printTemplate.findFirst({
      where: {
        branchId: order.branchId,
        type,
        isDefault: true,
      },
    });

    // 2. Nếu không có mặc định chi nhánh -> Tìm bất kỳ template cùng loại của chi nhánh
    if (!template) {
      template = await this.prisma.printTemplate.findFirst({
        where: { branchId: order.branchId, type },
      });
    }

    // 3. Nếu vẫn không có -> Fallback emergency
    let templateContent: string;
    let paperSize: string = overridePaperSize || template?.paperSize || (order as any)?.branch?.defaultPaperSize || '80mm';
    let settings: any = {};

    if (template) {
      templateContent = template.content;
      settings = template.settings;
    } else {
      this.logger.warn(
        `[PRINT_TEMPLATE_FALLBACK_USED] | branchId: ${order.branchId} | orderId: ${orderId} | type: ${type} | reason: NO_TEMPLATE_CONFIGURED | timestamp: ${new Date().toISOString()}`,
      );
      const emergency = this.renderer.getEmergencyTemplate(type);
      templateContent = emergency.content;
      if (!overridePaperSize) {
        paperSize = emergency.paperSize;
      }
    }

    // 4. Tạo Render Context chuẩn lấy 100% snapshot từ Order
    const context = await this.buildOrderRenderContext(orderId, customQrPayload, type);

    // 5. Render qua Unified Render Engine
    const html = await this.renderer.renderTemplate(templateContent, context, paperSize, settings);

    const receiptPayload = {
      orderId,
      orderCode: context.orderCode,
      tableName: context.tableName,
      orderType: (order as any).orderType || 'DINE_IN',
      cashierName: context.cashierName,
      restaurantName: context.storeName || 'AVORA RESTAURANT',
      branchName: context.branchName,
      branchAddress: context.branchAddress,
      branchPhone: context.branchPhone,
      items: (context.items || []).map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.priceAtSale,
        originalPrice: it.originalPriceAtSale,
        totalPrice: it.priceAtSale * it.quantity,
        discountAmount: it.discountAmount || 0,
        note: it.note,
        options: it.optionsText ? [it.optionsText] : [],
      })),
      subTotal: context.subTotal,
      totalAmount: context.totalAmount,
      itemDiscountTotal: context.discountAmount || 0,
      paymentMethod: context.paymentMethodStr || 'CASH',
      qrData: context.paymentQrPayload,
      isProForma: type === PrintTemplateType.TEMP_BILL,
    };

    return { html, paperSize, receiptPayload };
  }

  /**
   * Render tem nhãn món ăn (Item Label) cho các món được gửi bếp
   */
  async renderItemLabelsForOrder(
    order: any,
    itemsToDispatch: any[],
    labelSetting?: any,
  ): Promise<Array<{
    item: any;
    htmlContent: string;
    paperSize: string;
    labelSize: { width: string; height: string };
    copies: number;
    idempotencyKey: string;
  }>> {
    if (!itemsToDispatch || itemsToDispatch.length === 0) return [];

    // 1. Tìm template ITEM_LABEL của chi nhánh
    let template = await this.prisma.printTemplate.findFirst({
      where: {
        branchId: order.branchId,
        type: PrintTemplateType.ITEM_LABEL,
        isDefault: true,
      },
    });

    if (!template) {
      template = await this.prisma.printTemplate.findFirst({
        where: { branchId: order.branchId, type: PrintTemplateType.ITEM_LABEL },
      });
    }

    let templateContent: string;
    let paperSize = labelSetting?.paperSize || '50x30mm';
    let settings: any = {};

    if (template) {
      templateContent = template.content;
      paperSize = template.paperSize || paperSize;
      settings = template.settings;
    } else {
      const def = this.tagsService.getDefaultTemplateContent(PrintTemplateType.ITEM_LABEL);
      templateContent = def.content;
      paperSize = def.paperSize || paperSize;
    }

    // Chuẩn hóa khổ tem nhãn cho Print Agent
    let labelSize = { width: '50mm', height: '30mm' };
    if (paperSize === '50x70mm') {
      labelSize = { width: '50mm', height: '70mm' };
    } else if (paperSize === 'CUSTOM' && settings?.widthMm && settings?.heightMm) {
      labelSize = { width: `${settings.widthMm}mm`, height: `${settings.heightMm}mm` };
    } else {
      labelSize = { width: '50mm', height: '30mm' };
    }

    const now = new Date();
    const results: Array<{
      item: any;
      htmlContent: string;
      paperSize: string;
      labelSize: { width: string; height: string };
      copies: number;
      idempotencyKey: string;
    }> = [];

    const baseCopies = Math.max(1, labelSetting?.copies || 1);

    for (const item of itemsToDispatch) {
      const price = item.priceAtSale ?? item.price ?? item.product?.price ?? 0;
      const originalPrice = item.originalPriceAtSale ?? item.product?.price ?? price;
      const labelCount = Math.max(1, item.delta ?? item.quantity ?? 1);

      for (let i = 1; i <= labelCount; i++) {
        const itemContext: RenderContext = {
          storeName: order.branch?.name || 'AVORA RESTAURANT',
          branchName: order.branch?.name || 'AVORA Restaurant',
          branchAddress: order.branch?.address || '',
          branchPhone: order.branch?.phone || '',
          orderCode: order.orderCode || order.temporaryOrderCode || 'TMP',
          createdAt: order.createdAt || now,
          tableName: order.table?.name || (order.orderType === 'DELIVERY' ? 'Giao hàng' : 'Đơn mang đi'),
          orderTypeStr: order.orderType === 'DELIVERY' ? 'Giao hàng' : order.orderType === 'TAKEAWAY' ? 'Mang đi' : 'Tại bàn',
          customerName: order.customerName || '',
          guestCount: order.guestCount || 1,
          items: [
            {
              name: labelCount > 1 ? `${item.product?.name || item.name || ''} (${i}/${labelCount})` : (item.product?.name || item.name || ''),
              itemCode: item.product?.sku || item.itemCode || '',
              quantity: 1,
              unit: item.product?.unit || 'phần',
              priceAtSale: price,
              originalPriceAtSale: originalPrice,
              optionsText: item.optionsTextSnapshot || item.optionsText || '',
              note: item.note || '',
            },
          ],
          subTotal: price,
          discountAmount: 0,
          totalAmount: price,
        };

        const htmlContent = await this.renderer.renderTemplate(
          templateContent,
          itemContext,
          paperSize,
          settings,
        );

        results.push({
          item,
          htmlContent,
          paperSize,
          labelSize,
          copies: baseCopies,
          idempotencyKey: `label_${order.id}_${item.id}_${i}_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
        });
      }
    }

    return results;
  }

  /**
   * Render Phiếu Bếp Vi Sai (Kitchen Ticket Differential Printing) với Idempotency
   */
  async renderKitchenTicket(dto: KitchenTicketRenderDto, user?: any) {
    // 1. Kiểm tra Idempotency
    if (dto.idempotencyKey) {
      const existingRecord = await this.prisma.idempotencyRecord.findUnique({
        where: { key: dto.idempotencyKey },
      });
      if (existingRecord) {
        this.logger.log(`Idempotent hit for kitchen ticket: ${dto.idempotencyKey}`);
        return JSON.parse(existingRecord.response);
      }
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        branch: true,
        table: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${dto.orderId}`);
    }

    // 2. Xác định các item vi sai cần in (Item Diff)
    let itemsToPrint = order.orderItems;

    if (dto.orderItemIds && dto.orderItemIds.length > 0) {
      itemsToPrint = itemsToPrint.filter((item) => dto.orderItemIds!.includes(item.id));
    } else if (dto.ticketMode === 'NEW') {
      // Chế độ NEW: Chỉ in những món chưa in bếp
      itemsToPrint = itemsToPrint.filter((item) => !item.isKitchenPrinted);
    }

    if (itemsToPrint.length === 0 && dto.ticketMode !== 'NOTE') {
      return {
        success: true,
        message: 'Không có món mới cần gửi bếp.',
        itemCount: 0,
        html: '',
      };
    }

    // 3. Tìm template bếp của chi nhánh
    let template = await this.prisma.printTemplate.findFirst({
      where: {
        branchId: order.branchId,
        type: PrintTemplateType.KITCHEN_TICKET,
        isDefault: true,
      },
    });

    let templateContent = template?.content;
    let paperSize = template?.paperSize || '80mm';

    if (!templateContent) {
      this.logger.warn(
        `[PRINT_TEMPLATE_FALLBACK_USED] | branchId: ${order.branchId} | orderId: ${dto.orderId} | type: KITCHEN_TICKET | reason: NO_KITCHEN_TEMPLATE | timestamp: ${new Date().toISOString()}`,
      );
      const emergency = this.renderer.getEmergencyTemplate(PrintTemplateType.KITCHEN_TICKET);
      templateContent = emergency.content;
      paperSize = emergency.paperSize;
    }

    // Thêm banner tiêu đề trạng thái đặc thù vào phiếu bếp
    let ticketHeaderBanner = '';
    if (dto.ticketMode === 'ADD') {
      ticketHeaderBanner = `<div style="background:#000; color:#fff; font-size:18px; font-weight:900; text-align:center; padding:4px 0; margin-bottom:6px;">GỌI THÊM / ADD ITEM</div>`;
    } else if (dto.ticketMode === 'CANCEL') {
      ticketHeaderBanner = `<div style="background:#000; color:#fff; font-size:18px; font-weight:900; text-align:center; padding:4px 0; margin-bottom:6px;">HỦY MÓN / CANCEL ITEM</div>`;
    } else if (dto.ticketMode === 'NOTE') {
      ticketHeaderBanner = `<div style="background:#000; color:#fff; font-size:18px; font-weight:900; text-align:center; padding:4px 0; margin-bottom:6px;">YÊU CẦU TỪ KHÁCH</div>`;
    }

    if (ticketHeaderBanner) {
      templateContent = ticketHeaderBanner + templateContent;
    }

    // 4. Tạo Render Context cho món bếp
    const renderItems: RenderItemData[] = itemsToPrint.map((it) => ({
      name: it.product.name,
      itemCode: it.product.itemCode,
      quantity: it.quantity,
      unit: it.product.unit || 'phần',
      priceAtSale: it.priceAtSale,
      originalPriceAtSale: it.originalPriceAtSale,
      optionsText: it.optionsTextSnapshot || '',
      note: it.note || '',
      orderedAt: this.renderer.formatDateTime(it.sentToKitchenAt || new Date()),
    }));

    const context: RenderContext = {
      storeName: 'AVORA RESTAURANT',
      branchName: order.branch.name,
      branchCode: order.branch.branchCode,
      orderCode: order.orderCode || order.temporaryOrderCode || 'TMP',
      createdAt: order.createdAt,
      tableName: order.table?.name || 'Mang đi',
      orderNote: dto.noteContent || order.note || '',
      cashierName: user?.fullName || 'Thu ngân',
      items: renderItems,
      subTotal: 0,
      discountAmount: 0,
      totalAmount: 0,
    };

    const html = await this.renderer.renderTemplate(templateContent, context, paperSize);

    // 5. Cập nhật trạng thái isKitchenPrinted = true cho các item đã in
    if (itemsToPrint.length > 0 && dto.ticketMode !== 'CANCEL') {
      const itemIds = itemsToPrint.map((i) => i.id);
      await this.prisma.orderItem.updateMany({
        where: { id: { in: itemIds } },
        data: {
          isKitchenPrinted: true,
          sentToKitchenAt: new Date(),
        },
      });
    }

    const responsePayload = {
      success: true,
      itemCount: itemsToPrint.length,
      ticketMode: dto.ticketMode,
      html,
      paperSize,
    };

    // 6. Ghi chép Idempotency nếu có key (hết hạn sau 15 phút)
    if (dto.idempotencyKey) {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await this.prisma.idempotencyRecord.create({
        data: {
          key: dto.idempotencyKey,
          action: 'RENDER_KITCHEN_TICKET',
          response: JSON.stringify(responsePayload),
          expiresAt,
        },
      });
    }

    return responsePayload;
  }

  /**
   * Tạo RenderContext lấy 100% snapshot từ Order và OrderItems trong DB
   */
  private async buildOrderRenderContext(
    orderId: string,
    customQrPayload?: string,
    templateType?: PrintTemplateType,
  ): Promise<RenderContext> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        user: {
          include: {
            membershipTier: true,
          },
        },
        table: true,
        voucher: true,
        shippingVoucher: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        serviceCharges: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderId}`);
    }

    // Xử lý filter hiển thị món theo loại mẫu in & cấu hình chi nhánh
    let sourceOrderItems = order.orderItems;

    // Rule XXXV & XXXVI: Ẩn món Buffet 0đ khi in Tạm tính (nhưng nếu có phụ thu Option > 0 thì giữ lại dòng phụ thu)
    if (templateType === PrintTemplateType.TEMP_BILL && order.branch.excludeBuffetItemsFromTempBill) {
      sourceOrderItems = sourceOrderItems.filter((item) => {
        if (item.pricingMode === 'BUFFET_INCLUDED') {
          return item.priceAtSale > 0;
        }
        return true;
      });
    }

    // Rule XXXV: Khi in hóa đơn thanh toán chính thức (RECEIPT), ẩn các món excludedFromFinalReceipt
    if (templateType === PrintTemplateType.RECEIPT) {
      sourceOrderItems = sourceOrderItems.filter((item) => !item.excludedFromFinalReceipt);
    }

    // Map các món ăn bằng giá lịch sử tại thời điểm bán (priceAtSale)
    const items: RenderItemData[] = sourceOrderItems.map((item) => {
      let displayName = item.product.name;
      if (item.pricingMode === 'BUFFET_INCLUDED' && item.priceAtSale > 0) {
        displayName = `Phụ thu Buffet: ${item.product.name}`;
      } else if (item.pricingMode === 'BUFFET_TICKET') {
        displayName = `${item.product.name} (Vé Buffet)`;
      }

      return {
        name: displayName,
        itemCode: item.product.itemCode,
        quantity: item.quantity,
        unit: item.product.unit || 'phần',
        priceAtSale: item.priceAtSale,
        originalPriceAtSale: item.originalPriceAtSale,
        discountAmount: item.discountAmount,
        optionsText: item.optionsTextSnapshot || '',
        note: item.note || '',
        addedBy: item.orderedByName || order.user?.fullName || 'Thu ngân',
        orderedAt: this.renderer.formatDateTime((item as any).createdAt || item.sentToKitchenAt || order.createdAt),
        taxPercent: item.product.taxPercentage || 0,
        taxAmount: (item.priceAtSale * (item.product.taxPercentage || 0)) / 100,
        selectedOptions: (item.selectedOptions || []).map((so) => ({
          nameAtSale: so.nameAtSale,
          priceAdjustmentAtSale: so.priceAdjustmentAtSale,
        })),
      };
    });

    // Thông tin thanh toán
    const latestPayment = order.payments[0];
    const cashReceived = latestPayment?.cashReceived || undefined;
    const cashChange = latestPayment?.cashChange || undefined;

    // Tra cứu phương thức chuyển khoản ngân hàng SePay/VietQR cho chi nhánh
    const transferMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        gatewayType: 'TRANSFER',
        isActive: true,
        OR: [
          { isAllBranches: true },
          { branches: { some: { id: order.branchId } } },
        ],
      },
      orderBy: { displayOrder: 'asc' },
    });

    const bankAccountNo = transferMethod?.accountNumber || 'SEPSUSHIWA';
    const bankAccountName = transferMethod?.accountName || 'AVORA RESTAURANT';
    const bankName = transferMethod?.bankCode || 'OCB';
    const displayCode = order.orderCode || order.temporaryOrderCode || order.id;
    const transferContent = displayCode;
    const paymentQrPayload = customQrPayload || `https://qr.sepay.vn/img?acc=${encodeURIComponent(bankAccountNo)}&bank=${encodeURIComponent(bankName)}&amount=${order.totalAmount}&des=${encodeURIComponent(transferContent)}`;

    // 1. Tên khách hàng / Khách lẻ / Tên khách thành viên
    const rawCustomerName = order.customerName || order.user?.fullName;
    let customerNameDisplay = 'Khách lẻ';
    if (rawCustomerName && rawCustomerName.trim().length > 0) {
      customerNameDisplay = rawCustomerName.trim();
      if (order.user?.membershipTier?.name) {
        customerNameDisplay += ` (${order.user.membershipTier.name})`;
      }
    }

    // 2. Chi tiết giảm giá
    const discountDetails: Array<{ label: string; amount: number; discountPercent?: number }> = [];
    if (order.discountVoucherCodeSnapshot || order.voucher?.code) {
      const code = order.discountVoucherCodeSnapshot || order.voucher?.code;
      const voucherAmount = order.discountAmount || 0;
      if (voucherAmount > 0) {
        discountDetails.push({
          label: `Voucher [${code}]`,
          amount: voucherAmount,
        });
      }
    } else if (order.discountReason && (order.discountAmount || 0) > 0) {
      // Nhận diện giảm giá từ hạng thành viên nếu có thông tin tier
      const memberDiscountPct = order.user?.membershipTier?.discountPercent;
      discountDetails.push({
        label: `${order.discountReason}`,
        amount: order.discountAmount,
        discountPercent: memberDiscountPct && memberDiscountPct > 0 ? memberDiscountPct : undefined,
      });
    }

    if ((order.shippingDiscount || 0) > 0) {
      const shipCode = order.shippingVoucherCodeSnapshot || order.shippingVoucher?.code;
      const label = shipCode ? `Giảm phí ship [${shipCode}]` : 'Giảm phí ship';
      discountDetails.push({
        label,
        amount: order.shippingDiscount,
      });
    }

    if (discountDetails.length === 0 && (order.discountAmount || 0) > 0) {
      const itemDiscounts = items.reduce((sum, it) => sum + (it.discountAmount || 0), 0);
      if (itemDiscounts > 0 && Math.abs(itemDiscounts - order.discountAmount) < 50) {
        discountDetails.push({
          label: 'Giảm giá món ăn',
          amount: itemDiscounts,
        });
      } else {
        discountDetails.push({
          label: 'Khuyến mãi',
          amount: order.discountAmount,
        });
      }
    }

    // 3. Chi tiết phụ phí
    const serviceChargeDetails: Array<{ name: string; amount: number }> = (order.serviceCharges || []).map((sc: any) => ({
      name: sc.name || 'Phụ thu',
      amount: sc.amount || 0,
    }));
    if (serviceChargeDetails.length === 0 && (order.serviceChargeTotal || 0) > 0) {
      serviceChargeDetails.push({
        name: 'Phụ thu',
        amount: order.serviceChargeTotal,
      });
    }

    // 4. Tỷ lệ % thuế VAT
    const nonZeroItems = order.orderItems.filter((i: any) => (i.taxPercentageAtSale || i.product?.taxPercentage || 0) > 0);
    let avgTaxPercent = 0;
    if (nonZeroItems.length > 0) {
      avgTaxPercent = Math.round(
        nonZeroItems.reduce((sum: number, i: any) => sum + (i.taxPercentageAtSale || i.product?.taxPercentage || 0), 0) / nonZeroItems.length,
      );
    } else if (order.taxAmount && order.subTotal > 0) {
      avgTaxPercent = Math.round((order.taxAmount / order.subTotal) * 100);
    }
    const vatPercentStr = avgTaxPercent > 0 ? `${avgTaxPercent}%` : '8%';

    return {
      storeName: 'AVORA RESTAURANT',
      branchName: order.branch.name,
      branchCode: order.branch.branchCode,
      branchAddress: `${order.branch.street || ''}, ${order.branch.ward || ''}, ${order.branch.district || ''}, ${order.branch.province || ''}`.replace(/^[\s,]+|[\s,]+$/g, ''),
      branchPhone: order.branch.phone || '',

      orderCode: displayCode,
      createdAt: order.createdAt,
      completedAt: order.deliveredAt || order.confirmedAt || order.updatedAt,
      tableName: order.table?.name || (order.orderType === 'DELIVERY' ? 'Giao hàng' : 'Mang về'),
      orderTypeStr: order.orderType === 'DELIVERY' ? 'Giao hàng' : order.orderType === 'TAKEAWAY' ? 'Mang đi' : 'Tại bàn',
      orderStatusStr: order.status,
      orderNote: order.note || '',
      cashierName: 'Thu ngân',
      guestCount: order.guestCount || 1,

      customerName: customerNameDisplay,
      customerPhone: order.customerPhone || order.user?.phone || '',
      memberCode: order.user?.memberCode || '',
      membershipTierName: order.user?.membershipTier?.name || '',
      currentPoints: order.user?.points || 0,
      pointsUsed: order.pointsUsed || 0,
      pointsAwarded: order.pointsAwarded || 0,

      deliveryAddress: order.deliveryAddress || '',
      shippingFee: order.shippingFee || 0,
      shippingDiscount: order.shippingDiscount || 0,

      items,

      subTotal: order.subTotal,
      discountAmount: (order.discountAmount || 0) + (order.shippingDiscount || 0),
      discountReason: order.discountReason || '',
      totalAmount: order.totalAmount,
      discountVoucherCode: order.discountVoucherCodeSnapshot || order.voucher?.code,
      shippingVoucherCode: order.shippingVoucherCodeSnapshot || order.shippingVoucher?.code,
      vatAmount: (order.taxAmount !== undefined && order.taxAmount !== null && order.taxAmount > 0)
        ? order.taxAmount
        : items.reduce((sum, it) => sum + (it.taxAmount || 0), 0),
      vatPriceMode: order.vatPriceModeSnapshot || (
        order.taxAmount && order.taxAmount > 0 && Math.abs((order.subTotal - (order.discountAmount || 0) + (order.serviceChargeTotal || 0) + order.taxAmount) - order.totalAmount) < 50
          ? 'VAT_EXCLUDED'
          : 'VAT_INCLUDED'
      ),
      serviceChargeTotal: order.serviceChargeTotal || 0,
      printedAt: new Date(),
      discountDetails,
      serviceChargeDetails,
      vatPercentStr,

      paymentMethodStr: latestPayment?.paymentMethod || order.paymentMethod || 'Chuyển khoản',
      paymentStatusStr: order.paymentStatus,
      transactionRef: latestPayment?.transactionRef || order.transactionId || '',
      paymentTime: latestPayment?.createdAt || order.updatedAt,
      cashReceived,
      cashChange,

      bankAccountNo,
      bankAccountName,
      bankName,
      transferContent,
      paymentQrPayload,

      taxCode: (order.isInvoiceRequested || order.invoiceTaxCode)
        ? (order.invoiceTaxCode || order.user?.taxCode || '')
        : '',
      companyName: (order.isInvoiceRequested || order.invoiceCompanyName)
        ? (order.invoiceCompanyName || order.user?.companyName || '')
        : '',
      companyAddress: (order.isInvoiceRequested || order.invoiceAddress)
        ? (order.invoiceAddress || order.user?.taxAddress || '')
        : '',
      invoiceEmail: (order.isInvoiceRequested || order.invoiceEmail)
        ? (order.invoiceEmail || order.user?.invoiceEmail || '')
        : '',

      websiteUrl: 'https://avora.vn',
      orderTrackUrl: `https://avora.vn/orders/${displayCode}`,
    };
  }

  /**
   * Khởi tạo 5 mẫu in mặc định cho chi nhánh
   */
  async seedDefaultTemplatesForBranch(branchId: string) {
    const types: PrintTemplateType[] = [
      PrintTemplateType.RECEIPT,
      PrintTemplateType.TEMP_BILL,
      PrintTemplateType.KITCHEN_TICKET,
      PrintTemplateType.ITEM_LABEL,
      PrintTemplateType.ONLINE_ORDER,
    ];

    for (const type of types) {
      const existing = await this.prisma.printTemplate.findFirst({
        where: { branchId, type },
      });

      if (!existing) {
        const seed = this.tagsService.getDefaultTemplateContent(type);
        const created = await this.prisma.printTemplate.create({
          data: {
            branchId,
            type,
            name: seed.name,
            content: seed.content,
            paperSize: seed.paperSize,
            isDefault: true,
            version: 1,
          },
        });

        await this.prisma.printTemplateVersion.create({
          data: {
            printTemplateId: created.id,
            version: 1,
            content: created.content,
            paperSize: created.paperSize,
            createdBy: 'System Seed',
          },
        });
      }
    }
  }

  /**
   * Helper ghi AuditLog
   */
  private async logAudit(
    userId: string | undefined,
    action: string,
    target: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    try {
      if (!userId) return;
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          target,
          oldValue,
          newValue,
        },
      });
    } catch (err) {
      this.logger.warn(`Không thể ghi AuditLog: ${err.message}`);
    }
  }
}
