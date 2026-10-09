import { Injectable, Logger, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { OrderService } from '../order/order.service';
import { OrderPricingService } from '../pricing/order-pricing.service';
import { ShippingFeeService } from '../shipping/shipping-fee.service';
import { OperatingSlotService } from '../operating-slot/operating-slot.service';
import { PaymentMethodService } from '../payment-method/payment-method.service';
import { ReservationSource, OrderSource } from '@prisma/client';
import {
  ChatSessionContext,
  ChatbotToolResult,
  ChatSessionCartItem,
} from './dto/chatbot-tool.dto';
import * as crypto from 'crypto';

@Injectable()
export class ChatbotToolEngineService {
  private readonly logger = new Logger(ChatbotToolEngineService.name);

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

  // ==========================================
  // CONTEXT PERSISTENCE HELPERS
  // ==========================================

  async loadSessionContext(sessionId?: string): Promise<ChatSessionContext> {
    if (!sessionId) {
      return { cart: [], fulfillmentType: 'DELIVERY' };
    }
    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { contextData: true },
      });
      if (session?.contextData) {
        return JSON.parse(session.contextData);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to parse context for session ${sessionId}: ${err.message}`);
    }
    return { cart: [], fulfillmentType: 'DELIVERY' };
  }

  async saveSessionContext(sessionId: string | undefined, ctx: ChatSessionContext): Promise<void> {
    if (!sessionId) return;
    try {
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { contextData: JSON.stringify(ctx) },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to save context for session ${sessionId}: ${err.message}`);
    }
  }

  // ==========================================
  // MAIN TOOL EXECUTION DISPATCHER
  // ==========================================

  async executeTool(
    toolName: string,
    args: any,
    userIdOrContext?: string | ChatSessionContext,
    sessionId?: string,
    branchId?: string,
    providedCtx?: ChatSessionContext,
  ): Promise<ChatbotToolResult> {
    let ctx: ChatSessionContext;
    let userId: string | undefined;
    let actualSessionId = sessionId;

    if (userIdOrContext && typeof userIdOrContext === 'object') {
      ctx = userIdOrContext as ChatSessionContext;
      userId = typeof sessionId === 'string' ? sessionId : undefined;
      actualSessionId = typeof branchId === 'string' ? branchId : undefined;
    } else {
      userId = userIdOrContext;
      if (providedCtx) {
        ctx = providedCtx;
      } else {
        ctx = await this.loadSessionContext(actualSessionId);
      }
    }

    if (!ctx.cart) ctx.cart = [];

    this.logger.log(`Executing tool [${toolName}] for user=${userId || 'guest'}, session=${actualSessionId}`);

    if (branchId && typeof branchId === 'string' && !ctx.currentBranchId) {
      ctx.currentBranchId = branchId;
    }

    let result: ChatbotToolResult;

    try {
      switch (toolName) {
        // 1. Branches & Info
        case 'listBranches':
          result = await this.toolListBranches(args);
          break;
        case 'getBranchDetail':
          result = await this.toolGetBranchDetail(args);
          break;
        case 'findNearestBranch':
          result = await this.toolFindNearestBranch(args);
          break;

        // 2. Menu & Products
        case 'searchMenu':
          result = await this.toolSearchMenu(args, ctx);
          break;
        case 'getProductDetail':
          result = await this.toolGetProductDetail(args);
          break;
        case 'listCategories':
          result = await this.toolListCategories();
          break;

        // 3. Cart Management
        case 'addToCart':
          result = await this.toolAddToCart(args, ctx, userId);
          break;
        case 'updateCartItem':
          result = await this.toolUpdateCartItem(args, ctx);
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
          result = await this.toolValidateDeliveryAddress(args, ctx, userId);
          break;
        case 'saveAddress':
          result = await this.toolSaveAddress(args, userId);
          break;
        case 'getAvailableOrderSlots':
          result = await this.toolGetAvailableOrderSlots(args, ctx);
          break;

        // 5. Vouchers & Points
        case 'findApplicableVouchers':
          result = await this.toolFindApplicableVouchers(args, ctx, userId);
          break;
        case 'applyVoucher':
          result = await this.toolApplyVoucher(args, ctx);
          break;
        case 'removeVoucher':
          result = await this.toolRemoveVoucher(args, ctx);
          break;
        case 'getMembershipStatus':
          result = await this.toolGetMembershipStatus(userId, ctx.currentBranchId);
          break;
        case 'previewPointUsage':
          result = await this.toolPreviewPointUsage(args, ctx, userId);
          break;

        // 6. Payment & Order Checkout
        case 'getPaymentMethods':
          result = await this.toolGetPaymentMethods(args, ctx);
          break;
        case 'previewOrder':
          result = await this.toolPreviewOrder(args, ctx, userId);
          break;
        case 'placeOrder':
          result = await this.toolPlaceOrder(args, ctx, userId);
          break;
        case 'checkOrder':
          result = await this.toolCheckOrder(args, userId);
          break;
        case 'cancelOrder':
          result = await this.toolCancelOrder(args, userId);
          break;

        // 7. Table Reservation
        case 'getReservationSlots':
          result = await this.toolGetReservationSlots(args);
          break;
        case 'previewReservation':
          result = await this.toolPreviewReservation(args, ctx, userId);
          break;
        case 'createReservation':
        case 'placeReservation':
          result = await this.toolCreateReservation(args, ctx, userId);
          break;
        case 'getMyReservations':
          result = await this.toolGetMyReservations(args, userId);
          break;
        case 'cancelReservation':
          result = await this.toolCancelReservation(args, userId);
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
            actionPayload: JSON.stringify({ reason: args.reason || 'Khách yêu cầu hỗ trợ' }),
            content: 'Dạ, em đã chuyển thông tin tới bộ phận chăm sóc khách hàng. Chuyên viên của Avora sẽ liên hệ hỗ trợ anh/chị ngay nhé ạ!',
          };
          break;

        default:
          result = {
            success: false,
            code: 'UNKNOWN_TOOL',
            message: `Công cụ [${toolName}] không tồn tại trong hệ thống.`,
          };
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
    if (actualSessionId) {
      await this.saveSessionContext(actualSessionId, ctx);
    }
    return result;
  }

  // =========================================================================
  // 1. CHI NHÁNH & VỊ TRÍ
  // =========================================================================

  private async toolListBranches(args: any): Promise<ChatbotToolResult> {
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

  private async toolGetBranchDetail(args: any): Promise<ChatbotToolResult> {
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

  private async toolFindNearestBranch(args: any): Promise<ChatbotToolResult> {
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

  private async toolSearchMenu(args: any, ctx: ChatSessionContext): Promise<ChatbotToolResult> {
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

  private async toolGetProductDetail(args: any): Promise<ChatbotToolResult> {
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

  private async toolAddToCart(args: any, ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
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
        },
      });
    }

    if (!product) {
      return { success: false, code: 'PRODUCT_NOT_FOUND', message: 'Không tìm thấy món ăn này.' };
    }

    // 1. Kiểm tra Required Options
    const rawOptions = args.optionItemIds || args.options || [];
    const providedOptionIds: string[] = Array.isArray(rawOptions)
      ? rawOptions.map((o: any) => (typeof o === 'string' ? o : o.optionItemId || o.id))
      : [];
    const missingRequiredGroups: string[] = [];

    for (const group of product.optionGroups || []) {
      if (group.isRequired) {
        const hasChoice = group.optionItems.some((oi: any) => providedOptionIds.includes(oi.id));
        if (!hasChoice) {
          const choices = group.optionItems.map((i: any) => `${i.name} (+${i.priceAdjustment.toLocaleString('vi-VN')}đ)`).join(', ');
          missingRequiredGroups.push(`${group.name} (Tùy chọn: ${choices})`);
        }
      }
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
      const lineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
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

    const subTotal = ctx.cart.reduce((sum, item) => sum + item.priceAtSale * item.quantity, 0);

    return {
      success: true,
      code: 'CART_UPDATED',
      message: `Đã thêm ${quantity}x [${product.name}] vào giỏ hàng.`,
      data: {
        cart: ctx.cart,
        subTotal,
        totalItems: ctx.cart.reduce((s, i) => s + i.quantity, 0),
      },
      actionType: 'ADD_TO_CART',
      actionPayload: JSON.stringify({
        productId: product.id,
        productName: product.name,
        quantity,
        priceAtSale,
        cartTotal: subTotal,
      }),
      content: `Đã thêm ${quantity}x ${product.name} vào giỏ hàng. Hiện giỏ hàng của bạn có tổng tạm tính là ${subTotal.toLocaleString('vi-VN')}đ.`,
    };
  }

  private async toolUpdateCartItem(args: any, ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    if (!ctx.cart || ctx.cart.length === 0) {
      return { success: false, code: 'CART_EMPTY', message: 'Giỏ hàng đang trống.' };
    }

    let targetIndex = -1;
    const searchId = args.lineId || args.cartItemId || args.id;
    if (searchId) {
      targetIndex = ctx.cart.findIndex((i) => i.lineId === searchId || i.id === searchId);
    } else if (args.productId) {
      targetIndex = ctx.cart.findIndex((i) => i.productId === args.productId);
    } else if (args.productName) {
      targetIndex = ctx.cart.findIndex((i) => i.productName.toLowerCase().includes(args.productName.trim().toLowerCase()));
    }

    if (targetIndex === -1) {
      return { success: false, code: 'ITEM_NOT_IN_CART', message: 'Không tìm thấy món này trong giỏ hàng.' };
    }

    const target = ctx.cart[targetIndex];
    const newQty = Number(args.quantity);

    if (newQty <= 0) {
      ctx.cart.splice(targetIndex, 1);
    } else {
      target.quantity = newQty;
      if (args.note) target.note = args.note.trim();
    }

    const subTotal = ctx.cart.reduce((sum, item) => sum + item.priceAtSale * item.quantity, 0);

    return {
      success: true,
      code: 'CART_UPDATED',
      message: newQty <= 0 ? `Đã xóa [${target.productName}] khỏi giỏ hàng.` : `Đã đổi số lượng [${target.productName}] thành ${newQty}.`,
      data: { cart: ctx.cart, subTotal },
      actionType: 'UPDATE_CART',
      actionPayload: JSON.stringify({ cart: ctx.cart, subTotal }),
    };
  }

  private async toolGetCart(ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    const cart = ctx.cart || [];
    const subTotal = cart.reduce((sum, item) => sum + item.priceAtSale * item.quantity, 0);

    if (cart.length === 0) {
      return {
        success: true,
        code: 'CART_EMPTY',
        message: 'Giỏ hàng của bạn đang trống.',
        data: { cart: [], items: [], subTotal: 0 },
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
      message: `Giỏ hàng có ${cart.length} món, tổng tạm tính: ${subTotal.toLocaleString('vi-VN')}đ`,
      data: { cart, items: cart, subTotal },
      content: `Giỏ hàng của bạn hiện gồm:\n${itemsSummary}\nTổng tiền tạm tính: ${subTotal.toLocaleString('vi-VN')}đ.`,
    };
  }

  private async toolClearCart(ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    ctx.cart = [];
    ctx.discountVoucherCode = undefined;
    ctx.shippingVoucherCode = undefined;
    ctx.pointsToUse = 0;

    return {
      success: true,
      code: 'CART_CLEARED',
      message: 'Đã làm mới và xóa toàn bộ giỏ hàng.',
      data: { cart: [], subTotal: 0 },
      actionType: 'CLEAR_CART',
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

  private async toolValidateDeliveryAddress(args: any, ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
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

  private async toolSaveAddress(args: any, userId?: string): Promise<ChatbotToolResult> {
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

  private async toolGetAvailableOrderSlots(args: any, ctx: ChatSessionContext): Promise<ChatbotToolResult> {
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

  private async toolFindApplicableVouchers(args: any, ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    const now = new Date();
    const cartTotal = (ctx.cart || []).reduce((s, i) => s + i.priceAtSale * i.quantity, 0);

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

      const vInfo = {
        code: v.code,
        title: v.title,
        discountType: v.discountType,
        discountValue: v.discountValue,
        minOrderValue: v.minOrderValue,
        isEligible: isUsageOk && isMinOk && isTierOk,
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

  private async toolApplyVoucher(args: any, ctx: ChatSessionContext): Promise<ChatbotToolResult> {
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

  private async toolRemoveVoucher(args: any, ctx: ChatSessionContext): Promise<ChatbotToolResult> {
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

  private async toolPreviewPointUsage(args: any, ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
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

  private async toolGetPaymentMethods(args: any, ctx: ChatSessionContext): Promise<ChatbotToolResult> {
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

  private async toolPreviewOrder(args: any, ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
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

    const pricing = await this.orderPricingService.calculatePricing({
      items: pricingItems,
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

    return {
      success: true,
      code: 'ORDER_PREVIEW_READY',
      message: `Bản xem trước đơn hàng: Tổng thanh toán ${pricing.totalAmount.toLocaleString('vi-VN')}đ`,
      data: previewData,
      actionType: 'ORDER_PREVIEW',
      actionPayload: JSON.stringify(previewData),
      content: `Đơn hàng của bạn gồm ${ctx.cart.length} món, tổng thanh toán là ${pricing.totalAmount.toLocaleString('vi-VN')}đ (đã gồm VAT và phí ship). Bạn có muốn xác nhận đặt đơn hàng này với phương thức thanh toán [${ctx.paymentMethod || 'COD'}] không ạ?`,
      suggestedReplies: ['Xác nhận đặt đơn', 'Đổi phương thức thanh toán', 'Thêm món khác'],
      requiresConfirmation: true,
    };
  }

  private async toolPlaceOrder(args: any, ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    if (!ctx.cart || ctx.cart.length === 0) {
      return { success: false, code: 'CART_EMPTY', message: 'Giỏ hàng đang trống, không thể tạo đơn.' };
    }

    if (!ctx.operatingSlotId || !ctx.deliveryDate) {
      return { success: false, code: 'SLOT_REQUIRED', message: 'Chưa có khung giờ giao hàng. Vui lòng gọi previewOrder trước.' };
    }

    const branchId = ctx.currentBranchId || (await this.prisma.branch.findFirst({ where: { onlineOrderingEnabled: true } }))?.id;
    if (!branchId) return { success: false, code: 'BRANCH_REQUIRED', message: 'Thiếu thông tin chi nhánh.' };

    const paymentMethod = args.paymentMethod || ctx.paymentMethod || 'COD';
    const idempotencyKey = args.idempotencyKey || ctx.lastIdempotencyKey || crypto.randomUUID();
    ctx.lastIdempotencyKey = idempotencyKey;

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
    };

    // Gọi atomic createOrder từ OrderService
    const orderResult = await this.orderService.createOrder(userId || 'guest-user', payload);
    const createdOrder = await this.prisma.order.findUnique({
      where: { id: orderResult.orderId },
    });
    if (idempotencyKey && createdOrder) {
      await this.prisma.order.update({
        where: { id: createdOrder.id },
        data: { idempotencyKey },
      }).catch(() => {});
    }

    const orderTotal = createdOrder?.totalAmount || 0;
    const orderStatus = createdOrder?.status || 'PENDING';
    const finalOrderCode = createdOrder?.orderCode || orderResult.orderCode;

    // Xóa cart trong session sau khi đã đặt thành công
    ctx.cart = [];
    ctx.discountVoucherCode = undefined;
    ctx.shippingVoucherCode = undefined;
    ctx.pointsToUse = 0;

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

  private async toolCheckOrder(args: any, userId?: string): Promise<ChatbotToolResult> {
    let order: any = null;
    if (args.orderCode) {
      order = await this.prisma.order.findFirst({
        where: { orderCode: args.orderCode.trim() },
        include: { orderItems: { include: { product: true } } },
      });
    } else if (userId) {
      order = await this.prisma.order.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { orderItems: { include: { product: true } } },
      });
    }

    if (!order) {
      return { success: false, code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy thông tin đơn hàng.' };
    }

    return {
      success: true,
      code: 'ORDER_FOUND',
      message: `Đơn [${order.orderCode}] trạng thái: ${order.status}`,
      data: { order },
      content: `Đơn hàng ${order.orderCode} của bạn hiện có trạng thái: ${order.status}. Tổng thanh toán: ${order.totalAmount.toLocaleString('vi-VN')}đ.`,
    };
  }

  private async toolCancelOrder(args: any, userId?: string): Promise<ChatbotToolResult> {
    if (!args.orderCode) return { success: false, code: 'ORDER_CODE_REQUIRED', message: 'Vui lòng cung cấp mã đơn hàng.' };

    const canceled = await this.orderService.cancelOrder(userId || '', args.orderCode, args.reason);

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

  private async toolGetReservationSlots(args: any): Promise<ChatbotToolResult> {
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

  private async toolPreviewReservation(args: any, ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
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

    return {
      success: true,
      code: 'RESERVATION_PREVIEW_READY',
      message: 'Bảng xác nhận đặt bàn đã sẵn sàng.',
      data: summary,
      actionType: 'CONFIRM_RESERVATION',
      actionPayload: JSON.stringify(summary),
      content: `THÔNG TIN ĐẶT BÀN:\n- Chi nhánh: ${branch.name}\n- Thời gian: ${effectiveTime} ngày ${effectiveDate}\n- Số lượng: ${effectiveParty} khách\n- Người đặt: ${effectiveName} (${effectivePhone})\n${args.seatingPreference ? `- Vị trí ưu tiên: ${args.seatingPreference}\n` : ''}Quý khách có xác nhận thông tin đặt bàn này không ạ?`,
      suggestedReplies: ['Xác nhận đặt bàn', 'Đổi lại giờ khác', 'Hủy yêu cầu'],
      requiresConfirmation: true,
    };
  }

  private async toolCreateReservation(args: any, ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    const idempotencyKey = args.idempotencyKey || ctx.lastIdempotencyKey || crypto.randomUUID();
    ctx.lastIdempotencyKey = idempotencyKey;

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
    const branchId = args.branchId || draft.branchId;
    const reservationDate = args.reservationDate || draft.reservationDate;
    const reservationTime = args.reservationTime || draft.reservationTime;
    const partySize = Number(args.partySize || draft.partySize);
    const customerName = args.customerName || draft.customerName;
    const customerPhone = args.customerPhone || draft.customerPhone;

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
        customerEmail: args.customerEmail || draft.customerEmail,
        seatingPreference: args.seatingPreference || draft.seatingPreference,
        specialRequests: args.specialRequests || draft.specialRequests,
        source: ReservationSource.CHATBOT,
        idempotencyKey,
      },
      userId,
      'USER',
    );

    if (idempotencyKey && created) {
      await this.prisma.reservation.update({
        where: { id: created.id },
        data: { idempotencyKey },
      }).catch(() => {});
    }

    // Xóa draft sau khi đã tạo thành công
    ctx.reservationDraft = undefined;

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

  private async toolGetMyReservations(args: any, userId?: string): Promise<ChatbotToolResult> {
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

  private async toolCancelReservation(args: any, userId?: string): Promise<ChatbotToolResult> {
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
