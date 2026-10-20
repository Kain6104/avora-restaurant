import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { OrderService } from '../order/order.service';
import { OrderPricingService } from '../pricing/order-pricing.service';
import { ShippingFeeService } from '../shipping/shipping-fee.service';
import { OperatingSlotService } from '../operating-slot/operating-slot.service';
import { PaymentMethodService } from '../payment-method/payment-method.service';
import { ReservationSource } from '@prisma/client';
import {
  ChatSessionContext,
  ChatbotToolResult,
  ChatSessionCartItem,
  ChatCartSnapshot,
} from './dto/chatbot-tool.dto';
import {
  ChatbotToolArgsMap,
  ChatbotToolArgumentValidationError,
  ChatbotToolName,
  ValidatedChatbotToolCommand,
  isChatbotToolName,
  validateChatbotToolCommand,
} from './dto/chatbot-tool-args.dto';
import * as crypto from 'crypto';

@Injectable()
export class ChatbotToolEngineService {
  private readonly logger = new Logger(ChatbotToolEngineService.name);
  private static readonly CONFIRMATION_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ReservationService))
    private readonly reservationService: ReservationService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly orderPricingService: OrderPricingService,
    private readonly shippingFeeService: ShippingFeeService,
    private readonly operatingSlotService: OperatingSlotService,
    private readonly paymentMethodService: PaymentMethodService,
  ) {}

  private createConfirmation(payload: unknown) {
    const previewToken = crypto.randomBytes(32).toString('base64url');
    return {
      previewToken,
      state: {
        previewTokenHash: crypto.createHash('sha256').update(previewToken).digest('hex'),
        payloadHash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
        expiresAt: new Date(Date.now() + ChatbotToolEngineService.CONFIRMATION_TTL_MS).toISOString(),
        status: 'PREVIEWED' as const,
      },
    };
  }

  private requireConfirmation(
    state: ChatSessionContext['orderConfirmation'],
    payload: unknown,
  ): ChatbotToolResult | null {
    if (!state || state.status !== 'CONFIRMED') {
      return {
        success: false,
        code: 'CONFIRMATION_REQUIRED',
        message: 'Vui lòng xem trước và xác nhận giao dịch trước khi thực hiện.',
      };
    }
    if (new Date(state.expiresAt).getTime() <= Date.now()) {
      return {
        success: false,
        code: 'CONFIRMATION_EXPIRED',
        message: 'Xác nhận đã hết hạn. Vui lòng xem trước giao dịch lại.',
      };
    }
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    if (state.payloadHash !== payloadHash) {
      return {
        success: false,
        code: 'PREVIEW_STALE',
        message: 'Thông tin giao dịch đã thay đổi. Vui lòng xem trước lại.',
      };
    }
    return null;
  }

  private orderConfirmationPayload(ctx: ChatSessionContext) {
    return {
      branchId: ctx.currentBranchId,
      fulfillmentType: ctx.fulfillmentType,
      addressId: ctx.deliveryAddressId,
      operatingSlotId: ctx.operatingSlotId,
      deliveryDate: ctx.deliveryDate,
      paymentMethod: ctx.paymentMethod || 'COD',
      discountVoucherCode: ctx.discountVoucherCode,
      shippingVoucherCode: ctx.shippingVoucherCode,
      pointsToUse: ctx.pointsToUse || 0,
      expectedTotalAmount: ctx.expectedTotalAmount,
      cart: ctx.cart,
    };
  }

  private reservationConfirmationPayload(ctx: ChatSessionContext) {
    return ctx.reservationDraft || {};
  }

  private enforceToolPolicy(
    command: ValidatedChatbotToolCommand,
    userId?: string,
  ): ChatbotToolResult | null {
    const authenticatedOnly = new Set<ChatbotToolName>([
      'getUserAddresses',
      'saveAddress',
      'getMembershipStatus',
      'previewPointUsage',
    ]);

    if (authenticatedOnly.has(command.name) && !userId) {
      return {
        success: false,
        code: 'LOGIN_REQUIRED',
        message: 'Vui lòng đăng nhập để sử dụng tính năng này.',
        recoverable: true,
      };
    }

    if (command.name === 'checkOrder' && !userId && (!command.args.orderCode || !command.args.phone)) {
      return {
        success: false,
        code: 'GUEST_VERIFICATION_REQUIRED',
        message: 'Vui lòng cung cấp mã đơn hàng và số điện thoại đã dùng để đặt đơn.',
        recoverable: true,
      };
    }

    if (command.name === 'cancelOrder' && !userId && !command.args.phone) {
      return {
        success: false,
        code: 'GUEST_VERIFICATION_REQUIRED',
        message: 'Vui lòng cung cấp số điện thoại đã dùng để đặt đơn trước khi hủy.',
        recoverable: true,
      };
    }

    if (command.name === 'getMyReservations' && !userId && !command.args.phone) {
      return {
        success: false,
        code: 'GUEST_VERIFICATION_REQUIRED',
        message: 'Vui lòng đăng nhập hoặc cung cấp số điện thoại để xem đặt bàn.',
        recoverable: true,
      };
    }

    if (command.name === 'cancelReservation' && !userId && !command.args.phone) {
      return {
        success: false,
        code: 'GUEST_VERIFICATION_REQUIRED',
        message: 'Vui lòng đăng nhập hoặc cung cấp số điện thoại để hủy đặt bàn.',
        recoverable: true,
      };
    }

    return null;
  }

  // ==========================================
  // CONTEXT PERSISTENCE HELPERS
  // ==========================================

  private async loadSessionState(
    sessionId?: string,
  ): Promise<{ context: ChatSessionContext; version: number }> {
    if (!sessionId) {
      return { context: { cart: [], fulfillmentType: 'DELIVERY', cartVersion: 0 }, version: 0 };
    }
    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { contextData: true, version: true },
      });
      if (session?.contextData) {
        const context = JSON.parse(session.contextData) as ChatSessionContext;
        return {
          context: { ...context, cart: context.cart || [], cartVersion: context.cartVersion || 0 },
          version: session.version,
        };
      }
      if (session) {
        return {
          context: { cart: [], fulfillmentType: 'DELIVERY', cartVersion: 0 },
          version: session.version,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed to parse context for session ${sessionId}: ${err.message}`);
    }
    return { context: { cart: [], fulfillmentType: 'DELIVERY', cartVersion: 0 }, version: 0 };
  }

  async loadSessionContext(sessionId?: string): Promise<ChatSessionContext> {
    return (await this.loadSessionState(sessionId)).context;
  }

  async saveSessionContext(
    sessionId: string | undefined,
    ctx: ChatSessionContext,
    expectedVersion: number,
  ): Promise<boolean> {
    if (!sessionId) return true;
    const updateResult = await this.prisma.chatSession.updateMany({
      where: { id: sessionId, version: expectedVersion },
      data: {
        contextData: JSON.stringify(ctx),
        version: { increment: 1 },
      },
    });
    return updateResult.count === 1;
  }

  // ==========================================
  // MAIN TOOL EXECUTION DISPATCHER
  // ==========================================

  async executeTool(
    toolName: string,
    rawArgs: unknown,
    userIdOrContext?: string | ChatSessionContext,
    sessionId?: string,
    branchId?: string,
    providedCtx?: ChatSessionContext,
  ): Promise<ChatbotToolResult> {
    if (!isChatbotToolName(toolName)) {
      return {
        success: false,
        code: 'UNKNOWN_TOOL',
        message: `Công cụ [${toolName}] không tồn tại trong hệ thống.`,
      };
    }

    let command: ValidatedChatbotToolCommand;
    try {
      command = await validateChatbotToolCommand(toolName, rawArgs);
    } catch (error: unknown) {
      if (error instanceof ChatbotToolArgumentValidationError) {
        return {
          success: false,
          code: 'TOOL_ARGUMENTS_INVALID',
          message: 'Tham số công cụ không hợp lệ.',
          data: { fields: error.details },
          recoverable: true,
        };
      }
      throw error;
    }

    let ctx: ChatSessionContext;
    let userId: string | undefined;
    let actualSessionId = sessionId;
    let expectedContextVersion: number | null = null;

    if (userIdOrContext && typeof userIdOrContext === 'object') {
      ctx = userIdOrContext;
      userId = typeof sessionId === 'string' ? sessionId : undefined;
      actualSessionId = typeof branchId === 'string' ? branchId : undefined;
    } else {
      userId = userIdOrContext;
      if (providedCtx) {
        ctx = providedCtx;
      } else {
        const sessionState = await this.loadSessionState(actualSessionId);
        ctx = sessionState.context;
        expectedContextVersion = sessionState.version;
      }
    }

    if (!ctx.cart) ctx.cart = [];

    const policyError = this.enforceToolPolicy(command, userId);
    if (policyError) return policyError;

    this.logger.log(`Executing tool [${toolName}] for user=${userId || 'guest'}, session=${actualSessionId}`);

    if (branchId && typeof branchId === 'string' && !ctx.currentBranchId) {
      ctx.currentBranchId = branchId;
    }

    let result: ChatbotToolResult = {
      success: false,
      code: 'TOOL_NOT_DISPATCHED',
      message: 'Công cụ chưa được đăng ký trong dispatcher.',
    };

    try {
      switch (command.name) {
        // 1. Branches & Info
        case 'listBranches':
          result = await this.toolListBranches(command.args);
          break;
        case 'getBranchDetail':
          result = await this.toolGetBranchDetail(command.args);
          break;
        case 'findNearestBranch':
          result = await this.toolFindNearestBranch(command.args);
          break;

        // 2. Menu & Products
        case 'searchMenu':
          result = await this.toolSearchMenu(command.args, ctx);
          break;
        case 'getProductDetail':
          result = await this.toolGetProductDetail(command.args);
          break;
        case 'listCategories':
          result = await this.toolListCategories();
          break;

        // 3. Cart Management
        case 'addToCart':
          result = await this.toolAddToCart(command.args, ctx, userId);
          break;
        case 'updateCartItem':
          result = await this.toolUpdateCartItem(command.args, ctx);
          break;
        case 'getCart':
          result = await this.toolGetCart(ctx);
          break;
        case 'clearCart':
          result = await this.toolClearCart(ctx);
          break;

        // 4. Address & Delivery
        case 'getUserAddresses':
          result = await this.toolGetUserAddresses(userId);
          break;
        case 'validateDeliveryAddress':
          result = await this.toolValidateDeliveryAddress(command.args, ctx, userId);
          break;
        case 'saveAddress':
          result = await this.toolSaveAddress(command.args, userId);
          break;
        case 'getAvailableOrderSlots':
          result = await this.toolGetAvailableOrderSlots(command.args, ctx);
          break;

        // 5. Vouchers & Points
        case 'findApplicableVouchers':
          result = await this.toolFindApplicableVouchers(command.args, ctx, userId);
          break;
        case 'applyVoucher':
          result = await this.toolApplyVoucherCanonical(command.args, ctx, userId);
          break;
        case 'removeVoucher':
          result = await this.toolRemoveVoucher(command.args, ctx);
          break;
        case 'getMembershipStatus':
          result = await this.toolGetMembershipStatus(userId, ctx.currentBranchId);
          break;
        case 'previewPointUsage':
          result = await this.toolPreviewPointUsage(command.args, ctx, userId);
          break;

        // 6. Payment & Order Checkout
        case 'getPaymentMethods':
          result = await this.toolGetPaymentMethods(command.args, ctx);
          break;
        case 'previewOrder':
          result = await this.toolPreviewOrder(command.args, ctx, userId);
          break;
        case 'placeOrder':
          result = await this.toolPlaceOrder(command.args, ctx, userId);
          break;
        case 'checkOrder':
          result = await this.toolCheckOrder(command.args, userId);
          break;
        case 'cancelOrder':
          result = await this.toolCancelOrder(command.args, userId);
          break;

        // 7. Table Reservation
        case 'getReservationSlots':
          result = await this.toolGetReservationSlots(command.args);
          break;
        case 'previewReservation':
          result = await this.toolPreviewReservation(command.args, ctx, userId);
          break;
        case 'createReservation':
          result = await this.toolCreateReservation(command.args, ctx, userId);
          break;
        case 'getMyReservations':
          result = await this.toolGetMyReservations(command.args, userId);
          break;
        case 'cancelReservation':
          result = await this.toolCancelReservation(command.args, userId);
          break;

        // 8. Utility & UI actions
        case 'stopVoice':
          result = {
            success: true,
            code: 'STOP_VOICE',
            message: 'Đã dừng chế độ trò chuyện giọng nói.',
            actionType: 'STOP_VOICE',
          };
          break;
        case 'handoffToHuman':
          result = {
            success: true,
            code: 'HANDOFF_TO_HUMAN',
            message: 'Đang kết nối tới nhân viên tư vấn trực tiếp của nhà hàng.',
            actionType: 'HANDOFF_TO_HUMAN',
            actionPayload: JSON.stringify({ reason: command.args.reason }),
            content: 'Dạ, em đã chuyển thông tin tới bộ phận chăm sóc khách hàng. Chuyên viên của Avora sẽ liên hệ hỗ trợ anh/chị ngay nhé ạ!',
          };
          break;

      }
    } catch (error: any) {
      this.logger.error(`Error executing tool [${toolName}]: ${error.message}`, error.stack);
      result = {
        success: false,
        code: 'TOOL_EXECUTION_ERROR',
        message: error?.response?.message || error.message || 'Đã xảy ra lỗi khi xử lý yêu cầu.',
        recoverable: true,
      };
    }

    // Persist updated context
    if (actualSessionId && result.success) {
      const saved = await this.saveSessionContext(
        actualSessionId,
        ctx,
        expectedContextVersion ?? 0,
      );
      if (!saved) {
        return {
          success: false,
          code: 'CART_VERSION_CONFLICT',
          message: 'Giỏ hàng vừa được cập nhật ở một yêu cầu khác. Vui lòng tải lại giỏ hàng.',
          recoverable: true,
        };
      }
    }
    return result;
  }

  // =========================================================================
  // 1. CHI NHÁNH & VỊ TRÍ
  // =========================================================================

  private async toolListBranches(args: ChatbotToolArgsMap['listBranches']): Promise<ChatbotToolResult> {
    const where: any = {};
    if (args.reservationOnly) where.reservationEnabled = true;
    if (args.deliveryOnly) where.onlineOrderingEnabled = true;

    const branches = await this.prisma.branch.findMany({
      where,
      select: {
        id: true,
        name: true,
        branchCode: true,
        phone: true,
        street: true,
        ward: true,
        district: true,
        province: true,
        openTime: true,
        closeTime: true,
        reservationEnabled: true,
        onlineOrderingEnabled: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      code: 'BRANCH_LIST_LOADED',
      message: `Tìm thấy ${branches.length} chi nhánh hoạt động.`,
      data: { branches },
      content: `Nhà hàng Avora hiện có ${branches.length} chi nhánh đang hoạt động.`,
    };
  }

  private async toolGetBranchDetail(args: ChatbotToolArgsMap['getBranchDetail']): Promise<ChatbotToolResult> {
    let branch: any = null;
    if (args.branchId) {
      branch = await this.prisma.branch.findUnique({ where: { id: args.branchId } });
    } else if (args.branchName) {
      branch = await this.prisma.branch.findFirst({
        where: { name: { contains: args.branchName.trim() } },
      });
    }

    if (!branch) {
      return {
        success: false,
        code: 'BRANCH_NOT_FOUND',
        message: 'Không tìm thấy thông tin chi nhánh này.',
      };
    }

    return {
      success: true,
      code: 'BRANCH_DETAIL_LOADED',
      message: `Thông tin chi nhánh ${branch.name}`,
      data: { branch },
      content: `Chi nhánh ${branch.name}: ${branch.street}, ${branch.ward}, ${branch.province}. Giờ mở cửa: ${branch.openTime} - ${branch.closeTime}. SĐT: ${branch.phone}.`,
    };
  }

  private async toolFindNearestBranch(args: ChatbotToolArgsMap['findNearestBranch']): Promise<ChatbotToolResult> {
    const { latitude, longitude } = args;
    if (!latitude || !longitude) {
      return { success: false, code: 'INVALID_COORDINATES', message: 'Thiếu tọa độ GPS.' };
    }

    const branches = await this.prisma.branch.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
    });

    if (branches.length === 0) {
      return { success: false, code: 'NO_BRANCH_WITH_GPS', message: 'Chưa có chi nhánh nào cấu hình tọa độ GPS.' };
    }

    const withDist = branches.map((b) => {
      const dist = this.calculateHaversine(latitude, longitude, b.latitude!, b.longitude!);
      return { ...b, distanceKm: dist };
    });

    withDist.sort((a, b) => a.distanceKm - b.distanceKm);
    const top = withDist.slice(0, 3).map((b) => ({
      id: b.id,
      name: b.name,
      address: `${b.street || ''}, ${b.ward || ''}, ${b.province || ''}`.replace(/^, /, ''),
      distanceKm: Number(b.distanceKm.toFixed(2)),
      estimatedMinutes: Math.ceil(b.distanceKm * 2.5),
      phone: b.phone,
      openTime: b.openTime,
      closeTime: b.closeTime,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`,
    }));

    return {
      success: true,
      code: 'NEAREST_BRANCHES_FOUND',
      message: `Đã tìm thấy ${top.length} chi nhánh gần bạn nhất.`,
      data: { nearestBranches: top },
      actionType: 'SHOW_MAP_LINK',
      actionPayload: top[0]?.googleMapsUrl,
      content: `Chi nhánh gần bạn nhất là ${top[0].name} (cách khoảng ${top[0].distanceKm}km).`,
    };
  }

  private calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // =========================================================================
  // 2. THỰC ĐƠN & SẢN PHẨM (PRODUCT & OPTIONS)
  // =========================================================================

  private async toolSearchMenu(args: ChatbotToolArgsMap['searchMenu'], ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    const where: any = { available: true };
    const effectiveBranchId = args.branchId || ctx.currentBranchId;
    if (effectiveBranchId) {
      where.branches = { some: { id: effectiveBranchId } };
    }

    const q = args.query ? args.query.trim().toLowerCase() : '';
    const isHotQuery = ['bestseller', 'bán chạy', 'hot', 'nổi bật', 'gợi ý'].some((w) => q.includes(w));

    if (!isHotQuery && q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
      ];
    }

    if (args.budget && Number(args.budget) > 0) {
      where.price = { lte: Number(args.budget) };
    }

    if (args.category) {
      where.category = { name: { contains: args.category.trim() } };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true, slug: true } },
        optionGroups: {
          include: {
            optionItems: { where: { available: true }, orderBy: { displayOrder: 'asc' } },
          },
        },
        FlashSaleItem: {
          where: {
            flashSale: { status: 'ACTIVE', startTime: { lte: new Date() }, endTime: { gte: new Date() } },
          },
          include: { flashSale: true },
        },
      },
      take: 8,
    });

    const now = new Date();
    const formatted = products.map((p) => {
      const activeFs = p.FlashSaleItem?.find((fs) => {
        return fs.flashSale.startTime <= now && fs.flashSale.endTime >= now && fs.stock > fs.sold;
      });

      const requiredGroups = p.optionGroups
        .filter((g) => g.isRequired)
        .map((g) => ({
          name: g.name,
          choices: g.optionItems.map((i) => `${i.name} (+${i.priceAdjustment.toLocaleString('vi-VN')}đ)`),
        }));

      return {
        id: p.id,
        name: p.name,
        price: p.price,
        flashSalePrice: activeFs ? activeFs.flashSalePrice : null,
        isFlashSale: Boolean(activeFs),
        category: p.category?.name || 'Món',
        imageUrl: p.imageUrl,
        hasRequiredOptions: requiredGroups.length > 0,
        requiredOptionsNotice:
          requiredGroups.length > 0
            ? `Cần chọn: ${requiredGroups.map((rg) => `${rg.name} (${rg.choices.join(', ')})`).join('; ')}`
            : null,
      };
    });

    return {
      success: true,
      code: 'MENU_SEARCH_COMPLETED',
      message: `Tìm thấy ${formatted.length} món phù hợp.`,
      data: { products: formatted },
      actionType: 'SHOW_PRODUCT',
      actionPayload: JSON.stringify({ products: formatted }),
    };
  }

  private async toolGetProductDetail(args: ChatbotToolArgsMap['getProductDetail']): Promise<ChatbotToolResult> {
    let product: any = null;
    if (args.productId) {
      product = await this.prisma.product.findUnique({
        where: { id: args.productId },
        include: {
          category: true,
          optionGroups: {
            include: { optionItems: { where: { available: true }, orderBy: { displayOrder: 'asc' } } },
          },
          FlashSaleItem: {
            where: { flashSale: { status: 'ACTIVE' } },
            include: { flashSale: true },
          },
          branches: { select: { id: true } },
        },
      });
    } else if (args.productName) {
      product = await this.prisma.product.findFirst({
        where: { name: { contains: args.productName.trim() } },
        include: {
          category: true,
          optionGroups: {
            include: { optionItems: { where: { available: true }, orderBy: { displayOrder: 'asc' } } },
          },
          FlashSaleItem: {
            where: { flashSale: { status: 'ACTIVE' } },
            include: { flashSale: true },
          },
          branches: { select: { id: true } },
        },
      });
    }

    if (!product) {
      return { success: false, code: 'PRODUCT_NOT_FOUND', message: 'Không tìm thấy món ăn này trong thực đơn.' };
    }

    const now = new Date();
    const activeFs = product.FlashSaleItem?.find(
      (fs: any) => fs.flashSale.startTime <= now && fs.flashSale.endTime >= now && fs.stock > fs.sold,
    );

    const optionGroups = (product.optionGroups || []).map((og: any) => ({
      id: og.id,
      name: og.name,
      isRequired: og.isRequired,
      multipleChoice: og.multipleChoice,
      minSelect: og.minSelect,
      maxSelect: og.maxSelect,
      items: (og.optionItems || []).map((oi: any) => ({
        id: oi.id,
        name: oi.name,
        priceAdjustment: oi.priceAdjustment,
        isDefault: oi.isDefault,
      })),
    }));

    return {
      success: true,
      code: 'PRODUCT_DETAIL_LOADED',
      message: `Chi tiết món ${product.name}`,
      data: {
        product: {
          id: product.id,
          name: product.name,
          basePrice: product.price,
          flashSalePrice: activeFs ? activeFs.flashSalePrice : null,
          isFlashSale: Boolean(activeFs),
          description: product.description,
          imageUrl: product.imageUrl,
          optionGroups,
        },
      },
    };
  }

  private async toolListCategories(): Promise<ChatbotToolResult> {
    const categories = await this.prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return {
      success: true,
      code: 'CATEGORIES_LOADED',
      message: `Có ${categories.length} danh mục món ăn.`,
      data: { categories },
      content: `Danh mục thực đơn gồm: ${categories.map((c) => c.name).join(', ')}.`,
    };
  }

  // =========================================================================
  // 3. SERVER-SIDE CART (GIỎ HÀNG TRÊN SERVER)
  // =========================================================================

  private createCartSnapshot(ctx: ChatSessionContext): ChatCartSnapshot {
    const items = (ctx.cart || []).map((item) => ({
      ...item,
      selectedOptions: item.selectedOptions.map((option) => ({ ...option })),
    }));

    return {
      cartVersion: ctx.cartVersion || 0,
      currentBranchId: ctx.currentBranchId || null,
      items,
      subTotal: items.reduce((sum, item) => sum + item.priceAtSale * item.quantity, 0),
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  private cartResultData(ctx: ChatSessionContext): ChatCartSnapshot & { cart: ChatSessionCartItem[] } {
    const snapshot = this.createCartSnapshot(ctx);
    return { ...snapshot, cart: snapshot.items };
  }

  private async toolAddToCart(args: ChatbotToolArgsMap['addToCart'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    let product: any = null;
    if (args.productId) {
      product = await this.prisma.product.findUnique({
        where: { id: args.productId },
        include: {
          optionGroups: {
            include: { optionItems: { where: { available: true } } },
          },
          FlashSaleItem: {
            where: { flashSale: { status: 'ACTIVE' } },
            include: { flashSale: true },
          },
          branches: { select: { id: true } },
        },
      });
    } else if (args.productName) {
      product = await this.prisma.product.findFirst({
        where: { name: { contains: args.productName.trim() } },
        include: {
          optionGroups: {
            include: { optionItems: { where: { available: true } } },
          },
          FlashSaleItem: {
            where: { flashSale: { status: 'ACTIVE' } },
            include: { flashSale: true },
          },
          branches: { select: { id: true } },
        },
      });
    }

    if (!product) {
      return { success: false, code: 'PRODUCT_NOT_FOUND', message: 'Không tìm thấy món ăn này.' };
    }

    // 1. Kiểm tra Required Options
    const productBranchIds = (product.branches || []).map((branch: { id: string }) => branch.id);
    if (ctx.currentBranchId && productBranchIds.length > 0 && !productBranchIds.includes(ctx.currentBranchId)) {
      return {
        success: false,
        code: 'CART_BRANCH_CONFLICT',
        message: 'Món ăn không khả dụng tại chi nhánh của giỏ hàng hiện tại.',
        recoverable: true,
      };
    }
    if (!ctx.currentBranchId) {
      if (productBranchIds.length !== 1) {
        return {
          success: false,
          code: 'BRANCH_REQUIRED',
          message: 'Vui lòng chọn chi nhánh trước khi thêm món vào giỏ hàng.',
          recoverable: true,
        };
      }
      ctx.currentBranchId = productBranchIds[0];
    }

    const providedOptionIds = args.optionItemIds || [];
    const missingRequiredGroups: string[] = [];
    const validOptionIds = new Set<string>();

    for (const group of product.optionGroups || []) {
      const selectedCount = group.optionItems.filter((item: any) => {
        validOptionIds.add(item.id);
        return providedOptionIds.includes(item.id);
      }).length;
      const minimum = Math.max(group.isRequired ? 1 : 0, group.minSelect || 0);
      const maximum = group.multipleChoice ? Math.max(1, group.maxSelect || 1) : 1;

      if (selectedCount < minimum) {
        const choices = group.optionItems.map((item: any) => `${item.name} (+${item.priceAdjustment.toLocaleString('vi-VN')}đ)`).join(', ');
        missingRequiredGroups.push(`${group.name} (Tùy chọn: ${choices})`);
      }
      if (selectedCount > maximum) {
        return {
          success: false,
          code: 'OPTION_SELECTION_LIMIT_EXCEEDED',
          message: `Nhóm tùy chọn [${group.name}] chỉ cho phép chọn tối đa ${maximum} mục.`,
          recoverable: true,
        };
      }
    }

    const unknownOptionIds = providedOptionIds.filter((optionId) => !validOptionIds.has(optionId));
    if (unknownOptionIds.length > 0) {
      return {
        success: false,
        code: 'INVALID_PRODUCT_OPTIONS',
        message: 'Một hoặc nhiều tùy chọn không thuộc món ăn đã chọn.',
        data: { optionItemIds: unknownOptionIds },
        recoverable: true,
      };
    }

    if (missingRequiredGroups.length > 0) {
      return {
        success: false,
        code: 'REQUIRED_OPTIONS_MISSING',
        message: 'Món này có tùy chọn bắt buộc cần chọn.',
        data: { missingGroups: missingRequiredGroups, productId: product.id },
        content: `Món [${product.name}] cần bạn chọn thêm: ${missingRequiredGroups.join('; ')}. Bạn muốn chọn loại nào ạ?`,
      };
    }

    // 2. Tính toán giá món và options
    const now = new Date();
    const activeFs = product.FlashSaleItem?.find(
      (fs: any) => fs.flashSale.startTime <= now && fs.flashSale.endTime >= now && fs.stock > fs.sold,
    );

    const basePrice = activeFs ? activeFs.flashSalePrice : product.price;
    const selectedOptions: any[] = [];
    let optionsAdjustment = 0;

    for (const group of product.optionGroups || []) {
      for (const item of group.optionItems || []) {
        if (providedOptionIds.includes(item.id)) {
          optionsAdjustment += item.priceAdjustment;
          selectedOptions.push({
            optionGroupId: group.id,
            optionGroupName: group.name,
            optionItemId: item.id,
            optionItemName: item.name,
            priceAdjustment: item.priceAdjustment,
          });
        }
      }
    }

    const priceAtSale = basePrice + optionsAdjustment;
    const quantity = Math.max(1, Number(args.quantity) || 1);

    // 3. Quản lý Cart trong ctx
    if (!ctx.cart) ctx.cart = [];

    // Tạo khóa phân biệt dòng giỏ hàng (Line Identity)
    const optKey = selectedOptions.map((o) => o.optionItemId).sort().join('|');
    const existingIndex = ctx.cart.findIndex(
      (c) => c.productId === product.id && c.selectedOptions.map((o) => o.optionItemId).sort().join('|') === optKey && (c.note || '') === (args.note || ''),
    );

    if (existingIndex >= 0) {
      ctx.cart[existingIndex].quantity += quantity;
    } else {
      const lineId = crypto.randomUUID();
      const newLine: ChatSessionCartItem = {
        id: lineId,
        lineId,
        productId: product.id,
        productName: product.name,
        quantity,
        basePrice,
        priceAtSale,
        selectedOptions,
        note: args.note?.trim() || undefined,
        isFlashSale: Boolean(activeFs),
        flashSaleId: activeFs?.flashSaleId,
        imageUrl: product.imageUrl,
      };
      ctx.cart.push(newLine);
    }

    ctx.cartVersion = (ctx.cartVersion || 0) + 1;
    const snapshot = this.createCartSnapshot(ctx);

    return {
      success: true,
      code: 'CART_UPDATED',
      message: `Đã thêm ${quantity}x [${product.name}] vào giỏ hàng.`,
      data: this.cartResultData(ctx),
      actionType: 'ADD_TO_CART',
      actionPayload: JSON.stringify(snapshot),
      content: `Đã thêm ${quantity}x ${product.name} vào giỏ hàng. Hiện giỏ hàng của bạn có tổng tạm tính là ${snapshot.subTotal.toLocaleString('vi-VN')}đ.`,
    };
  }

  private async toolUpdateCartItem(args: ChatbotToolArgsMap['updateCartItem'], ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    if (!ctx.cart || ctx.cart.length === 0) {
      return { success: false, code: 'CART_EMPTY', message: 'Giỏ hàng đang trống.' };
    }

    let targetIndex = -1;
    targetIndex = ctx.cart.findIndex((item) => item.lineId === args.lineId || item.id === args.lineId);

    if (targetIndex === -1) {
      return { success: false, code: 'ITEM_NOT_IN_CART', message: 'Không tìm thấy món này trong giỏ hàng.' };
    }

    const target = ctx.cart[targetIndex];
    const newQty = Number(args.quantity);

    if (newQty <= 0) {
      ctx.cart.splice(targetIndex, 1);
    } else {
      target.quantity = newQty;
      if (args.note !== undefined) target.note = args.note.trim() || undefined;
    }

    ctx.cartVersion = (ctx.cartVersion || 0) + 1;
    const snapshot = this.createCartSnapshot(ctx);

    return {
      success: true,
      code: 'CART_UPDATED',
      message: newQty <= 0 ? `Đã xóa [${target.productName}] khỏi giỏ hàng.` : `Đã đổi số lượng [${target.productName}] thành ${newQty}.`,
      data: this.cartResultData(ctx),
      actionType: 'UPDATE_CART',
      actionPayload: JSON.stringify(snapshot),
    };
  }

  private async toolGetCart(ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    const cart = ctx.cart || [];
    const snapshot = this.createCartSnapshot(ctx);

    if (cart.length === 0) {
      return {
        success: true,
        code: 'CART_EMPTY',
        message: 'Giỏ hàng của bạn đang trống.',
        data: this.cartResultData(ctx),
        actionType: 'UPDATE_CART',
        actionPayload: JSON.stringify(snapshot),
        content: 'Giỏ hàng của bạn hiện đang trống. Bạn muốn tham khảo các món ngon đặc biệt của nhà hàng hôm nay không ạ?',
      };
    }

    const itemsSummary = cart
      .map((it) => {
        const optText = it.selectedOptions.length > 0 ? ` (${it.selectedOptions.map((o) => o.optionItemName).join(', ')})` : '';
        return `- ${it.quantity}x ${it.productName}${optText}: ${(it.priceAtSale * it.quantity).toLocaleString('vi-VN')}đ`;
      })
      .join('\n');

    return {
      success: true,
      code: 'CART_VIEW_READY',
      message: `Giỏ hàng có ${cart.length} món, tổng tạm tính: ${snapshot.subTotal.toLocaleString('vi-VN')}đ`,
      data: this.cartResultData(ctx),
      actionType: 'UPDATE_CART',
      actionPayload: JSON.stringify(snapshot),
      content: `Giỏ hàng của bạn hiện gồm:\n${itemsSummary}\nTổng tiền tạm tính: ${snapshot.subTotal.toLocaleString('vi-VN')}đ.`,
    };
  }

  private async toolClearCart(ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    ctx.cart = [];
    ctx.discountVoucherCode = undefined;
    ctx.shippingVoucherCode = undefined;
    ctx.pointsToUse = 0;
    ctx.cartVersion = (ctx.cartVersion || 0) + 1;
    const snapshot = this.createCartSnapshot(ctx);

    return {
      success: true,
      code: 'CART_CLEARED',
      message: 'Đã làm mới và xóa toàn bộ giỏ hàng.',
      data: this.cartResultData(ctx),
      actionType: 'CLEAR_CART',
      actionPayload: JSON.stringify(snapshot),
      content: 'Đã làm trống giỏ hàng. Bạn hãy thoải mái chọn món mới nhé!',
    };
  }

  // =========================================================================
  // 4. ĐỊA CHỈ & KHUNG GIỜ GIAO HÀNG (ADDRESS & SLOTS)
  // =========================================================================

  private async toolGetUserAddresses(userId?: string): Promise<ChatbotToolResult> {
    if (!userId) {
      return {
        success: false,
        code: 'LOGIN_REQUIRED',
        message: 'Vui lòng đăng nhập để xem danh sách địa chỉ đã lưu.',
      };
    }

    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    if (addresses.length === 0) {
      return {
        success: true,
        code: 'LOCATION_REQUIRED',
        message: 'Bạn chưa có địa chỉ giao hàng nào được lưu. Vui lòng chia sẻ vị trí để tiếp tục.',
        data: { addresses: [] },
        actionType: 'REQUEST_LOCATION',
        actionPayload: JSON.stringify({ reason: 'NO_SAVED_ADDRESS' }),
        suggestedReplies: ['📍 Chia sẻ vị trí hiện tại'],
        content: 'Bạn chưa có địa chỉ giao hàng trong sổ địa chỉ. Bạn vui lòng bấm nút **"📍 Chia sẻ vị trí hiện tại"** bên dưới để Avora tự động định vị địa chỉ và tính phí giao hàng chính xác nhất cho bạn nhé!',
      };
    }

    return {
      success: true,
      code: 'ADDRESSES_RETRIEVED',
      message: `Tìm thấy ${addresses.length} địa chỉ.`,
      data: { addresses },
      suggestedReplies: [
        `Dùng: ${addresses[0].streetDetail}`,
        '📍 Chia sẻ vị trí mới',
      ],
      content: `Địa chỉ giao hàng mặc định của bạn: ${addresses[0].streetDetail}, ${addresses[0].ward}, ${addresses[0].province} (Người nhận: ${addresses[0].recipientName} - SĐT: ${addresses[0].phone}). Bạn có muốn dùng địa chỉ này hay chọn vị trí mới ạ?`,
    };
  }

  private async reverseGeocode(lat: number, lng: number): Promise<{ streetDetail: string; ward: string; province: string; fullAddress: string }> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1&accept-language=vi`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AvoraRestaurantApp/1.0 (contact@avorarestaurant.vn)',
        },
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const houseNumber = addr.house_number || '';
        const road = addr.road || addr.street || addr.pedestrian || addr.suburb || '';
        const streetDetail = [houseNumber, road].filter(Boolean).join(' ') || road || 'Vị trí hiện tại';
        const ward = addr.quarter || addr.suburb || addr.neighbourhood || addr.village || addr.ward || '';
        const district = addr.city_district || addr.district || addr.county || '';
        const province = addr.city || addr.state || addr.province || 'Hồ Chí Minh';

        const fullParts = [streetDetail, ward, district, province].filter(Boolean);
        const fullAddress = data.display_name || fullParts.join(', ');
        return {
          streetDetail: streetDetail || fullAddress,
          ward: ward || district || '',
          province: province || 'Hồ Chí Minh',
          fullAddress: fullAddress,
        };
      }
    } catch (err) {
      this.logger.warn(`Reverse geocoding failed for ${lat},${lng}: ${(err as Error).message}`);
    }
    return {
      streetDetail: `Tọa độ (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      ward: '',
      province: 'Hồ Chí Minh',
      fullAddress: `Tọa độ (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    };
  }

  private async toolValidateDeliveryAddress(args: ChatbotToolArgsMap['validateDeliveryAddress'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    let address: any = null;
    if (args.addressId) {
      address = await this.prisma.address.findFirst({
        where: { id: args.addressId, ...(userId ? { userId } : {}) },
      });
    }

    let lat = args.latitude;
    let lng = args.longitude;

    if (!address && (lat !== undefined && lng !== undefined)) {
      // Reverse geocode from coordinates
      const geo = await this.reverseGeocode(lat, lng);
      address = {
        streetDetail: geo.streetDetail,
        ward: geo.ward,
        province: geo.province,
        latitude: lat,
        longitude: lng,
        fullAddress: geo.fullAddress,
      };

      // Auto-save address for authenticated user if not existing
      if (userId) {
        try {
          const user = await this.prisma.user.findUnique({ where: { id: userId } });
          const saved = await this.prisma.address.create({
            data: {
              userId,
              recipientName: user?.fullName || 'Khách hàng',
              phone: user?.phone || '0900000000',
              streetDetail: geo.streetDetail,
              ward: geo.ward || '',
              province: geo.province || 'Hồ Chí Minh',
              latitude: lat,
              longitude: lng,
              isDefault: false,
            },
          });
          address.id = saved.id;
        } catch (e) {
          this.logger.warn(`Could not auto-save reverse geocoded address: ${(e as Error).message}`);
        }
      }
    } else if (!address && args.streetDetail) {
      address = {
        streetDetail: args.streetDetail,
        ward: args.ward || '',
        province: args.province || 'Hồ Chí Minh',
        latitude: lat,
        longitude: lng,
      };
    }

    if (!address) {
      return {
        success: false,
        code: 'ADDRESS_NOT_FOUND',
        actionType: 'REQUEST_LOCATION',
        actionPayload: JSON.stringify({ reason: 'ADDRESS_NOT_FOUND' }),
        suggestedReplies: ['📍 Chia sẻ vị trí hiện tại'],
        message: 'Không tìm thấy địa chỉ này. Vui lòng bấm nút chia sẻ vị trí để tiếp tục.',
        content: 'Avora chưa xác định được địa chỉ của bạn. Bạn vui lòng bấm nút **"📍 Chia sẻ vị trí hiện tại"** bên dưới để hệ thống tự động định vị và tính phí giao hàng chính xác nhé!',
      };
    }

    const effectiveBranchId = args.branchId || ctx.currentBranchId;
    const branch = effectiveBranchId
      ? await this.prisma.branch.findUnique({ where: { id: effectiveBranchId } })
      : await this.prisma.branch.findFirst({ where: { onlineOrderingEnabled: true } });

    if (!branch) {
      return { success: false, code: 'BRANCH_NOT_FOUND', message: 'Không xác định được chi nhánh giao hàng.' };
    }

    ctx.currentBranchId = branch.id;
    if (address.id) ctx.deliveryAddressId = address.id;
    ctx.deliveryAddressSummary = address.fullAddress || `${address.streetDetail}, ${address.ward}, ${address.province}`.replace(/^, /, '');

    // Tính toán khoảng cách & phí ship
    const subTotal = (ctx.cart || []).reduce((s, i) => s + i.priceAtSale * i.quantity, 0);
    const quote = await this.shippingFeeService.getShippingQuote({
      branchId: branch.id,
      addressId: address.id,
      destinationLat: address.latitude,
      destinationLng: address.longitude,
      subTotal: subTotal,
    });

    if (!quote.deliveryAvailable) {
      return {
        success: false,
        code: 'OUTSIDE_DELIVERY_RADIUS',
        message: quote.unavailabilityReason || 'Địa chỉ nằm ngoài bán kính giao hàng của chi nhánh.',
        data: { quote, branchName: branch.name, addressSummary: ctx.deliveryAddressSummary },
        suggestedReplies: ['Đặt mang về (Takeaway)', 'Chọn chi nhánh khác'],
        content: `Rất tiếc, địa chỉ này nằm ngoài phạm vi giao hàng của ${branch.name} (khoảng cách: ${quote.distanceKm}km, tối đa cho phép: 15km). Bạn có muốn chọn hình thức Đặt mang về (Takeaway) hoặc đổi chi nhánh khác không ạ?`,
      };
    }

    return {
      success: true,
      code: 'DELIVERY_ADDRESS_VALID',
      message: `Địa chỉ hợp lệ. Khoảng cách: ${quote.distanceKm}km, Phí ship: ${quote.finalShippingFee.toLocaleString('vi-VN')}đ`,
      data: {
        quote,
        addressId: address.id,
        addressSummary: ctx.deliveryAddressSummary,
        branchName: branch.name,
      },
      content: `Đã xác nhận địa chỉ: **${ctx.deliveryAddressSummary}**.\nKhoảng cách đến chi nhánh ${branch.name}: **${quote.distanceKm}km**, phí giao hàng: **${quote.finalShippingFee.toLocaleString('vi-VN')}đ**.`,
    };
  }

  private parseTimeToMinutes(timeStr: string): number | null {
    if (!timeStr) return null;
    const clean = timeStr.toLowerCase().trim();
    const isPm = clean.includes('tối') || clean.includes('chiều') || clean.includes('pm');
    const match = clean.match(/(\d{1,2})(?::|h| giờ |g)?\s*(\d{1,2})?/);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    if (isNaN(hours) || isNaN(minutes)) return null;
    if (isPm && hours < 12) hours += 12;
    return hours * 60 + minutes;
  }

  private matchClosestSlot(requestedTime: string, slots: any[]): any | null {
    const reqMin = this.parseTimeToMinutes(requestedTime);
    if (reqMin === null || slots.length === 0) return null;

    let bestSlot = null;
    let minDiff = Infinity;

    for (const slot of slots) {
      const [startH, startM] = slot.startTime.split(':').map(Number);
      const [endH, endM] = slot.endTime.split(':').map(Number);
      const startMin = startH * 60 + (startM || 0);
      const endMin = endH * 60 + (endM || 0);

      if (reqMin >= startMin && reqMin <= endMin) {
        return slot;
      }

      const diff = Math.min(Math.abs(reqMin - startMin), Math.abs(reqMin - endMin));
      if (diff < minDiff) {
        minDiff = diff;
        bestSlot = slot;
      }
    }

    return bestSlot;
  }

  private async toolSaveAddress(args: ChatbotToolArgsMap['saveAddress'], userId?: string): Promise<ChatbotToolResult> {
    if (!userId) {
      return { success: false, code: 'LOGIN_REQUIRED', message: 'Vui lòng đăng nhập để lưu địa chỉ giao hàng.' };
    }

    const newAddr = await this.prisma.address.create({
      data: {
        userId,
        recipientName: args.recipientName,
        phone: args.phone,
        streetDetail: args.streetDetail,
        ward: args.ward,
        province: args.province,
        latitude: args.latitude,
        longitude: args.longitude,
        isDefault: false,
      },
    });

    return {
      success: true,
      code: 'ADDRESS_SAVED',
      message: 'Đã lưu địa chỉ thành công.',
      data: { addressId: newAddr.id, address: newAddr },
      content: `Đã lưu địa chỉ mới: ${newAddr.streetDetail}, ${newAddr.ward}, ${newAddr.province} (Người nhận: ${newAddr.recipientName} - SĐT: ${newAddr.phone}).`,
    };
  }

  private async toolGetAvailableOrderSlots(args: ChatbotToolArgsMap['getAvailableOrderSlots'], ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    const effectiveBranchId = args.branchId || ctx.currentBranchId;
    if (!effectiveBranchId) {
      return { success: false, code: 'BRANCH_REQUIRED', message: 'Vui lòng chọn chi nhánh trước khi lấy khung giờ.' };
    }

    const branch = await this.prisma.branch.findUnique({ where: { id: effectiveBranchId } });
    const dateStr = args.date || new Date().toISOString().split('T')[0];
    const orderType = args.orderType === 'TAKE_AWAY' || args.orderType === 'TAKEAWAY' ? 'TAKEAWAY' : 'DELIVERY';

    const slots = await this.operatingSlotService.getSlotsForDate({
      branchId: effectiveBranchId,
      dateStr,
      orderType: orderType as any,
    });

    const openSlots = slots.filter((s) => s.isAvailable);

    const targetSlots = openSlots.length > 0 ? openSlots : slots;

    // If customer specified a concrete time (e.g. "11h45", "12h", "19:30")
    if (args.requestedTime && targetSlots.length > 0) {
      const matched = this.matchClosestSlot(args.requestedTime, targetSlots);
      if (matched) {
        ctx.operatingSlotId = matched.id;
        ctx.deliveryDate = dateStr;
        ctx.scheduledTime = `${matched.startTime} - ${matched.endTime}`;

        return {
          success: true,
          code: 'ORDER_SLOT_SELECTED',
          message: `Đã tự động chọn khung giờ ${matched.startTime} - ${matched.endTime} phù hợp nhất cho thời gian "${args.requestedTime}".`,
          data: {
            selectedSlot: matched,
            slots: targetSlots,
            date: dateStr,
            orderType,
            branchName: branch?.name,
          },
          actionType: 'SELECT_ORDER_SLOT',
          actionPayload: JSON.stringify({
            selectedSlot: matched,
            slots: targetSlots,
            date: dateStr,
            orderType,
            branchId: effectiveBranchId,
            branchName: branch?.name,
          }),
          suggestedReplies: [
            `Xác nhận: ${matched.startTime} - ${matched.endTime}`,
            '⚡ Giao ngay (ASAP)',
            'Chọn khung giờ khác',
          ],
          content: `Hệ thống đã tự động chọn khung giờ **${matched.startTime} - ${matched.endTime}** (phù hợp nhất với yêu cầu *${args.requestedTime}* của bạn) để giao hàng. Bạn có muốn điều chỉnh khung giờ nào khác không ạ?`,
        };
      }
    }

    return {
      success: true,
      code: 'ORDER_SLOTS_RETRIEVED',
      message: `Tìm thấy ${openSlots.length} khung giờ khả dụng cho ngày ${dateStr}.`,
      data: { slots: openSlots, date: dateStr, orderType, branchName: branch?.name },
      actionType: 'SELECT_ORDER_SLOT',
      actionPayload: JSON.stringify({
        slots: openSlots,
        date: dateStr,
        orderType,
        branchId: effectiveBranchId,
        branchName: branch?.name,
      }),
      suggestedReplies: [
        '⚡ Giao ngay (ASAP)',
        ...openSlots.slice(0, 3).map((s) => `Khung giờ ${s.startTime} - ${s.endTime}`),
      ],
      content: `Dạ nhà hàng có các khung giờ nhận đơn trong ngày ${dateStr}. Bạn có thể chọn nhanh khung giờ phù hợp trên màn hình hoặc báo giờ bạn muốn nhận nhé!`,
    };
  }

  // =========================================================================
  // 5. VOUCHER & ĐIỂM THÀNH VIÊN
  // =========================================================================

  private async toolFindApplicableVouchers(args: ChatbotToolArgsMap['findApplicableVouchers'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    const now = new Date();
    const pricingItems = (ctx.cart || []).map((item) => ({
      productId: item.productId,
      name: item.productName,
      priceAtSale: item.priceAtSale,
      originalPriceAtSale: item.basePrice,
      quantity: item.quantity,
    }));
    const basePricing = await this.orderPricingService.calculatePricing({ items: pricingItems });
    const cartTotal = basePricing.subTotal;
    const branchId = args.branchId || ctx.currentBranchId;

    let user: any = null;
    if (userId) {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { membershipTier: true },
      });
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: { membershipTiers: true },
    });

    const foodVouchers: any[] = [];
    const shippingVouchers: any[] = [];

    for (const v of vouchers) {
      const isUsageOk = v.usageLimit === null || v.usedCount < v.usageLimit;
      const isMinOk = v.minOrderValue <= cartTotal;
      const isTierOk = !v.membershipTiers || v.membershipTiers.length === 0 || (user && v.membershipTiers.some((t: any) => t.id === user.membershipTierId));
      const eligibility = await this.orderService.validateVoucherForChatbot({
        code: v.code,
        subTotal: cartTotal,
        shippingFee: 0,
        branchId,
        userId,
        isShippingVoucher: v.discountType === 'FREE_SHIP',
      });

      const vInfo = {
        code: v.code,
        title: v.title,
        discountType: v.discountType,
        discountValue: v.discountValue,
        minOrderValue: v.minOrderValue,
        isEligible: eligibility.isValid && isUsageOk && isMinOk && isTierOk,
        reason: !isMinOk ? `Cần thêm ${(v.minOrderValue - cartTotal).toLocaleString('vi-VN')}đ` : !isTierOk ? 'Chưa đủ hạng thẻ' : null,
      };

      if (v.discountType === 'FREE_SHIP') {
        shippingVouchers.push(vInfo);
      } else {
        foodVouchers.push(vInfo);
      }
    }

    return {
      success: true,
      code: 'VOUCHERS_FOUND',
      message: `Tìm thấy ${foodVouchers.length} voucher món và ${shippingVouchers.length} voucher freeship.`,
      data: { foodVouchers, shippingVouchers, cartTotal },
      actionType: 'SHOW_VOUCHERS',
      actionPayload: JSON.stringify({ foodVouchers, shippingVouchers }),
    };
  }

  private async toolApplyVoucher(args: ChatbotToolArgsMap['applyVoucher'], ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    const applied: string[] = [];
    const now = new Date();
    const cartTotal = (ctx.cart || []).reduce((s, i) => s + i.priceAtSale * i.quantity, 0);

    if (args.discountVoucherCode) {
      const code = args.discountVoucherCode.trim().toUpperCase();
      const v = await this.prisma.voucher.findFirst({
        where: { code, isActive: true, startDate: { lte: now }, endDate: { gte: now } },
      });
      if (!v || v.discountType === 'FREE_SHIP') {
        return { success: false, code: 'VOUCHER_INVALID', message: `Mã giảm giá món [${code}] không hợp lệ hoặc đã hết hạn.` };
      }
      if (v.minOrderValue > cartTotal) {
        return { success: false, code: 'VOUCHER_MIN_NOT_MET', message: `Mã [${code}] yêu cầu đơn tối thiểu ${v.minOrderValue.toLocaleString('vi-VN')}đ.` };
      }
      ctx.discountVoucherCode = code;
      applied.push(`Mã món: ${code}`);
    }

    if (args.shippingVoucherCode) {
      const sCode = args.shippingVoucherCode.trim().toUpperCase();
      const sv = await this.prisma.voucher.findFirst({
        where: { code: sCode, isActive: true, startDate: { lte: now }, endDate: { gte: now } },
      });
      if (!sv || sv.discountType !== 'FREE_SHIP') {
        return { success: false, code: 'SHIPPING_VOUCHER_INVALID', message: `Mã freeship [${sCode}] không hợp lệ hoặc đã hết hạn.` };
      }
      ctx.shippingVoucherCode = sCode;
      applied.push(`Mã ship: ${sCode}`);
    }

    return {
      success: true,
      code: 'VOUCHER_APPLIED',
      message: `Đã áp dụng thành công: ${applied.join(' & ')}`,
      data: {
        discountVoucherCode: ctx.discountVoucherCode,
        shippingVoucherCode: ctx.shippingVoucherCode,
      },
      content: `Đã áp dụng thành công: ${applied.join(' và ')}. Hãy xem bảng tính tiền mới nhé!`,
    };
  }

  private async toolApplyVoucherCanonical(
    args: ChatbotToolArgsMap['applyVoucher'],
    ctx: ChatSessionContext,
    userId?: string,
  ): Promise<ChatbotToolResult> {
    const discountCode = args.discountVoucherCode?.trim().toUpperCase();
    const shippingCode = args.shippingVoucherCode?.trim().toUpperCase();
    const pricingItems = (ctx.cart || []).map((item) => ({
      productId: item.productId,
      name: item.productName,
      priceAtSale: item.priceAtSale,
      originalPriceAtSale: item.basePrice,
      quantity: item.quantity,
    }));
    const basePricing = await this.orderPricingService.calculatePricing({ items: pricingItems });

    if (discountCode && shippingCode && discountCode === shippingCode) {
      return {
        success: false,
        code: 'VOUCHER_CODES_MUST_DIFFER',
        message: 'Mã giảm giá món và mã freeship không được trùng nhau.',
      };
    }

    const discountValidation = discountCode
      ? await this.orderService.validateVoucherForChatbot({
          code: discountCode,
          subTotal: basePricing.subTotal,
          shippingFee: 0,
          branchId: ctx.currentBranchId,
          userId,
          isShippingVoucher: false,
        })
      : null;
    if (discountValidation && !discountValidation.isValid) {
      return {
        success: false,
        code: 'VOUCHER_INVALID',
        message: discountValidation.reason || `Mã [${discountCode}] không hợp lệ.`,
      };
    }

    const shippingValidation = shippingCode
      ? await this.orderService.validateVoucherForChatbot({
          code: shippingCode,
          subTotal: basePricing.subTotal,
          shippingFee: 0,
          branchId: ctx.currentBranchId,
          userId,
          isShippingVoucher: true,
        })
      : null;
    if (shippingValidation && !shippingValidation.isValid) {
      return {
        success: false,
        code: 'SHIPPING_VOUCHER_INVALID',
        message: shippingValidation.reason || `Mã freeship [${shippingCode}] không hợp lệ.`,
      };
    }

    ctx.discountVoucherCode = discountCode;
    ctx.shippingVoucherCode = shippingCode;
    const applied = [
      discountCode ? `Mã món: ${discountCode}` : null,
      shippingCode ? `Mã ship: ${shippingCode}` : null,
    ].filter((value): value is string => Boolean(value));

    return {
      success: true,
      code: 'VOUCHER_APPLIED',
      message: applied.length > 0 ? `Đã áp dụng thành công: ${applied.join(' & ')}` : 'Đã cập nhật mã ưu đãi.',
      data: {
        discountVoucherCode: ctx.discountVoucherCode,
        shippingVoucherCode: ctx.shippingVoucherCode,
      },
      content: `${applied.length > 0 ? `Đã áp dụng thành công: ${applied.join(' và ')}` : 'Đã cập nhật mã ưu đãi.'} Hãy xem bảng tính tiền mới nhé!`,
    };
  }

  private async toolRemoveVoucher(args: ChatbotToolArgsMap['removeVoucher'], ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    if (args.removeDiscountVoucher) ctx.discountVoucherCode = undefined;
    if (args.removeShippingVoucher) ctx.shippingVoucherCode = undefined;
    if (!args.removeDiscountVoucher && !args.removeShippingVoucher) {
      ctx.discountVoucherCode = undefined;
      ctx.shippingVoucherCode = undefined;
    }

    return {
      success: true,
      code: 'VOUCHER_REMOVED',
      message: 'Đã gỡ bỏ mã giảm giá.',
      data: { discountVoucherCode: ctx.discountVoucherCode, shippingVoucherCode: ctx.shippingVoucherCode },
    };
  }

  private async toolGetMembershipStatus(userId?: string, branchId?: string): Promise<ChatbotToolResult> {
    if (!userId) {
      return { success: false, code: 'LOGIN_REQUIRED', message: 'Vui lòng đăng nhập để xem điểm thưởng và hạng thẻ.' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { membershipTier: true },
    });

    if (!user) return { success: false, code: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản.' };

    const branch = branchId ? await this.prisma.branch.findUnique({ where: { id: branchId } }) : null;
    const rate = branch?.pointRedeemRate || 1000;

    return {
      success: true,
      code: 'MEMBERSHIP_STATUS_LOADED',
      message: `Hạng: ${user.membershipTier?.name || 'Thành viên'}, Điểm: ${user.currentPoints}`,
      data: {
        tierName: user.membershipTier?.name || 'Thành viên',
        currentPoints: user.currentPoints,
        totalSpending: user.totalSpending,
        pointRedeemRate: rate,
        equivalentVnd: user.currentPoints * rate,
      },
      content: `Bạn hiện có ${user.currentPoints} điểm tích lũy (tương đương ${(user.currentPoints * rate).toLocaleString('vi-VN')}đ) thuộc hạng ${user.membershipTier?.name || 'Thành viên'}.`,
    };
  }

  private async toolPreviewPointUsage(args: ChatbotToolArgsMap['previewPointUsage'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    if (!userId) return { success: false, code: 'LOGIN_REQUIRED', message: 'Vui lòng đăng nhập để tiêu điểm.' };

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, code: 'USER_NOT_FOUND', message: 'Tài khoản không tồn tại.' };

    const points = Math.max(0, Math.floor(Number(args.pointsToUse) || 0));
    if (points > user.currentPoints) {
      return {
        success: false,
        code: 'INSUFFICIENT_POINTS',
        message: `Số dư điểm không đủ. Bạn hiện chỉ có ${user.currentPoints} điểm.`,
      };
    }

    const branch = ctx.currentBranchId ? await this.prisma.branch.findUnique({ where: { id: ctx.currentBranchId } }) : null;
    const rate = branch?.pointRedeemRate || 1000;
    const discountVnd = points * rate;

    ctx.pointsToUse = points;

    return {
      success: true,
      code: 'POINTS_APPLIED',
      message: `Đã chọn sử dụng ${points} điểm (giảm ${discountVnd.toLocaleString('vi-VN')}đ).`,
      data: { pointsToUse: points, discountVnd },
      content: `Đã áp dụng trừ ${points} điểm (giảm được ${discountVnd.toLocaleString('vi-VN')}đ vào đơn hàng).`,
    };
  }

  // =========================================================================
  // 6. THANH TOÁN & ORDER PREVIEW & CHECKOUT
  // =========================================================================

  private async toolGetPaymentMethods(args: ChatbotToolArgsMap['getPaymentMethods'], ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    const effectiveBranchId = args.branchId || ctx.currentBranchId;
    const subTotal = (ctx.cart || []).reduce((s, i) => s + i.priceAtSale * i.quantity, 0);

    const methods = await this.paymentMethodService.getActiveMethods(subTotal, effectiveBranchId);

    return {
      success: true,
      code: 'PAYMENT_METHODS_LOADED',
      message: `Tìm thấy ${methods.length} phương thức thanh toán.`,
      data: { paymentMethods: methods },
      content: `Các phương thức thanh toán hỗ trợ: ${methods.map((m) => m.name).join(', ')}. Bạn muốn thanh toán theo hình thức nào ạ?`,
    };
  }

  private async toolPreviewOrder(args: ChatbotToolArgsMap['previewOrder'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    if (!ctx.cart || ctx.cart.length === 0) {
      return { success: false, code: 'CART_EMPTY', message: 'Giỏ hàng đang trống. Vui lòng chọn món trước khi xem trước đơn hàng.' };
    }

    // Merge parameters
    if (args.fulfillmentType) ctx.fulfillmentType = args.fulfillmentType;
    if (args.addressId) ctx.deliveryAddressId = args.addressId;
    if (args.operatingSlotId) ctx.operatingSlotId = args.operatingSlotId;
    if (args.deliveryDate) ctx.deliveryDate = args.deliveryDate;
    if (args.discountVoucherCode) ctx.discountVoucherCode = args.discountVoucherCode;
    if (args.shippingVoucherCode) ctx.shippingVoucherCode = args.shippingVoucherCode;
    if (args.pointsToUse !== undefined) ctx.pointsToUse = args.pointsToUse;
    if (args.paymentMethod) ctx.paymentMethod = args.paymentMethod;

    const fulfillmentType = ctx.fulfillmentType || 'DELIVERY';

    // Xử lý địa chỉ nếu là DELIVERY
    let address: any = null;
    if (fulfillmentType === 'DELIVERY') {
      if (ctx.deliveryAddressId) {
        address = await this.prisma.address.findFirst({
          where: { id: ctx.deliveryAddressId, ...(userId ? { userId } : {}) },
        });
      }
      if (!address && userId) {
        address =
          (await this.prisma.address.findFirst({ where: { userId, isDefault: true } })) ||
          (await this.prisma.address.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }));
        if (address) ctx.deliveryAddressId = address.id;
      }
      if (!address && !ctx.deliveryAddressSummary) {
        return {
          success: false,
          code: 'ADDRESS_REQUIRED',
          actionType: 'REQUEST_LOCATION',
          actionPayload: JSON.stringify({ reason: 'ADDRESS_REQUIRED' }),
          suggestedReplies: ['📍 Chia sẻ vị trí hiện tại'],
          message: 'Vui lòng cung cấp địa chỉ nhận hàng trước khi xem trước đơn giao hàng.',
          content: 'Bạn ơi, đơn hàng giao tận nơi cần có địa chỉ nhận hàng. Bạn vui lòng bấm nút **"📍 Chia sẻ vị trí hiện tại"** bên dưới để Avora tự động tính phí ship nhé!',
        };
      }
      if (address && !ctx.deliveryAddressSummary) {
        ctx.deliveryAddressSummary = `${address.streetDetail}, ${address.ward}, ${address.province}`.replace(/^, /, '');
      }
    }

    // Auto-fill customer info from user profile if not yet set
    if (userId && (!ctx.customerName || !ctx.customerPhone)) {
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          if (!ctx.customerName && user.fullName) ctx.customerName = user.fullName;
          if (!ctx.customerPhone && user.phone) ctx.customerPhone = user.phone;
        }
      } catch (e) {
        this.logger.warn(`Failed to auto-fill user details in previewOrder: ${(e as Error).message}`);
      }
    }

    // Xử lý chi nhánh
    const branch = ctx.currentBranchId
      ? await this.prisma.branch.findUnique({ where: { id: ctx.currentBranchId } })
      : await this.prisma.branch.findFirst({ where: { onlineOrderingEnabled: true } });

    if (!branch) return { success: false, code: 'BRANCH_REQUIRED', message: 'Không tìm thấy chi nhánh phục vụ.' };
    ctx.currentBranchId = branch.id;

    // Xử lý khung giờ giao hàng (Operating Slot)
    if (!ctx.operatingSlotId) {
      const todayStr = new Date().toISOString().split('T')[0];
      const isTakeaway = fulfillmentType === 'TAKE_AWAY' || fulfillmentType === 'TAKEAWAY';
      const slotType = isTakeaway ? ('TAKEAWAY' as any) : ('DELIVERY' as any);
      const slots = await this.operatingSlotService.getSlotsForDate({
        branchId: branch.id,
        dateStr: todayStr,
        orderType: slotType,
      });
      let openSlot = slots.find((s) => s.isAvailable);
      let chosenDate = todayStr;

      if (!openSlot) {
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const tomorrowSlots = await this.operatingSlotService.getSlotsForDate({
          branchId: branch.id,
          dateStr: tomorrowStr,
          orderType: slotType,
        });
        openSlot = tomorrowSlots.find((s) => s.isAvailable);
        if (openSlot) {
          chosenDate = tomorrowStr;
        }
      }

      if (openSlot) {
        ctx.operatingSlotId = openSlot.id;
        ctx.deliveryDate = chosenDate;
        ctx.deliverySlotTime = `${openSlot.startTime} - ${openSlot.endTime}`;
      } else {
        ctx.deliveryDate = todayStr;
        ctx.deliverySlotTime = 'ASAP';
      }
    }

    // Tính phí vận chuyển nếu là DELIVERY
    let shippingFee = 0;
    let shippingDiscount = 0;
    if (fulfillmentType === 'DELIVERY' && address) {
      const subTotal = ctx.cart.reduce((s, i) => s + i.priceAtSale * i.quantity, 0);
      const quote = await this.shippingFeeService.getShippingQuote({
        branchId: branch.id,
        addressId: address.id,
        destinationLat: address.latitude,
        destinationLng: address.longitude,
        subTotal: subTotal,
      });
      shippingFee = quote.originalShippingFee;
      shippingDiscount = quote.shippingDiscount;
    }

    // Chuẩn bị tính toán qua OrderPricingService
    const pricingItems = ctx.cart.map((item) => ({
      productId: item.productId,
      name: item.productName,
      priceAtSale: item.priceAtSale,
      originalPriceAtSale: item.basePrice,
      quantity: item.quantity,
    }));

    ctx.discountVoucherCode = ctx.discountVoucherCode?.trim().toUpperCase();
    ctx.shippingVoucherCode = ctx.shippingVoucherCode?.trim().toUpperCase();
    if (
      ctx.discountVoucherCode &&
      ctx.shippingVoucherCode &&
      ctx.discountVoucherCode === ctx.shippingVoucherCode
    ) {
      return {
        success: false,
        code: 'VOUCHER_CODES_MUST_DIFFER',
        message: 'Mã giảm giá món và mã freeship không được trùng nhau.',
      };
    }

    const basePricing = await this.orderPricingService.calculatePricing({ items: pricingItems });
    let orderDiscountAmount = 0;
    if (ctx.discountVoucherCode) {
      const validation = await this.orderService.validateVoucherForChatbot({
        code: ctx.discountVoucherCode,
        subTotal: basePricing.subTotal,
        shippingFee,
        branchId: branch.id,
        userId,
        isShippingVoucher: false,
      });
      if (!validation.isValid) {
        return {
          success: false,
          code: 'VOUCHER_INVALID',
          message: validation.reason || `Mã [${ctx.discountVoucherCode}] không hợp lệ.`,
        };
      }
      orderDiscountAmount = validation.discount;
    }

    if (ctx.shippingVoucherCode) {
      const validation = await this.orderService.validateVoucherForChatbot({
        code: ctx.shippingVoucherCode,
        subTotal: basePricing.subTotal,
        shippingFee,
        branchId: branch.id,
        userId,
        isShippingVoucher: true,
      });
      if (!validation.isValid) {
        return {
          success: false,
          code: 'SHIPPING_VOUCHER_INVALID',
          message: validation.reason || `Mã freeship [${ctx.shippingVoucherCode}] không hợp lệ.`,
        };
      }
      shippingDiscount = Math.max(shippingDiscount, validation.discount);
    }

    const pricing = await this.orderPricingService.calculatePricing({
      items: pricingItems,
      orderDiscountAmount,
      shippingFee,
      shippingDiscount,
      pointsDiscount: (ctx.pointsToUse || 0) * (branch.pointRedeemRate || 1000),
    });

    const previewData = {
      items: ctx.cart,
      subTotal: pricing.subTotal,
      discountAmount: pricing.discountAmount,
      shippingFee: pricing.shippingFeeFinal,
      pointsDiscount: pricing.pointsDiscount,
      taxAmount: pricing.taxAmount,
      totalAmount: pricing.totalAmount,
      branchName: branch.name,
      fulfillmentType,
      deliveryAddress: address ? `${address.streetDetail}, ${address.ward}, ${address.province}` : null,
      deliverySlotTime: ctx.deliverySlotTime || 'Giao sớm nhất',
      paymentMethod: ctx.paymentMethod || 'COD',
      discountVoucherCode: ctx.discountVoucherCode,
      shippingVoucherCode: ctx.shippingVoucherCode,
    };
    ctx.expectedTotalAmount = pricing.totalAmount;
    const confirmation = this.createConfirmation(this.orderConfirmationPayload(ctx));
    ctx.orderConfirmation = confirmation.state;
    ctx.lastIdempotencyKey = crypto.randomUUID();

    return {
      success: true,
      code: 'ORDER_PREVIEW_READY',
      message: `Bản xem trước đơn hàng: Tổng thanh toán ${pricing.totalAmount.toLocaleString('vi-VN')}đ`,
      data: previewData,
      actionType: 'ORDER_PREVIEW',
      actionPayload: JSON.stringify({ ...previewData, previewToken: confirmation.previewToken }),
      content: `Đơn hàng của bạn gồm ${ctx.cart.length} món, tổng thanh toán là ${pricing.totalAmount.toLocaleString('vi-VN')}đ (đã gồm VAT và phí ship). Bạn có muốn xác nhận đặt đơn hàng này với phương thức thanh toán [${ctx.paymentMethod || 'COD'}] không ạ?`,
      suggestedReplies: ['Xác nhận đặt đơn', 'Đổi phương thức thanh toán', 'Thêm món khác'],
      requiresConfirmation: true,
    };
  }

  private async toolPlaceOrder(args: ChatbotToolArgsMap['placeOrder'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    const confirmationError = this.requireConfirmation(
      ctx.orderConfirmation,
      this.orderConfirmationPayload(ctx),
    );
    if (confirmationError) return confirmationError;

    if (!ctx.cart || ctx.cart.length === 0) {
      return { success: false, code: 'CART_EMPTY', message: 'Giỏ hàng đang trống, không thể tạo đơn.' };
    }

    if (!ctx.operatingSlotId || !ctx.deliveryDate) {
      return { success: false, code: 'SLOT_REQUIRED', message: 'Chưa có khung giờ giao hàng. Vui lòng gọi previewOrder trước.' };
    }

    const branchId = ctx.currentBranchId || (await this.prisma.branch.findFirst({ where: { onlineOrderingEnabled: true } }))?.id;
    if (!branchId) return { success: false, code: 'BRANCH_REQUIRED', message: 'Thiếu thông tin chi nhánh.' };

    const paymentMethod = ctx.paymentMethod || 'COD';
    const idempotencyKey = ctx.lastIdempotencyKey!;

    // Chuẩn bị payload chuẩn cho OrderService.createOrder
    const payload = {
      branchId,
      addressId: ctx.deliveryAddressId,
      cartItems: ctx.cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        optionItemIds: item.selectedOptions.map((o) => o.optionItemId),
        note: item.note,
        isFlashSaleItem: item.isFlashSale,
        flashSaleId: item.flashSaleId,
      })),
      note: args.note || 'Đặt qua Trợ lý AI Avora',
      paymentMethod,
      voucherCode: ctx.discountVoucherCode,
      shippingVoucherCode: ctx.shippingVoucherCode,
      pointsUsed: ctx.pointsToUse || 0,
      operatingSlotId: ctx.operatingSlotId,
      deliveryDate: ctx.deliveryDate,
      orderType: ctx.fulfillmentType || 'DELIVERY',
      idempotencyKey,
      expectedTotalAmount: ctx.expectedTotalAmount,
    };

    // Gọi atomic createOrder từ OrderService
    const orderResult = await this.orderService.createOrder(userId || 'guest-user', payload);
    const createdOrder = await this.prisma.order.findUnique({
      where: { id: orderResult.orderId },
    });
    const orderTotal = createdOrder?.totalAmount || 0;
    const orderStatus = createdOrder?.status || 'PENDING';
    const finalOrderCode = createdOrder?.orderCode || orderResult.orderCode;

    // Xóa cart trong session sau khi đã đặt thành công
    ctx.cart = [];
    ctx.discountVoucherCode = undefined;
    ctx.shippingVoucherCode = undefined;
    ctx.pointsToUse = 0;
    ctx.orderConfirmation!.status = 'COMMITTED';

    return {
      success: true,
      code: 'ORDER_PLACED_SUCCESS',
      message: `Đặt hàng thành công! Mã đơn hàng của bạn là [${finalOrderCode}].`,
      data: {
        orderCode: finalOrderCode,
        totalAmount: orderTotal,
        status: orderStatus,
        paymentMethod,
      },
      actionType: 'SHOW_ORDER_SUCCESS',
      actionPayload: JSON.stringify({
        orderCode: finalOrderCode,
        totalAmount: orderTotal,
      }),
      content: `Chúc mừng bạn! Đơn hàng [${finalOrderCode}] với tổng tiền ${orderTotal.toLocaleString('vi-VN')}đ đã được tạo thành công. Nhà hàng sẽ chuẩn bị và giao món đúng khung giờ cho bạn nhé!`,
    };
  }

  private async toolCheckOrder(args: ChatbotToolArgsMap['checkOrder'], userId?: string): Promise<ChatbotToolResult> {
    let order: any = null;
    if (!userId && (!args.orderCode || !args.phone)) {
      return {
        success: false,
        code: 'GUEST_VERIFICATION_REQUIRED',
        message: 'Vui lòng cung cấp mã đơn hàng và số điện thoại đã dùng để đặt đơn.',
        recoverable: true,
      };
    }

    if (args.orderCode) {
      order = await this.prisma.order.findFirst({
        where: {
          orderCode: args.orderCode.trim(),
          ...(userId ? { userId } : {}),
        },
        select: {
          orderCode: true,
          customerPhone: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
        },
      });
      if (!userId) {
        const normalizedOrderPhone = (order?.customerPhone || '').replace(/[.\s-]/g, '');
        if (normalizedOrderPhone !== args.phone) order = null;
      }
    } else if (userId) {
      order = await this.prisma.order.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          orderCode: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
        },
      });
    }

    if (!order) {
      return { success: false, code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy thông tin đơn hàng.' };
    }

    return {
      success: true,
      code: 'ORDER_FOUND',
      message: `Đơn [${order.orderCode}] trạng thái: ${order.status}`,
      data: {
        order: {
          orderCode: order.orderCode,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
        },
      },
      content: `Đơn hàng ${order.orderCode} của bạn hiện có trạng thái: ${order.status}. Tổng thanh toán: ${order.totalAmount.toLocaleString('vi-VN')}đ.`,
    };
  }

  private async toolCancelOrder(args: ChatbotToolArgsMap['cancelOrder'], userId?: string): Promise<ChatbotToolResult> {
    if (!args.orderCode) return { success: false, code: 'ORDER_CODE_REQUIRED', message: 'Vui lòng cung cấp mã đơn hàng.' };

    if (!userId && !args.phone) {
      return {
        success: false,
        code: 'GUEST_VERIFICATION_REQUIRED',
        message: 'Vui lòng cung cấp số điện thoại đã dùng để đặt đơn trước khi hủy.',
        recoverable: true,
      };
    }

    const canceled = await this.orderService.cancelOrder(
      args.orderCode,
      args.reason,
      userId
        ? { kind: 'USER', userId }
        : { kind: 'GUEST', phone: args.phone! },
    );

    return {
      success: true,
      code: 'ORDER_CANCELED',
      message: `Đã hủy đơn hàng [${args.orderCode}] thành công.`,
      data: { canceled },
      content: `Đơn hàng [${args.orderCode}] đã được hủy thành công theo yêu cầu của bạn.`,
    };
  }

  // =========================================================================
  // 7. ĐẶT BÀN (TABLE RESERVATION)
  // =========================================================================

  private async toolGetReservationSlots(args: ChatbotToolArgsMap['getReservationSlots']): Promise<ChatbotToolResult> {
    const { branchId, date, partySize = 2 } = args;
    if (!branchId || !date) {
      return { success: false, code: 'PARAMS_MISSING', message: 'Vui lòng cung cấp branchId và ngày cần đặt (YYYY-MM-DD).' };
    }

    const availability = await this.reservationService.getAvailability({
      branchId,
      date,
      partySize: Number(partySize),
    });

    const openSlots = (availability.slots || [])
      .filter((s: any) => s.status === 'AVAILABLE' || s.status === 'LIMITED')
      .map((s: any) => s.time);

    return {
      success: true,
      code: 'RESERVATION_SLOTS_LOADED',
      message: `Ngày ${date} tại ${availability.branchName} có ${openSlots.length} khung giờ còn trống.`,
      data: {
        branchName: availability.branchName,
        date: availability.date,
        slots: openSlots,
        availableSlots: openSlots,
      },
      content: `Tại ${availability.branchName} ngày ${date} cho ${partySize} khách, các khung giờ còn nhận bàn gồm: ${openSlots.slice(0, 8).join(', ')}. Quý khách muốn đặt khung giờ nào ạ?`,
    };
  }

  private async toolPreviewReservation(args: ChatbotToolArgsMap['previewReservation'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    const effectiveBranchId = args.branchId || ctx.reservationDraft?.branchId || ctx.currentBranchId;
    const effectiveDate = args.reservationDate || ctx.reservationDraft?.reservationDate;
    const effectiveTime = args.reservationTime || ctx.reservationDraft?.reservationTime;
    const effectiveParty = args.partySize || ctx.reservationDraft?.partySize;
    const effectiveName = args.customerName || ctx.reservationDraft?.customerName;
    const effectivePhone = args.customerPhone || ctx.reservationDraft?.customerPhone;

    const missingFields: string[] = [];
    if (!effectiveBranchId) missingFields.push('branch');
    if (!effectiveDate) missingFields.push('reservationDate');
    if (!effectiveTime) missingFields.push('reservationTime');
    if (!effectiveParty) missingFields.push('partySize');
    if (!effectiveName) missingFields.push('customerName');
    if (!effectivePhone) missingFields.push('customerPhone');

    if (missingFields.length > 0) {
      return {
        success: false,
        code: 'MISSING_RESERVATION_FIELDS',
        message: `Còn thiếu thông tin: ${missingFields.join(', ')}`,
        data: { missingFields },
      };
    }

    const branch = await this.prisma.branch.findUnique({ where: { id: effectiveBranchId } });
    if (!branch) return { success: false, code: 'BRANCH_NOT_FOUND', message: 'Chi nhánh không tồn tại.' };

    ctx.reservationDraft = {
      branchId: effectiveBranchId,
      branchName: branch.name,
      reservationDate: effectiveDate,
      reservationTime: effectiveTime,
      partySize: Number(effectiveParty),
      customerName: effectiveName,
      customerPhone: effectivePhone,
      customerEmail: args.customerEmail,
      seatingPreference: args.seatingPreference,
      specialRequests: args.specialRequests,
      summaryConfirmed: false,
    };

    const summary = {
      branchName: branch.name,
      reservationDate: effectiveDate,
      reservationTime: effectiveTime,
      partySize: Number(effectiveParty),
      customerName: effectiveName,
      customerPhone: effectivePhone,
      seatingPreference: args.seatingPreference || 'Mặc định',
      specialRequests: args.specialRequests || 'Không có',
    };

    const confirmation = this.createConfirmation(this.reservationConfirmationPayload(ctx));
    ctx.reservationConfirmation = confirmation.state;
    ctx.lastIdempotencyKey = crypto.randomUUID();

    return {
      success: true,
      code: 'RESERVATION_PREVIEW_READY',
      message: 'Bảng xác nhận đặt bàn đã sẵn sàng.',
      data: summary,
      actionType: 'CONFIRM_RESERVATION',
      actionPayload: JSON.stringify({ ...summary, previewToken: confirmation.previewToken }),
      content: `THÔNG TIN ĐẶT BÀN:\n- Chi nhánh: ${branch.name}\n- Thời gian: ${effectiveTime} ngày ${effectiveDate}\n- Số lượng: ${effectiveParty} khách\n- Người đặt: ${effectiveName} (${effectivePhone})\n${args.seatingPreference ? `- Vị trí ưu tiên: ${args.seatingPreference}\n` : ''}Quý khách có xác nhận thông tin đặt bàn này không ạ?`,
      suggestedReplies: ['Xác nhận đặt bàn', 'Đổi lại giờ khác', 'Hủy yêu cầu'],
      requiresConfirmation: true,
    };
  }

  private async toolCreateReservation(args: ChatbotToolArgsMap['createReservation'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    const confirmationError = this.requireConfirmation(
      ctx.reservationConfirmation,
      this.reservationConfirmationPayload(ctx),
    );
    if (confirmationError) return confirmationError;

    const idempotencyKey = ctx.lastIdempotencyKey!;

    if (idempotencyKey) {
      const existing = await this.prisma.reservation.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          success: true,
          code: 'RESERVATION_PLACED_SUCCESS',
          message: `Đặt bàn đã được xác nhận trước đó với mã [${existing.reservationCode}].`,
          data: {
            reservationId: existing.id,
            reservationCode: existing.reservationCode,
            startAt: existing.startAt,
            partySize: existing.partySize,
          },
          actionType: 'CONFIRM_RESERVATION',
          actionPayload: JSON.stringify({ reservationCode: existing.reservationCode }),
          content: `Đặt bàn [${existing.reservationCode}] của quý khách đã được ghi nhận trước đó!`,
        };
      }
    }

    const draft = ctx.reservationDraft || {};
    const branchId = draft.branchId;
    const reservationDate = draft.reservationDate;
    const reservationTime = draft.reservationTime;
    const partySize = Number(draft.partySize);
    const customerName = draft.customerName;
    const customerPhone = draft.customerPhone;

    if (!branchId || !reservationDate || !reservationTime || !partySize || !customerName || !customerPhone) {
      return { success: false, code: 'MISSING_RESERVATION_INFO', message: 'Thiếu thông tin bắt buộc để tạo đặt bàn.' };
    }

    const created = await this.reservationService.createReservation(
      {
        branchId,
        reservationDate,
        reservationTime,
        partySize,
        customerName,
        customerPhone,
        customerEmail: draft.customerEmail,
        seatingPreference: draft.seatingPreference,
        specialRequests: draft.specialRequests,
        source: ReservationSource.CHATBOT,
        idempotencyKey,
      },
      userId,
      'USER',
    );

    // Xóa draft sau khi đã tạo thành công
    ctx.reservationDraft = undefined;
    ctx.reservationConfirmation!.status = 'COMMITTED';

    return {
      success: true,
      code: 'RESERVATION_PLACED_SUCCESS',
      message: `Đặt bàn thành công! Mã đặt bàn của quý khách là [${created.reservationCode}].`,
      data: {
        reservationId: created.id,
        reservationCode: created.reservationCode,
        startAt: created.startAt,
        partySize: created.partySize,
      },
      actionType: 'CONFIRM_RESERVATION',
      actionPayload: JSON.stringify({ reservationCode: created.reservationCode }),
      content: `Quý khách đã đặt bàn thành công! Mã đặt bàn là [${created.reservationCode}] lúc ${reservationTime} ngày ${reservationDate}. Avora rất hân hạnh được đón tiếp quý khách!`,
    };
  }

  private async toolGetMyReservations(args: ChatbotToolArgsMap['getMyReservations'], userId?: string): Promise<ChatbotToolResult> {
    let reservations: any[] = [];
    if (userId) {
      const resData = await this.reservationService.getCustomerReservations(userId, 1, 5);
      reservations = resData.data || [];
    } else if (args.phone) {
      reservations = await this.prisma.reservation.findMany({
        where: { customerPhone: args.phone.trim(), status: { not: 'CANCELLED' } },
        include: { branch: { select: { name: true, phone: true } } },
        orderBy: { startAt: 'desc' },
        take: 5,
      });
    }

    return {
      success: true,
      code: 'RESERVATIONS_LOADED',
      message: `Tìm thấy ${reservations.length} lịch đặt bàn.`,
      data: { reservations },
      content:
        reservations.length > 0
          ? `Bạn có ${reservations.length} lịch đặt bàn gần nhất: ${reservations.map((r) => `Mã [${r.reservationCode}] vào lúc ${r.reservationTime} ngày ${r.reservationDate}`).join('; ')}.`
          : 'Bạn hiện chưa có lịch đặt bàn nào sắp tới.',
    };
  }

  private async toolCancelReservation(args: ChatbotToolArgsMap['cancelReservation'], userId?: string): Promise<ChatbotToolResult> {
    const { reservationCode, phone, reason } = args;
    if (!reservationCode || !phone) {
      return { success: false, code: 'CODE_PHONE_REQUIRED', message: 'Vui lòng cung cấp mã đặt bàn và số điện thoại.' };
    }

    await this.reservationService.customerCancelReservation(reservationCode.trim(), userId, phone.trim(), reason);

    return {
      success: true,
      code: 'RESERVATION_CANCELED',
      message: `Đã hủy đặt bàn [${reservationCode}] thành công.`,
      content: `Lịch đặt bàn [${reservationCode}] của bạn đã được hủy thành công. Hy vọng được phục vụ bạn vào dịp khác nhé!`,
    };
  }
}
