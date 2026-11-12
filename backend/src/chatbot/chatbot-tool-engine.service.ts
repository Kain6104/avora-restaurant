import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { OrderService } from '../order/order.service';
import { OrderPricingService } from '../pricing/order-pricing.service';
import { ShippingFeeService } from '../shipping/shipping-fee.service';
import { OperatingSlotService, normalizeDateToYYYYMMDD } from '../operating-slot/operating-slot.service';
import { PaymentMethodService } from '../payment-method/payment-method.service';
import { ReservationSource } from '@prisma/client';
import {
  ChatSessionContext,
  ChatbotToolResult,
  ChatSessionCartItem,
  ChatCartSnapshot,
  ChatbotSuggestion,
} from './dto/chatbot-tool.dto';
import {
  ChatbotToolArgsMap,
  ChatbotToolArgumentValidationError,
  ChatbotToolName,
  ValidatedChatbotToolCommand,
  isChatbotToolName,
  validateChatbotToolCommand,
} from './dto/chatbot-tool-args.dto';
import { ChatbotCacheRegistry, ChatbotCacheScope } from './chatbot-cache.registry';
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
  ) {
    ChatbotCacheRegistry.register((scope) => {
      this.invalidateCache(scope);
    });
  }

  public invalidateCache(scope: ChatbotCacheScope = 'ALL'): void {
    if (scope === 'ALL' || scope === 'BRANCH' || scope === 'MENU') {
      this.cachedAllBranches = null;
      this.cachedBranchesExpiresAt = 0;
    }
  }

  public getCacheStats() {
    return {
      hasBranchesCache: Boolean(this.cachedAllBranches && this.cachedBranchesExpiresAt > Date.now()),
      registryVersion: ChatbotCacheRegistry.getVersion(),
    };
  }

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
    clientCartItems?: any[],
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
    if (clientCartItems && Array.isArray(clientCartItems)) {
      const groupedMap = new Map<string, any>();
      for (const item of clientCartItems) {
        const rawId = String(item.productId || item.id || '');
        const prodId = rawId.replace(/^cart-/, '').replace(/-\d{10,}$/, '').trim();
        const selectedOptions = (item.selectedOptions || []).map((o: any) => ({
          optionGroupId: o.groupId || o.optionGroupId || o.optionGroup?.id || '',
          optionGroupName: o.groupName || o.optionGroupName || o.optionGroup?.name || '',
          optionItemId: o.optionItemId || o.id || '',
          optionItemName: o.optionItemName || o.name || '',
          extraPrice: Number(o.extraPrice || o.price || o.priceAdjustment || 0),
        }));
        const optKey = selectedOptions.map((o: any) => o.optionItemId).sort().join('|');
        const note = (item.note || item.notes || '').trim();
        const isFs = Boolean(item.isFlashSale || item.flashSale);
        const dedupeKey = `${prodId}#${optKey}#${note}#${isFs}`;
        const qty = Math.max(1, Number(item.quantity) || 1);

        const existing = groupedMap.get(dedupeKey);
        if (existing) {
          existing.quantity += qty;
        } else {
          groupedMap.set(dedupeKey, {
            lineId: item.lineId || item.id || `line-${prodId}`,
            productId: prodId,
            productName: item.productName || item.name || 'Món ăn',
            quantity: qty,
            basePrice: Number(item.originalPrice || item.price || item.priceAtSale || 0),
            priceAtSale: Number(item.price || item.priceAtSale || 0),
            selectedOptions,
            note: note || undefined,
            isFlashSale: isFs,
            flashSaleId: item.flashSaleId,
          });
        }
      }
      ctx.cart = Array.from(groupedMap.values());
    }

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
        case 'getRestaurantInfo':
          result = await this.toolGetRestaurantInfo(command.args);
          break;

        // 2. Menu & Products
        case 'searchMenu':
          result = await this.toolSearchMenu(command.args, ctx);
          break;
        case 'getProductDetail':
          result = await this.toolGetProductDetail(command.args, ctx);
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
        case 'requestDeliveryLocation':
          result = await this.toolRequestDeliveryLocation(command.args, ctx);
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
          result = await this.toolCheckOrder(command.args, userId, ctx);
          break;
        case 'cancelOrder':
          result = await this.toolCancelOrder(command.args, userId, ctx);
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
  // 1. CHI NHÁNH, BẢN ĐỒ TƯƠNG TÁC & TRI THỨC NHÀ HÀNG
  // =========================================================================

  private cachedAllBranches: any[] | null = null;
  private cachedBranchesExpiresAt = 0;

  private formatBranchForMapCard(b: any, distanceKm?: number) {
    const slug = (b.slug || b.name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const address = [b.street, b.ward, b.district, b.province].filter(Boolean).join(', ');
    const hasCoords = typeof b.latitude === 'number' && typeof b.longitude === 'number';
    const mapQuery = hasCoords
      ? `${b.latitude},${b.longitude}`
      : encodeURIComponent(`${b.name} ${address}`);

    return {
      id: b.id,
      name: b.name,
      slug,
      branchUrl: `/chi-nhanh/${slug}`,
      branchCode: b.branchCode,
      phone: b.phone || '1900 6868',
      address: address || 'Hệ thống nhà hàng AVORA',
      street: b.street,
      ward: b.ward,
      district: b.district,
      province: b.province,
      openTime: b.openTime || '10:00',
      closeTime: b.closeTime || '22:00',
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      reservationEnabled: b.reservationEnabled ?? true,
      onlineOrderingEnabled: b.onlineOrderingEnabled ?? true,
      distanceKm: distanceKm !== undefined ? Number(distanceKm.toFixed(2)) : undefined,
      distanceType: distanceKm !== undefined ? 'HAVERSINE_ESTIMATE' : undefined,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
      embedMapUrl: `https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`,
    };
  }

  private async getAllFormattedBranchesCached(): Promise<any[]> {
    const now = Date.now();
    if (this.cachedAllBranches && this.cachedBranchesExpiresAt > now) {
      return this.cachedAllBranches;
    }
    const rawBranches =
      (await this.prisma.branch.findMany({
        orderBy: { name: 'asc' },
      })) || [];
    const formatted = rawBranches.map((b) => this.formatBranchForMapCard(b));
    this.cachedAllBranches = formatted;
    this.cachedBranchesExpiresAt = now + 5 * 60 * 1000;
    return formatted;
  }

  private async toolListBranches(args: ChatbotToolArgsMap['listBranches']): Promise<ChatbotToolResult> {
    const where: any = {};
    if (args.reservationOnly) where.reservationEnabled = true;
    if (args.deliveryOnly) where.onlineOrderingEnabled = true;

    const rawBranches =
      (await this.prisma.branch.findMany({
        where,
        orderBy: { name: 'asc' },
      })) || [];

    const branches = rawBranches.map((b) => this.formatBranchForMapCard(b));

    return {
      success: true,
      code: 'BRANCH_LIST_LOADED',
      message: `Tìm thấy ${branches.length} chi nhánh hoạt động.`,
      data: { branches },
      actionType: 'REQUEST_LOCATION',
      actionPayload: JSON.stringify({
        reason: 'FIND_NEAREST_BRANCH',
        autoFallbackSeconds: 10,
        allBranches: branches,
      }),
      suggestedReplies: [
        '📍 Chia sẻ vị trí của tôi',
        { label: 'Đặt bàn trước', action: 'SEND_MESSAGE', payload: 'Tôi muốn đặt bàn tại nhà hàng' },
        { label: 'Xem thực đơn bán chạy', action: 'SEND_MESSAGE', payload: 'Gợi ý các món bán chạy nhất' },
      ],
      content: `Nhà hàng Avora hiện có ${branches.length} chi nhánh đang hoạt động. Bạn có thể bấm nút định vị bên dưới để tìm cơ sở gần bạn nhất (hoặc hệ thống sẽ tự động hiển thị danh sách chi nhánh kèm bản đồ sau 7 giây nhé)!`,
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

    const formattedBranch = this.formatBranchForMapCard(branch);
    const allBranches = await this.getAllFormattedBranchesCached();

    return {
      success: true,
      code: 'BRANCH_DETAIL_LOADED',
      message: `Thông tin chi nhánh ${branch.name}`,
      data: { branch: formattedBranch },
      actionType: 'REQUEST_LOCATION',
      actionPayload: JSON.stringify({
        reason: 'FIND_NEAREST_BRANCH',
        mode: 'STATIC_BRANCHES',
        selectedBranchId: formattedBranch.id,
        allBranches: allBranches.length > 0 ? allBranches : [formattedBranch],
      }),
      content: `Chi nhánh [${formattedBranch.name}](${formattedBranch.branchUrl}): ${formattedBranch.address}. Giờ mở cửa: ${formattedBranch.openTime} - ${formattedBranch.closeTime}. Hotline: ${formattedBranch.phone}.`,
    };
  }

  private async toolFindNearestBranch(args: ChatbotToolArgsMap['findNearestBranch']): Promise<ChatbotToolResult> {
    const { latitude, longitude } = args;
    const allBranches = await this.getAllFormattedBranchesCached();

    if (!latitude || !longitude) {
      return {
        success: true,
        code: 'LOCATION_REQUIRED',
        actionType: 'REQUEST_LOCATION',
        actionPayload: JSON.stringify({
          reason: 'FIND_NEAREST_BRANCH',
          autoFallbackSeconds: 10,
          allBranches,
        }),
        suggestedReplies: ['📍 Chia sẻ vị trí của tôi'],
        message: 'Vui lòng chia sẻ vị trí để tìm chi nhánh gần bạn nhất.',
        content: 'Để tìm chi nhánh Avora gần bạn nhất kèm bản đồ chỉ đường chính xác, bạn vui lòng bấm nút **"Chia sẻ vị trí của tôi"** bên dưới nhé! (Nếu không bật định vị, danh sách tất cả chi nhánh và bản đồ sẽ tự động hiển thị sau 7 giây).',
      };
    }

    const branches = await this.prisma.branch.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
    });

    if (branches.length === 0) {
      return {
        success: true,
        code: 'BRANCH_LIST_LOADED',
        actionType: 'REQUEST_LOCATION',
        actionPayload: JSON.stringify({
          reason: 'FIND_NEAREST_BRANCH',
          mode: 'STATIC_BRANCHES',
          allBranches,
        }),
        message: 'Danh sách chi nhánh hệ thống Avora.',
        content: 'Dưới đây là danh sách các chi nhánh của hệ thống nhà hàng Avora kèm bản đồ chỉ đường chi tiết:',
      };
    }

    const withDist = branches.map((b) => {
      const dist = this.calculateHaversine(latitude, longitude, b.latitude!, b.longitude!);
      return this.formatBranchForMapCard(b, dist);
    });

    withDist.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
    const top = withDist.slice(0, 3);

    return {
      success: true,
      code: 'NEAREST_BRANCHES_FOUND',
      message: `Đã tìm thấy ${top.length} chi nhánh gần bạn nhất.`,
      data: { nearestBranches: top, allBranches: withDist },
      actionType: 'REQUEST_LOCATION',
      actionPayload: JSON.stringify({
        reason: 'FIND_NEAREST_BRANCH',
        mode: 'NEAREST_FOUND',
        userLocation: { latitude, longitude },
        nearestBranches: top,
        allBranches: withDist,
        googleMapsUrl: top[0]?.googleMapsUrl,
      }),
      suggestedReplies: [
        { label: `Đặt bàn tại ${top[0].name}`, action: 'SEND_MESSAGE', payload: `Tôi muốn đặt bàn tại chi nhánh ${top[0].name}` },
        { label: `Xem thực đơn ${top[0].name}`, action: 'SEND_MESSAGE', payload: `Gợi ý các món bán chạy tại ${top[0].name}` },
      ],
      content: `Chi nhánh gần bạn nhất là [${top[0].name}](${top[0].branchUrl}) (khoảng cách ước tính **~${top[0].distanceKm} km**). Quý khách có thể xem vị trí ghim trực tiếp trên bản đồ tương tác bên dưới nhé!`,
    };
  }

  private async toolGetRestaurantInfo(args: ChatbotToolArgsMap['getRestaurantInfo']): Promise<ChatbotToolResult> {
    const rawTopic = (args.topic || 'GENERAL').toUpperCase();
    const allBranches = await this.getAllFormattedBranchesCached();

    const knowledgeData = {
      brandName: 'AVORA Restaurant - Tinh hoa Ẩm thực Nhật Bản & Á Âu Hiện Đại',
      openingHours: '10:00 - 22:00 tất cả các ngày trong tuần (kể cả Lễ, Tết)',
      hotline: allBranches[0]?.phone || '1900 6868',
      branchCount: allBranches.length || 5,
      branchesSummary: allBranches.map((b) => `${b.name} (${b.address})`),
      capabilities: [
        'Tư vấn thực đơn chuẩn xác 100% theo sở thích, chế độ ăn (Chay, Healthy, Keto) và cảnh báo dị ứng.',
        'Thiết kế mâm tiệc / combo nhiều món tự động cân đối theo ngân sách và số lượng thực khách.',
        'Đặt món giao hàng tận nơi (tự động định vị GPS tính phí ship) hoặc Nhận tại quán (Takeaway miễn phí ship).',
        'Săn và áp dụng đồng thời 2 mã ưu đãi (1 Voucher giảm món + 1 Voucher Freeship) kèm trừ điểm thưởng thành viên.',
        'Đặt bàn giữ chỗ trước theo khung giờ thực tế, chọn vị trí ngồi (Phòng VIP, bàn cửa sổ, sân vườn) và ghi chú trang trí tiệc.',
        'Định vị chi nhánh gần nhất kèm Bản đồ tương tác trực tiếp ngay trong khung chat.',
        'Đàm thoại trực tiếp bằng Giọng nói AI thời gian thực (Voice AI).',
      ],
      amenitiesAndPolicies: {
        parking: 'Tất cả chi nhánh AVORA đều có bãi đỗ xe máy miễn phí và khu vực đỗ xe ô tô rộng rãi, an toàn có nhân viên bảo vệ hướng dẫn.',
        vipRoom: 'Hệ thống có phòng VIP riêng tư sang trọng sức chứa từ 6 đến 30 khách, trang bị âm thanh/màn hình phục vụ tiếp khách, họp mặt gia đình và tiệc sinh nhật.',
        birthdaySupport: 'Hỗ trợ trang trí bàn tiệc sinh nhật, kỷ niệm cơ bản miễn phí khi quý khách đặt bàn trước và ghi chú yêu cầu.',
        babyAndFamily: 'Cung cấp miễn phí ghế ngồi ăn dặm an toàn cho trẻ em (Baby Chair), dụng cụ ăn uống cho bé và có các món cháo/cơm/mỳ không cay phù hợp cho bé.',
        vatInvoice: 'Hỗ trợ xuất hóa đơn điện tử GTGT (VAT 10%) hợp lệ ngay trong ngày. Quý khách có thể điền thông tin công ty/mã số thuế khi thanh toán hoặc báo nhân viên thu ngân.',
        wifiAndPayment: 'Miễn phí Wi-Fi tốc độ cao. Hỗ trợ thanh toán tiền mặt (COD), chuyển khoản VietQR SePay tự động, thẻ ngân hàng (Visa/Mastercard/NAPAS), MoMo và VNPay.',
        loyaltyProgram: 'Khách hàng đăng ký thành viên được tích điểm trên mọi đơn hàng và nâng hạng thẻ (Thành viên, Bạc, Vàng, Kim Cương) để trừ trực tiếp tiền mặt cho các lần dùng bữa tiếp theo.',
      },
    };

    return {
      success: true,
      code: 'RESTAURANT_INFO_LOADED',
      message: `Đã tải thông tin dịch vụ & tiện ích AVORA (Chủ đề: ${rawTopic}).`,
      data: knowledgeData,
      suggestedReplies: [
        { label: 'Gợi ý món bán chạy nhất', action: 'SEND_MESSAGE', payload: 'Gợi ý cho tôi các món đang bán chạy nhất tại nhà hàng' },
        { label: 'Tìm chi nhánh gần tôi', action: 'SEND_MESSAGE', payload: 'Tìm chi nhánh AVORA gần tôi nhất' },
        { label: 'Đặt bàn giữ chỗ', action: 'SEND_MESSAGE', payload: 'Tôi muốn đặt bàn trước tại nhà hàng' },
      ],
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

  /**
   * Bộ ghép mâm ăn / combo đa danh mục theo ngân sách và số người từ Database thật
   */
  private async buildMultiCategoryCombo(
    rawQuery: string,
    explicitBudget: number | undefined,
    effectiveBranchId: string | undefined,
    ctx: ChatSessionContext,
  ): Promise<ChatbotToolResult | null> {
    const q = rawQuery.toLowerCase();

    // 1. Nhận diện các nhóm danh mục ẩm thực trong câu hỏi
    const categoryGroupMap = [
      { key: 'Sashimi', pattern: /(?:sashimi|hải sản tươi|cá sống)/i, slugs: ['sashimi', 'set-sushi', 'take-away'] },
      { key: 'Cơm & Mỳ', pattern: /(?:cơm|mỳ|mì|udon|soba|cuốn|roll)/i, slugs: ['com-my', 'com-cuon', 'sushi'] },
      { key: 'Món phụ & Salad', pattern: /(?:món phụ|phụ|salad|khai vị|dùng kèm|ăn kèm)/i, slugs: ['salad', 'khai-vi'] },
      { key: 'Nước uống', pattern: /(?:nước|đồ uống|uống|trà|nước ép|soft drink|juice)/i, slugs: ['nuoc-ep-trai-cay', 'tra', 'soft-drink'] },
      { key: 'Món chính & Lẩu', pattern: /(?:món chính|lẩu|hotpot|combo|thịt nướng)/i, slugs: ['mon-chinh', 'lau', 'combo'] },
      { key: 'Tráng miệng', pattern: /(?:tráng miệng|dessert|chè|bánh)/i, slugs: ['trang-mieng'] },
    ];

    const matchedGroups = categoryGroupMap.filter((g) => g.pattern.test(q));

    // Nhận diện ngân sách trong câu: ví dụ 500k -> 500000, 500.000 -> 500000, 1 triệu -> 1000000
    let detectedBudget = explicitBudget ? Number(explicitBudget) : 0;
    if (!detectedBudget) {
      const budgetMatchK = q.match(/(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|ngàn)/i);
      const budgetMatchTrieu = q.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu)/i);
      const budgetMatchVnd = q.match(/(\d{2,3}(?:[.,]\d{3})+)\s*(?:đ|vnd|dong)?/i);

      if (budgetMatchK) {
        detectedBudget = parseFloat(budgetMatchK[1].replace(',', '.')) * 1000;
      } else if (budgetMatchTrieu) {
        detectedBudget = parseFloat(budgetMatchTrieu[1].replace(',', '.')) * 1000000;
      } else if (budgetMatchVnd) {
        detectedBudget = parseInt(budgetMatchVnd[1].replace(/[.,]/g, ''), 10);
      }
    }

    // Nhận diện số lượng món yêu cầu
    const dishCountMatch = q.match(/(\d+)\s*món/i);
    const targetDishCount = dishCountMatch ? parseInt(dishCountMatch[1], 10) : (matchedGroups.length >= 3 ? matchedGroups.length : 0);

    // Nhận diện số người ăn
    const peopleCountMatch = q.match(/(\d+)\s*(?:người|khách|bạn|ng)/i);
    const peopleCount = peopleCountMatch ? parseInt(peopleCountMatch[1], 10) : 0;

    // Chỉ kích hoạt chế độ ghép combo đa nhóm nếu có >= 2 nhóm danh mục HOẶC (có ngân sách + số món >= 3)
    if (matchedGroups.length < 2 && !(detectedBudget > 0 && targetDishCount >= 3)) {
      return null;
    }

    const excludedWords = ['khăn lạnh', 'mù tạt', 'nước tương', 'đũa', 'gừng'];
    const whereBase: any = {
      available: true,
      price: { gte: 25000 },
      NOT: excludedWords.map((w) => ({ name: { contains: w } })),
    };
    if (effectiveBranchId) {
      whereBase.branches = { some: { id: effectiveBranchId } };
    }

    // Lấy các sản phẩm từ database cho các nhóm
    const selectedDishes: any[] = [];
    const usedProductIds = new Set<string>();

    for (const group of matchedGroups) {
      const prods = await this.prisma.product.findMany({
        where: {
          ...whereBase,
          category: { slug: { in: group.slugs } },
        },
        include: {
          category: { select: { name: true, slug: true } },
          optionGroups: {
            include: { optionItems: { where: { available: true } } },
          },
        },
        orderBy: [{ isBestSeller: 'desc' }, { soldQuantity: 'desc' }, { price: 'asc' }],
        take: 10,
      });

      if (prods.length > 0) {
        // Chọn món chưa dùng
        const available = prods.filter((p) => !usedProductIds.has(p.id));
        if (available.length > 0) {
          // Ưu tiên món có giá trung bình cân đối nếu có ngân sách
          let chosen = available[0];
          if (detectedBudget > 0 && targetDishCount > 0) {
            const idealPrice = detectedBudget / targetDishCount;
            chosen = available.reduce((prev, curr) =>
              Math.abs(curr.price - idealPrice) < Math.abs(prev.price - idealPrice) ? curr : prev,
            );
          }
          selectedDishes.push(chosen);
          usedProductIds.add(chosen.id);
        }
      }
    }

    // Nếu chưa đủ số món mục tiêu, lấy thêm từ cơm/món chính/món phụ/tráng miệng
    if (targetDishCount > 0 && selectedDishes.length < targetDishCount) {
      const remainingCount = targetDishCount - selectedDishes.length;
      const extraProds = await this.prisma.product.findMany({
        where: {
          ...whereBase,
          id: { notIn: Array.from(usedProductIds) },
          category: { slug: { in: ['com-cuon', 'mon-chinh', 'sushi', 'com-my', 'trang-mieng', 'salad'] } },
        },
        include: {
          category: { select: { name: true, slug: true } },
          optionGroups: {
            include: { optionItems: { where: { available: true } } },
          },
        },
        orderBy: [{ isBestSeller: 'desc' }, { price: 'asc' }],
        take: remainingCount * 4,
      });

      for (const p of extraProds) {
        if (selectedDishes.length >= targetDishCount) break;
        if (!usedProductIds.has(p.id)) {
          selectedDishes.push(p);
          usedProductIds.add(p.id);
        }
      }
    }

    if (selectedDishes.length === 0) return null;

    const totalComboPrice = selectedDishes.reduce((sum, d) => sum + d.price, 0);

    const formatted = selectedDishes.map((p) => {
      const catSlug = p.category?.slug || '';
      const prodSlug = p.slug || '';
      const dishUrl = catSlug && prodSlug ? `/${catSlug}/${prodSlug}` : (prodSlug ? `/${prodSlug}` : '/menu');
      return {
        id: p.id,
        name: p.name,
        slug: prodSlug,
        categorySlug: catSlug,
        category: { name: p.category?.name || 'Món', slug: catSlug },
        productUrl: dishUrl,
        price: p.price,
        imageUrl: p.imageUrl,
        optionGroups: p.optionGroups || [],
      };
    });

    if (ctx) {
      ctx.lastSuggestedProducts = formatted.map((p) => ({ id: p.id, name: p.name }));
    }

    const itemsForCart = formatted.map((p) => ({
      productId: p.id,
      productName: p.name,
      price: p.price,
      quantity: 1,
    }));

    const formattedTotal = new Intl.NumberFormat('vi-VN').format(totalComboPrice);
    const budgetNote = detectedBudget > 0 ? ` (ngân sách ~${new Intl.NumberFormat('vi-VN').format(detectedBudget)}đ)` : '';
    const peopleNote = peopleCount > 0 ? ` cho ${peopleCount} người` : '';

    const dishLines = formatted.map((d, idx) => `${idx + 1}. ${d.name} (${d.category.name}) - ${new Intl.NumberFormat('vi-VN').format(d.price)}đ`).join('\n');

    return {
      success: true,
      code: 'COMBO_MEAL_RECOMMENDED',
      message: `AVORA đã thiết kế mâm ăn ${formatted.length} món${peopleNote}${budgetNote} với tổng tiền ${formattedTotal}đ chuẩn thực đơn nhà hàng.`,
      content: `Dạ AVORA đã chọn cho bạn mâm ăn cân đối gồm ${formatted.length} món ngon hài hòa${peopleNote}${budgetNote} với tổng cộng **${formattedTotal}đ**:\n\n${dishLines}\n\nTất cả món đều đang sẵn sàng phục vụ tại nhà hàng. Quý khách có thể bấm **Thêm toàn bộ mâm vào giỏ** để đặt ngay nhé!`,
      actionType: 'ADD_ALL_TO_CART',
      actionPayload: JSON.stringify({
        comboName: `Mâm tiệc ${formatted.length} món${peopleNote}`,
        totalAmount: totalComboPrice,
        items: itemsForCart,
      }),
      data: {
        products: formatted,
        totalAmount: totalComboPrice,
        detectedBudget,
        targetDishCount: formatted.length,
      },
      suggestedReplies: [
        {
          label: 'Thêm cả mâm vào giỏ hàng',
          action: 'ADD_ALL_TO_CART',
          payload: JSON.stringify({ items: itemsForCart }),
        },
        {
          label: 'Tiến hành chốt đơn',
          action: 'SEND_MESSAGE',
          payload: 'Tiến hành chốt đơn và thanh toán cho các món này',
        },
        {
          label: 'Gợi ý thêm nước uống',
          action: 'SEND_MESSAGE',
          payload: 'Gợi ý thêm đồ uống hoặc nước ép tráng miệng cho bữa ăn',
        },
      ],
    };
  }

  private async toolSearchMenu(args: ChatbotToolArgsMap['searchMenu'], ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    try {
      const where: any = { available: true };
      const effectiveBranchId = args.branchId || ctx.currentBranchId;
      if (effectiveBranchId) {
        where.branches = { some: { id: effectiveBranchId } };
      }

      const rawQuery = args.query ? args.query.trim() : '';
      const q = rawQuery.toLowerCase();

      // 0.1 KIỂM TRA Ý ĐỊNH ĐẶT BÀN / GIỮ BÀN (TUYỆT ĐỐI KHÔNG TÌM MÓN ĂN VỚI TỪ KHÓA BÀN!)
      const isReservationIntent = /(?:đặt\s*bàn|dat\s*ban|giữ\s*bàn|giu\s*ban|đặt\s*chỗ|book\s*table|bàn\s*tại|bàn\s*t\b)/i.test(rawQuery);
      if (isReservationIntent) {
        const branches = await this.prisma.branch.findMany({ where: { onlineOrderingEnabled: true } });
        const matchedBranch = branches.find((b) =>
          q.includes(b.name.toLowerCase()) ||
          (b.branchCode && q.includes(b.branchCode.toLowerCase())) ||
          (b.district && q.includes(b.district.toLowerCase())) ||
          (b.street && q.includes(b.street.toLowerCase())),
        ) || branches.find((b) => b.id === effectiveBranchId) || branches[0];

        const bName = matchedBranch ? matchedBranch.name : 'nhà hàng AVORA';
        return {
          success: true,
          code: 'RESERVATION_INTENT',
          message: `Dạ em xin hỗ trợ quý khách đặt bàn tại ${bName} ngay ạ! Quý khách vui lòng cho em biết: Ngày giờ muốn đến dùng bữa, số lượng khách đi cùng và số điện thoại liên hệ nhé!`,
          content: `Dạ em xin phép hỗ trợ quý khách đặt bàn tại **${bName}** ngay ạ!\n\nQuý khách vui lòng cung cấp giúp em thông tin:\n- **Thời gian đến:** (Ví dụ: 19:00 tối nay hoặc trưa mai)\n- **Số lượng khách:** (Ví dụ: 2 người, 4 người, 10 người)\n- **Số điện thoại liên hệ**\n\nEm sẽ kiểm tra bàn trống và giữ chỗ chu đáo nhất cho quý khách!`,
          data: {
            branch: matchedBranch,
          },
          suggestedReplies: [
            { label: `Đặt bàn 2 người tối nay`, action: 'SEND_MESSAGE', payload: `Tôi muốn đặt bàn 2 người vào 19:00 tối nay tại ${bName}` },
            { label: `Đặt bàn 4 người trưa mai`, action: 'SEND_MESSAGE', payload: `Tôi muốn đặt bàn 4 người vào 12:00 trưa mai tại ${bName}` },
            { label: `Xem thực đơn ${bName}`, action: 'SEND_MESSAGE', payload: `Cho tôi xem các món đặc sắc tại ${bName}` },
          ],
        };
      }

      // 0.2 KIỂM TRA YÊU CẦU GỢI Ý MÂM ĂN / COMBO NHIỀU MÓN THEO NGÂN SÁCH
      const comboResult = await this.buildMultiCategoryCombo(rawQuery, args.budget, effectiveBranchId, ctx);
      if (comboResult) {
        return comboResult;
      }

      const isHotQuery = ['bestseller', 'bán chạy', 'hot', 'nổi bật', 'gợi ý'].some((w) => q.includes(w));

      // Bóc tách tên danh mục nếu khách gửi câu kiểu: "Gợi ý món trong danh mục Sushi & Maki"
      const catPrefixRegex = /^(?:gợi ý|tìm|xem|cho tôi|danh sách)?\s*(?:các|những)?\s*món\s*(?:ăn)?\s*(?:trong|thuộc)?\s*(?:danh mục|loại)?\s*[:\-]?\s*/i;
      let categorySearchTerm = args.category ? args.category.trim() : '';
      if (!categorySearchTerm && catPrefixRegex.test(rawQuery)) {
        categorySearchTerm = rawQuery.replace(catPrefixRegex, '').trim();
      }

      // Đối chiếu xem từ khóa có trùng khớp với danh mục nào trong DB không
      let targetCategory: any = null;
      if (categorySearchTerm) {
        targetCategory = await this.prisma.category.findFirst({
          where: {
            OR: [
              { name: { contains: categorySearchTerm } },
              { slug: { contains: categorySearchTerm.toLowerCase() } },
            ],
          },
        });
      }

      if (!targetCategory && q && !isHotQuery) {
        targetCategory = await this.prisma.category.findFirst({
          where: {
            OR: [
              { name: { contains: q } },
              { slug: { contains: q } },
            ],
          },
        });
      }

      if (targetCategory) {
        where.categoryId = targetCategory.id;
      } else if (!isHotQuery && q) {
        where.OR = [
          { name: { contains: q } },
          { description: { contains: q } },
          { category: { name: { contains: q } } },
          { category: { slug: { contains: q } } },
        ];
      }

      if (args.budget && Number(args.budget) > 0) {
        where.price = { lte: Number(args.budget) };
      }

      const products =
        (await this.prisma.product.findMany({
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
        })) || [];

      const now = new Date();
      const formatProdItem = (p: any) => {
        const activeFs = p.FlashSaleItem?.find((fs: any) => {
          return fs.flashSale.startTime <= now && fs.flashSale.endTime >= now && fs.stock > fs.sold;
        });

        const requiredGroups = (p.optionGroups || [])
          .filter((g: any) => g.isRequired)
          .map((g: any) => ({
            name: g.name,
            choices: (g.optionItems || []).map((i: any) => `${i.name} (+${i.priceAdjustment.toLocaleString('vi-VN')}đ)`),
          }));

        const catSlug = p.category?.slug || '';
        const prodSlug = p.slug || '';
        const dishUrl = catSlug && prodSlug ? `/${catSlug}/${prodSlug}` : (prodSlug ? `/${prodSlug}` : '/menu');

        return {
          id: p.id,
          name: p.name,
          slug: prodSlug,
          categorySlug: catSlug,
          category: {
            name: p.category?.name || 'Món',
            slug: catSlug,
          },
          productUrl: dishUrl,
          price: p.price,
          flashSalePrice: activeFs ? activeFs.flashSalePrice : null,
          isFlashSale: Boolean(activeFs),
          imageUrl: p.imageUrl,
          optionGroups: p.optionGroups || [],
          hasRequiredOptions: requiredGroups.length > 0,
          requiredOptionsNotice:
            requiredGroups.length > 0
              ? `Cần chọn: ${requiredGroups.map((rg: any) => `${rg.name} (${rg.choices.join(', ')})`).join('; ')}`
              : null,
        };
      };

      const formatted = products.map(formatProdItem);

      if (ctx && formatted.length > 0) {
        ctx.lastSuggestedProducts = formatted.map((p) => ({ id: p.id, name: p.name }));
      }

      // Xây dựng gợi ý thông minh theo ngữ cảnh thực tế
      const suggestions: (string | ChatbotSuggestion)[] = [];
      if (formatted.length > 0) {
        const topDish = formatted[0];
        suggestions.push({
          label: `Thêm ${topDish.name} vào giỏ`,
          action: 'ADD_TO_CART',
          payload: { productName: topDish.name, productId: topDish.id },
          entityId: topDish.id,
        });

        if (formatted.length > 1) {
          suggestions.push({
            label: `Gợi ý món ăn kèm`,
            action: 'SEND_MESSAGE',
            payload: `Gợi ý cho tôi món ăn kèm phù hợp với ${topDish.name}`,
          });
        }

        if (args.budget) {
          suggestions.push({
            label: 'Gợi ý món ăn khác',
            action: 'SEND_MESSAGE',
            payload: 'Gợi ý thêm một lựa chọn khác cùng tầm giá',
          });
        } else {
          suggestions.push({
            label: 'Gợi ý theo ngân sách',
            action: 'SEND_MESSAGE',
            payload: 'Gợi ý cho tôi bữa ăn dưới 150.000đ',
          });
        }
      } else {
        suggestions.push({
          label: 'Xem toàn bộ danh mục thực đơn',
          action: 'SEND_MESSAGE',
          payload: 'Liệt kê các danh mục thực đơn của quán',
        });
        suggestions.push({
          label: 'Gợi ý món bán chạy nhất',
          action: 'SEND_MESSAGE',
          payload: 'Món nào đang bán chạy nhất?',
        });
      }

      if (formatted.length === 0) {
        // Kiểm tra sâu lý do không tìm thấy: Hết hàng (OUT_OF_STOCK), Chỉ có ở chi nhánh khác (BRANCH_UNAVAILABLE), hay Gần giống món thật / Không tồn tại (MENU_ITEM_NOT_FOUND)
        if (rawQuery && !isHotQuery) {
          const allMatchedRaw =
            (await this.prisma.product.findMany({
              where: {
                OR: [
                  { name: { contains: rawQuery } },
                  { slug: { contains: rawQuery.toLowerCase().replace(/\s+/g, '-') } },
                ],
              },
              include: {
                category: { select: { name: true, slug: true } },
                branches: { select: { id: true, name: true } },
              },
              take: 5,
            })) || [];

          const altProductsRaw =
            (await this.prisma.product.findMany({
              where: {
                available: true,
                ...(effectiveBranchId ? { branches: { some: { id: effectiveBranchId } } } : {}),
              },
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
              orderBy: [{ isBestSeller: 'desc' }, { soldQuantity: 'desc' }],
              take: 4,
            })) || [];
          const formattedAlternatives = altProductsRaw.map(formatProdItem);

          if (allMatchedRaw.length > 0) {
            const exactOrPrimary =
              allMatchedRaw.find((p) => (p.name || '').toLowerCase() === q) || allMatchedRaw[0];

            // 1. Món tạm hết hàng / ngừng bán (available = false)
            if (!exactOrPrimary.available) {
              return {
                success: false,
                code: 'PRODUCT_OUT_OF_STOCK',
                message: `Dạ món [${exactOrPrimary.name}] hiện đang tạm hết hàng tại nhà hàng ạ. Quý khách vui lòng tham khảo các món đặc sắc khác đang sẵn sàng phục vụ nhé!`,
                content: `Dạ món **${exactOrPrimary.name}** hiện đang tạm hết hàng tại nhà hàng ạ. Quý khách có thể tham khảo các món đang sẵn sàng phục vụ bên dưới nhé!`,
                data: {
                  outOfStockProduct: {
                    id: exactOrPrimary.id,
                    name: exactOrPrimary.name,
                    available: false,
                  },
                  suggestedAlternatives: formattedAlternatives,
                  products: [],
                },
                suggestedReplies: [
                  { label: 'Gợi ý món bán chạy', action: 'SEND_MESSAGE', payload: 'Gợi ý cho tôi các món bán chạy nhất' },
                  { label: 'Xem thực đơn', action: 'SEND_MESSAGE', payload: 'Cho tôi xem thực đơn của nhà hàng' },
                ],
              };
            }

            // 2. Món chỉ có ở chi nhánh khác (BRANCH_UNAVAILABLE)
            const prodBranchIds = (exactOrPrimary.branches || []).map((b: any) => b.id);
            if (
              effectiveBranchId &&
              prodBranchIds.length > 0 &&
              !prodBranchIds.includes(effectiveBranchId)
            ) {
              const servingBranchNames =
                (exactOrPrimary.branches || [])
                  .map((b: any) => b.name)
                  .filter(Boolean)
                  .join(', ') || 'chi nhánh khác';
              return {
                success: false,
                code: 'BRANCH_UNAVAILABLE',
                message: `Dạ món [${exactOrPrimary.name}] hiện chỉ phục vụ tại [${servingBranchNames}], tạm thời chưa có tại chi nhánh đang chọn ạ.`,
                content: `Dạ món **${exactOrPrimary.name}** hiện chỉ phục vụ tại **${servingBranchNames}**, tạm thời chưa có tại chi nhánh quý khách đang chọn ạ. Quý khách có thể đổi chi nhánh hoặc tham khảo các món đang có sẵn tại chi nhánh hiện tại nhé!`,
                data: {
                  unavailableAtBranchProduct: {
                    id: exactOrPrimary.id,
                    name: exactOrPrimary.name,
                    availableBranches: exactOrPrimary.branches,
                  },
                  suggestedAlternatives: formattedAlternatives,
                  products: [],
                },
                suggestedReplies: [
                  { label: 'Gợi ý món tại chi nhánh này', action: 'SEND_MESSAGE', payload: 'Gợi ý các món bán chạy tại chi nhánh hiện tại' },
                  { label: 'Xem danh sách chi nhánh', action: 'SEND_MESSAGE', payload: 'Xem danh sách các chi nhánh AVORA' },
                ],
              };
            }
          }

          // 3. Tìm món gần giống (Near-Miss Dish Name) để gợi ý thay thế mà vẫn giữ code MENU_ITEM_NOT_FOUND
          const modifierStopWords = new Set([
            'món', 'phần', 'suất', 'tô', 'bát', 'đĩa', 'ly', 'đặc', 'biệt', 'thượng', 'hạng', 'hoàng', 'kim', 'siêu', 'cấp',
          ]);
          const tokens = q
            .split(/\s+/)
            .map((t) => t.replace(/[^a-z0-9à-ỹ]/gi, ''))
            .filter((t) => t.length >= 2 && !modifierStopWords.has(t));

          let nearAlternatives = formattedAlternatives;
          if (tokens.length > 0) {
            const nearMatchesRaw =
              (await this.prisma.product.findMany({
                where: {
                  available: true,
                  ...(effectiveBranchId ? { branches: { some: { id: effectiveBranchId } } } : {}),
                  OR: tokens.map((t) => ({ name: { contains: t } })),
                },
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
                take: 6,
              })) || [];

            if (nearMatchesRaw.length > 0) {
              const scored = nearMatchesRaw
                .map((p) => {
                  const lowerName = (p.name || '').toLowerCase();
                  const matchCount = tokens.filter((t) => lowerName.includes(t)).length;
                  return { item: formatProdItem(p), matchCount };
                })
                .filter((s) => s.matchCount > 0)
                .sort((a, b) => b.matchCount - a.matchCount);

              const nearFormatted = scored.map((s) => s.item);
              const seenIds = new Set(nearFormatted.map((p) => p.id));
              nearAlternatives = [
                ...nearFormatted,
                ...formattedAlternatives.filter((p) => !seenIds.has(p.id)),
              ].slice(0, 4);
            }
          }

          return {
            success: false,
            code: 'MENU_ITEM_NOT_FOUND',
            message: 'Hiện tại AVORA chưa có món này trong thực đơn. Bạn có thể cho mình biết bạn thích món có nguyên liệu hoặc hương vị nào để mình gợi ý những món đang có tại nhà hàng nhé.',
            data: {
              products: [],
              suggestedAlternatives: nearAlternatives,
            },
            suggestedReplies: [
              { label: 'Xem thực đơn', action: 'SEND_MESSAGE', payload: 'Cho tôi xem thực đơn của nhà hàng' },
              { label: 'Gợi ý món bán chạy', action: 'SEND_MESSAGE', payload: 'Gợi ý cho tôi các món bán chạy nhất' },
            ],
          };
        }

        return {
          success: false,
          code: 'MENU_ITEM_NOT_FOUND',
          message: 'Hiện tại AVORA chưa có món này trong thực đơn. Bạn có thể cho mình biết bạn thích món có nguyên liệu hoặc hương vị nào để mình gợi ý những món đang có tại nhà hàng nhé.',
          data: { products: [] },
          suggestedReplies: [
            { label: 'Xem thực đơn', action: 'SEND_MESSAGE', payload: 'Cho tôi xem thực đơn của nhà hàng' },
            { label: 'Gợi ý món bán chạy', action: 'SEND_MESSAGE', payload: 'Gợi ý cho tôi các món bán chạy nhất' },
          ],
        };
      }

      return {
        success: true,
        code: 'MENU_SEARCH_COMPLETED',
        message: `Tìm thấy ${formatted.length} món phù hợp.`,
        data: { products: formatted },
        actionType: 'SHOW_PRODUCT',
        actionPayload: JSON.stringify({ products: formatted }),
        suggestedReplies: suggestions.slice(0, 3),
      };
    } catch (dbErr: any) {
      this.logger.error(`Database error in toolSearchMenu: ${dbErr?.message || dbErr}`);
      return {
        success: false,
        code: 'DATABASE_ERROR',
        message: 'Dạ hiện tại hệ thống chưa thể xác minh thực đơn tại thời điểm này. Quý khách vui lòng thử lại sau ít phút hoặc liên hệ trực tiếp nhân viên nhà hàng qua hotline để được hỗ trợ chu đáo nhất nhé!',
        content: 'Dạ hiện tại hệ thống chưa thể xác minh thực đơn tại thời điểm này. Quý khách vui lòng thử lại sau ít phút hoặc liên hệ trực tiếp nhân viên nhà hàng qua hotline để được hỗ trợ chu đáo nhất nhé!',
        data: { products: [] },
        recoverable: true,
      };
    }
  }

  private async toolGetProductDetail(args: ChatbotToolArgsMap['getProductDetail'], ctx?: ChatSessionContext): Promise<ChatbotToolResult> {
    try {
      let product: any = null;
      const includeConfig = {
        category: true,
        optionGroups: {
          include: { optionItems: { where: { available: true } } },
        },
        FlashSaleItem: {
          where: { flashSale: { status: 'ACTIVE' } },
          include: { flashSale: true },
        },
        branches: { select: { id: true, name: true } },
      };

      if (args.productId) {
        product = await this.prisma.product.findUnique({
          where: { id: args.productId },
          include: includeConfig,
        });
      } else if (args.productName) {
        const q = args.productName.trim();
        product = await this.prisma.product.findFirst({
          where: { name: { contains: q } },
          include: includeConfig,
        });

        if (!product) {
          const words = q.split(/\s+/).filter((w) => w.length > 1);
          if (words.length > 0) {
            product = await this.prisma.product.findFirst({
              where: {
                AND: words.map((w) => ({ name: { contains: w } })),
              },
              include: includeConfig,
            });
          }
        }
      }

      if (!product) {
        return { success: false, code: 'PRODUCT_NOT_FOUND', message: 'Không tìm thấy món ăn này trong thực đơn.' };
      }

      if (!product.available) {
        return {
          success: false,
          code: 'PRODUCT_OUT_OF_STOCK',
          message: `Dạ món [${product.name}] hiện đang tạm hết hàng tại nhà hàng ạ. Quý khách có thể tham khảo các món khác đang sẵn sàng phục vụ nhé!`,
          recoverable: true,
        };
      }

      const effectiveBranchId = (args as any).branchId || ctx?.currentBranchId;
      const productBranchIds = (product.branches || []).map((b: any) => b.id);
      if (
        effectiveBranchId &&
        productBranchIds.length > 0 &&
        !productBranchIds.includes(effectiveBranchId)
      ) {
        const servingNames =
          (product.branches || [])
            .map((b: any) => b.name)
            .filter(Boolean)
            .join(', ') || 'chi nhánh khác';
        return {
          success: false,
          code: 'BRANCH_UNAVAILABLE',
          message: `Dạ món [${product.name}] hiện chỉ phục vụ tại [${servingNames}], tạm thời chưa có tại chi nhánh đang chọn ạ.`,
          data: {
            unavailableAtBranchProduct: {
              id: product.id,
              name: product.name,
              availableBranches: product.branches,
            },
          },
          recoverable: true,
        };
      }

      if (ctx) {
        ctx.lastSuggestedProducts = [{ id: product.id, name: product.name }];
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
            slug: product.slug,
            categorySlug: product.category?.slug,
            productUrl: product.category?.slug && product.slug ? `/${product.category.slug}/${product.slug}` : (product.slug ? `/${product.slug}` : '/menu'),
            basePrice: product.price,
            flashSalePrice: activeFs ? activeFs.flashSalePrice : null,
            isFlashSale: Boolean(activeFs),
            description: product.description,
            imageUrl: product.imageUrl,
            optionGroups,
          },
        },
        suggestedReplies: [
          {
            label: `Thêm ${product.name} vào giỏ`,
            action: 'ADD_TO_CART',
            payload: { productName: product.name, productId: product.id },
            entityId: product.id,
          },
          {
            label: 'Gợi ý món ăn kèm',
            action: 'SEND_MESSAGE',
            payload: `Gợi ý cho tôi món ăn kèm phù hợp với ${product.name}`,
          },
          {
            label: 'Món khác cùng danh mục',
            action: 'SEND_MESSAGE',
            payload: `Gợi ý thêm món khác thuộc danh mục ${product.category?.name || 'này'}`,
          },
        ],
      };
    } catch (dbErr: any) {
      this.logger.error(`Database error in toolGetProductDetail: ${dbErr?.message || dbErr}`);
      return {
        success: false,
        code: 'DATABASE_ERROR',
        message: 'Dạ hiện tại hệ thống chưa thể xác minh thông tin món ăn tại thời điểm này. Quý khách vui lòng thử lại sau ít phút nhé!',
        recoverable: true,
      };
    }
  }

  private async toolListCategories(): Promise<ChatbotToolResult> {
    const categories = await this.prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    const categorySuggestions: (string | ChatbotSuggestion)[] = categories.slice(0, 3).map((c) => ({
      label: `Gợi ý món trong danh mục ${c.name}`,
      action: 'SEND_MESSAGE',
      payload: `Gợi ý cho tôi các món trong danh mục ${c.name}`,
      entityId: c.id,
    }));
    return {
      success: true,
      code: 'CATEGORIES_LOADED',
      message: `Có ${categories.length} danh mục món ăn.`,
      data: { categories },
      content: `Danh mục thực đơn gồm: ${categories.map((c) => c.name).join(', ')}.`,
      suggestedReplies: categorySuggestions,
    };
  }

  // =========================================================================
  // 3. SERVER-SIDE CART (GIỎ HÀNG TRÊN SERVER)
  // =========================================================================

  private createCartSnapshot(ctx: ChatSessionContext): ChatCartSnapshot {
    const consolidatedMap = new Map<string, ChatSessionCartItem>();
    for (const rawItem of ctx.cart || []) {
      const cleanProdId = String(rawItem.productId || rawItem.id || '').replace(/^cart-/, '').replace(/-\d{10,}$/, '').trim();
      const optKey = (rawItem.selectedOptions || []).map((o) => o.optionItemId).sort().join('|');
      const noteTrimmed = (rawItem.note || '').trim();
      const isFs = Boolean(rawItem.isFlashSale);
      const dedupeKey = `${cleanProdId}#${optKey}#${noteTrimmed}#${isFs}`;
      const qty = Math.max(1, Number(rawItem.quantity) || 1);

      const existing = consolidatedMap.get(dedupeKey);
      if (existing) {
        existing.quantity += qty;
      } else {
        consolidatedMap.set(dedupeKey, {
          ...rawItem,
          id: rawItem.id || `line-${cleanProdId}`,
          lineId: rawItem.lineId || rawItem.id || `line-${cleanProdId}`,
          productId: cleanProdId,
          quantity: qty,
          selectedOptions: (rawItem.selectedOptions || []).map((option) => ({ ...option })),
        });
      }
    }

    const items = Array.from(consolidatedMap.values());
    ctx.cart = items; // Update ctx.cart in-place to ensure no duplicates persist

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
    const productInclude = {
      optionGroups: {
        include: { optionItems: { where: { available: true } } },
      },
      FlashSaleItem: {
        where: { flashSale: { status: 'ACTIVE' } },
        include: { flashSale: true },
      },
      branches: { select: { id: true } },
    };

    // 1. Giải quyết món ăn (Fuzzy lookup & nhớ ngữ cảnh câu trước)
    if (args.productId) {
      product = await this.prisma.product.findUnique({
        where: { id: args.productId },
        include: productInclude,
      });
    }

    if (!product && args.productName) {
      const rawName = args.productName.trim();
      const lowerName = rawName.toLowerCase();
      const isGenericRef = [
        'món đó', 'món này', 'món vừa', 'món trên', 'món gợi ý', 'món 1', 'món đầu tiên', 'món vừa rồi', 'nó'
      ].some((ref) => lowerName.includes(ref));

      // Khách nói "cho tôi món đó" -> dùng món vừa gợi ý
      if (isGenericRef && ctx.lastSuggestedProducts && ctx.lastSuggestedProducts.length > 0) {
        product = await this.prisma.product.findUnique({
          where: { id: ctx.lastSuggestedProducts[0].id },
          include: productInclude,
        });
      }

      if (!product) {
        product = await this.prisma.product.findFirst({
          where: { name: { contains: rawName } },
          include: productInclude,
        });
      }

      if (!product) {
        const words = rawName.split(/\s+/).filter((w) => w.length > 1);
        if (words.length > 0) {
          product = await this.prisma.product.findFirst({
            where: {
              AND: words.map((w) => ({ name: { contains: w } })),
            },
            include: productInclude,
          });
        }
      }

      if (!product && ctx.lastSuggestedProducts && ctx.lastSuggestedProducts.length > 0) {
        const words = lowerName.split(/\s+/).filter((w) => w.length > 1);
        const matchedInCtx = ctx.lastSuggestedProducts.find((p) =>
          words.some((w) => p.name.toLowerCase().includes(w))
        );
        if (matchedInCtx) {
          product = await this.prisma.product.findUnique({
            where: { id: matchedInCtx.id },
            include: productInclude,
          });
        }
      }
    }

    // Fallback: nếu khách chỉ nói "thêm vào giỏ" và vừa gợi ý đúng 1 món
    if (!product && ctx.lastSuggestedProducts && ctx.lastSuggestedProducts.length === 1) {
      product = await this.prisma.product.findUnique({
        where: { id: ctx.lastSuggestedProducts[0].id },
        include: productInclude,
      });
    }

    if (!product) {
      return {
        success: false,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Không tìm thấy món ăn này. Bạn có thể nói rõ tên món hoặc tham khảo danh sách món vừa được gợi ý nhé!',
      };
    }

    if (!product.available) {
      return {
        success: false,
        code: 'PRODUCT_OUT_OF_STOCK',
        message: `Dạ món [${product.name}] hiện đang tạm hết hàng tại nhà hàng ạ. Quý khách có thể tham khảo các món hấp dẫn khác đang sẵn sàng phục vụ nhé!`,
        recoverable: true,
      };
    }

    // 2. Kiểm tra Chi nhánh
    const productBranchIds = (product.branches || []).map((branch: { id: string }) => branch.id);
    if (ctx.currentBranchId && productBranchIds.length > 0 && !productBranchIds.includes(ctx.currentBranchId)) {
      return {
        success: false,
        code: 'CART_BRANCH_CONFLICT',
        message: `Dạ món [${product.name}] hiện chỉ phục vụ tại chi nhánh khác, tạm thời chưa có tại chi nhánh đang chọn ạ.`,
        recoverable: true,
      };
    }
    if (!ctx.currentBranchId) {
      if (productBranchIds.length > 0) {
        ctx.currentBranchId = productBranchIds[0];
      } else {
        const defaultBranch = await this.prisma.branch.findFirst({
          where: { onlineOrderingEnabled: true },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });
        if (defaultBranch) {
          ctx.currentBranchId = defaultBranch.id;
        }
      }
    }

    // 3. Xử lý Options/Toppings thông minh
    const providedOptionIds = new Set<string>(args.optionItemIds || []);
    const optionNamesToMatch = ((args as any).optionNames || []).map((n: string) => n.trim().toLowerCase());
    if (args.note) {
      optionNamesToMatch.push(args.note.trim().toLowerCase());
    }

    // Khớp tên tùy chọn nếu AI truyền optionNames hoặc note
    for (const group of product.optionGroups || []) {
      for (const item of group.optionItems || []) {
        const itemLower = item.name.toLowerCase();
        if (optionNamesToMatch.some((n: string) => itemLower.includes(n) || n.includes(itemLower))) {
          providedOptionIds.add(item.id);
        }
      }
    }

    const autoSelectedNotes: string[] = [];
    const validOptionIds = new Set<string>();

    for (const group of product.optionGroups || []) {
      group.optionItems.forEach((item: any) => validOptionIds.add(item.id));
      const selectedCount = group.optionItems.filter((item: any) => providedOptionIds.has(item.id)).length;
      const minimum = Math.max(group.isRequired ? 1 : 0, group.minSelect || 0);
      const maximum = group.multipleChoice ? Math.max(1, group.maxSelect || 1) : 1;

      // Tự động chọn tùy chọn mặc định nếu nhóm bắt buộc mà khách chưa chọn
      if (selectedCount < minimum && group.optionItems.length > 0) {
        const defaultItem = group.optionItems.find((it: any) => it.isDefault) || group.optionItems[0];
        if (defaultItem) {
          providedOptionIds.add(defaultItem.id);
          validOptionIds.add(defaultItem.id);
          autoSelectedNotes.push(`${defaultItem.name}`);
        }
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

    const finalOptionIds = Array.from(providedOptionIds);
    const unknownOptionIds = finalOptionIds.filter((optionId) => !validOptionIds.has(optionId));
    if (unknownOptionIds.length > 0) {
      return {
        success: false,
        code: 'INVALID_PRODUCT_OPTIONS',
        message: 'Một hoặc nhiều tùy chọn không thuộc món ăn đã chọn.',
        data: { optionItemIds: unknownOptionIds },
        recoverable: true,
      };
    }

    // 4. Tính toán giá món và options
    const now = new Date();
    const activeFs = product.FlashSaleItem?.find(
      (fs: any) => fs.flashSale.startTime <= now && fs.flashSale.endTime >= now && fs.stock > fs.sold,
    );

    const basePrice = activeFs ? activeFs.flashSalePrice : product.price;
    const selectedOptions: any[] = [];
    let optionsAdjustment = 0;

    for (const group of product.optionGroups || []) {
      for (const item of group.optionItems || []) {
        if (finalOptionIds.includes(item.id)) {
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

    // 5. Quản lý Cart trong ctx
    if (!ctx.cart) ctx.cart = [];

    const cleanProductTargetId = String(product.id).replace(/^cart-/, '').replace(/-\d{10,}$/, '').trim();
    const targetProdName = product.name.trim().toLowerCase();
    // Tạo khóa phân biệt dòng giỏ hàng (Line Identity)
    const optKey = selectedOptions.map((o) => o.optionItemId).sort().join('|');
    const noteTrimmed = (args.note || '').trim();
    const existingIndex = ctx.cart.findIndex(
      (c) => {
        const cleanCartProdId = String(c.productId || c.id || '').replace(/^cart-/, '').replace(/-\d{10,}$/, '').trim();
        const cName = (c.productName || '').trim().toLowerCase();
        const isSameProd = cleanCartProdId === cleanProductTargetId || c.productId === product.id || cName === targetProdName;
        const cOptKey = (c.selectedOptions || []).map((o) => o.optionItemId).sort().join('|');
        const isSameOpts = cOptKey === optKey || (!cOptKey && !optKey);
        return isSameProd && isSameOpts && Boolean(c.isFlashSale) === Boolean(activeFs);
      }
    );

    if (existingIndex >= 0) {
      ctx.cart[existingIndex].quantity += quantity;
    } else {
      const lineId = `line-${cleanProductTargetId}-${optKey ? optKey.replace(/\|/g, '_') : 'base'}`;
      const newLine: ChatSessionCartItem = {
        id: lineId,
        lineId,
        productId: cleanProductTargetId,
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
    const autoNotice = autoSelectedNotes.length > 0 ? ` (tùy chọn: ${autoSelectedNotes.join(', ')})` : '';

    return {
      success: true,
      code: 'CART_UPDATED',
      message: `Đã thêm ${quantity}x [${product.name}] vào giỏ hàng.`,
      data: this.cartResultData(ctx),
      actionType: 'ADD_TO_CART',
      actionPayload: JSON.stringify(snapshot),
      content: `Đã thêm ${quantity}x ${product.name}${autoNotice} vào giỏ hàng. Hiện giỏ hàng của bạn có tổng tạm tính là ${snapshot.subTotal.toLocaleString('vi-VN')}đ. Bạn muốn chọn thêm món gì nữa không ạ?`,
      suggestedReplies: [
        { label: 'Kiểm tra giỏ hàng', action: 'SEND_MESSAGE', payload: 'Kiểm tra giỏ hàng của tôi' },
        { label: 'Tiến hành chốt đơn', action: 'SEND_MESSAGE', payload: 'Tiến hành chốt đơn và thanh toán' },
        { label: 'Gợi ý món ăn kèm', action: 'SEND_MESSAGE', payload: `Gợi ý món ăn kèm với ${product.name}` },
      ],
    };
  }

  /**
   * Đối chiếu & xác thực toàn bộ giỏ hàng trực tiếp với Database phía Backend (Zero-Trust Client Cart)
   * Không bao giờ tin giá món hoặc giá topping do AI / Frontend gửi lên.
   */
  private async reconcileCartWithDatabase(
    ctx: ChatSessionContext,
    branchId?: string,
  ): Promise<{ errorResult: ChatbotToolResult | null; priceChanged: boolean; taxMap: Map<string, number> }> {
    const taxMap = new Map<string, number>();
    if (!ctx.cart || ctx.cart.length === 0) {
      return { errorResult: null, priceChanged: false, taxMap };
    }

    const effectiveBranchId = branchId || ctx.currentBranchId;
    const cartProductIds = ctx.cart.map((item) => item.productId).filter(Boolean);
    const cartDbProducts =
      (await this.prisma.product.findMany({
        where: { id: { in: cartProductIds } },
        include: {
          branches: { select: { id: true, name: true } },
          optionGroups: {
            include: { optionItems: true },
          },
          FlashSaleItem: {
            where: {
              flashSale: { status: 'ACTIVE', startTime: { lte: new Date() }, endTime: { gte: new Date() } },
            },
            include: { flashSale: true },
          },
        },
      })) || [];

    const cartDbMap = new Map(cartDbProducts.map((p) => [p.id, p]));
    let priceChanged = false;

    for (const item of ctx.cart) {
      const dbProd = cartDbMap.get(item.productId);
      if (!dbProd) {
        return {
          errorResult: {
            success: false,
            code: 'PRODUCT_NOT_FOUND',
            message: `Món [${item.productName || item.productId}] không tồn tại trong thực đơn của nhà hàng. Vui lòng chọn món khác nhé!`,
          },
          priceChanged: false,
          taxMap,
        };
      }
      if (!dbProd.available) {
        return {
          errorResult: {
            success: false,
            code: 'PRODUCT_OUT_OF_STOCK',
            message: `Món [${dbProd.name}] hiện đang tạm hết hàng tại nhà hàng. Vui lòng bớt món này khỏi giỏ hàng trước khi đặt nhé!`,
          },
          priceChanged: false,
          taxMap,
        };
      }
      if (effectiveBranchId && dbProd.branches && dbProd.branches.length > 0) {
        const branchIds = dbProd.branches.map((b: any) => b.id);
        if (!branchIds.includes(effectiveBranchId)) {
          return {
            errorResult: {
              success: false,
              code: 'CART_BRANCH_CONFLICT',
              message: `Món [${dbProd.name}] không phục vụ tại chi nhánh đang chọn. Vui lòng đổi chi nhánh hoặc chọn món khác nhé!`,
            },
            priceChanged: false,
            taxMap,
          };
        }
      }

      taxMap.set(dbProd.id, Number((dbProd as any).taxPercentage || 0));

      const now = new Date();
      const activeFs = dbProd.FlashSaleItem?.find(
        (fs: any) => fs.flashSale.startTime <= now && fs.flashSale.endTime >= now && fs.stock > fs.sold,
      );
      const serverBasePrice = Number(activeFs ? activeFs.flashSalePrice : dbProd.price);

      // Xác minh giá topping / option từ Database nếu món có optionGroups trong DB
      const dbOptionMap = new Map<string, { name: string; priceAdjustment: number; available: boolean }>();
      for (const og of (dbProd as any).optionGroups || []) {
        for (const oi of og.optionItems || og.options || []) {
          dbOptionMap.set(oi.id, {
            name: oi.name,
            priceAdjustment: Number(oi.priceAdjustment || 0),
            available: oi.available !== false,
          });
        }
      }

      let optionsExtra = 0;
      for (const o of item.selectedOptions || []) {
        const optId = o.optionItemId || (o as any).itemId || (o as any).id;
        const dbOpt = optId ? dbOptionMap.get(optId) : undefined;
        if (dbOpt) {
          if (!dbOpt.available) {
            return {
              errorResult: {
                success: false,
                code: 'OPTION_OUT_OF_STOCK',
                message: `Tùy chọn [${dbOpt.name}] của món [${dbProd.name}] hiện đang tạm hết. Vui lòng chọn tùy chọn khác nhé!`,
              },
              priceChanged: false,
              taxMap,
            };
          }
          o.optionItemId = optId;
          o.optionItemName = dbOpt.name;
          (o as any).priceAdjustment = dbOpt.priceAdjustment;
          (o as any).extraPrice = dbOpt.priceAdjustment;
          optionsExtra += dbOpt.priceAdjustment;
        } else if (dbOptionMap.size === 0) {
          // Fallback chỉ khi mock/sản phẩm không khai báo optionGroups
          optionsExtra += Number((o as any).priceAdjustment || (o as any).extraPrice || 0);
        }
      }

      const verifiedPriceAtSale = serverBasePrice + optionsExtra;
      if (
        typeof item.priceAtSale === 'number' &&
        item.priceAtSale > 0 &&
        item.priceAtSale !== verifiedPriceAtSale
      ) {
        priceChanged = true;
      }

      item.basePrice = serverBasePrice;
      item.priceAtSale = verifiedPriceAtSale;
      item.productName = dbProd.name;
    }

    return { errorResult: null, priceChanged, taxMap };
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

    if (ctx.cart.length > 0) {
      const { errorResult } = await this.reconcileCartWithDatabase(ctx, ctx.currentBranchId);
      if (errorResult) return errorResult;
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
    if (ctx.cart && ctx.cart.length > 0) {
      const { errorResult } = await this.reconcileCartWithDatabase(ctx, ctx.currentBranchId);
      if (errorResult) return errorResult;
    }

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
        suggestedReplies: ['📍 Chia sẻ vị trí của tôi'],
        content: 'Bạn chưa có địa chỉ giao hàng trong sổ địa chỉ. Bạn vui lòng bấm nút **"📍 Chia sẻ vị trí của tôi"** bên dưới để Avora tự động định vị địa chỉ và tính phí giao hàng chính xác nhất cho bạn nhé!',
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
        suggestedReplies: ['📍 Chia sẻ vị trí của tôi'],
        message: 'Không tìm thấy địa chỉ này. Vui lòng bấm nút chia sẻ vị trí để tiếp tục.',
        content: 'Avora chưa xác định được địa chỉ của bạn. Bạn vui lòng bấm nút **"📍 Chia sẻ vị trí của tôi"** bên dưới để hệ thống tự động định vị và tính phí giao hàng chính xác nhé!',
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

  private async toolRequestDeliveryLocation(
    args: ChatbotToolArgsMap['requestDeliveryLocation'],
    ctx: ChatSessionContext,
  ): Promise<ChatbotToolResult> {
    return {
      success: true,
      code: 'REQUEST_LOCATION',
      actionType: 'REQUEST_LOCATION',
      actionPayload: JSON.stringify({ reason: 'DELIVERY_ADDRESS', subReason: args?.reason || 'CHANGE_ADDRESS', isDeliveryAddress: true }),
      suggestedReplies: ['📍 Chia sẻ vị trí của tôi', 'Nhập địa chỉ giao hàng'],
      message: 'Vui lòng cung cấp vị trí giao hàng để tiếp tục.',
      content: 'Bạn vui lòng bấm nút **"📍 Chia sẻ vị trí của tôi"** bên dưới hoặc nhập số nhà, tên đường để Avora xác định chi nhánh và tính phí giao hàng chính xác cho bạn nhé!',
    };
  }

  private async toolGetAvailableOrderSlots(args: ChatbotToolArgsMap['getAvailableOrderSlots'], ctx: ChatSessionContext): Promise<ChatbotToolResult> {
    let effectiveBranchId = args.branchId || ctx.currentBranchId;
    if (!effectiveBranchId || effectiveBranchId === 'undefined') {
      const defaultBranch = (await this.prisma.branch.findFirst({
        where: { onlineOrderingEnabled: true },
        orderBy: { createdAt: 'asc' },
      })) || (await this.prisma.branch.findFirst());
      effectiveBranchId = defaultBranch?.id;
      if (effectiveBranchId) {
        ctx.currentBranchId = effectiveBranchId;
      }
    }
    if (!effectiveBranchId) {
      const defaultBranch = await this.prisma.branch.findFirst({
        where: { onlineOrderingEnabled: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (defaultBranch) {
        effectiveBranchId = defaultBranch.id;
        ctx.currentBranchId = defaultBranch.id;
      }
    }
    if (!effectiveBranchId) {
      return { success: false, code: 'BRANCH_REQUIRED', message: 'Vui lòng chọn chi nhánh trước khi lấy khung giờ.' };
    }

    const branch = await this.prisma.branch.findUnique({ where: { id: effectiveBranchId } });
    let dateStr = normalizeDateToYYYYMMDD(args.date);
    const isTakeaway = args.orderType === 'TAKE_AWAY' || args.orderType === 'TAKEAWAY' || ctx.fulfillmentType === 'TAKEAWAY' || ctx.fulfillmentType === 'TAKE_AWAY';
    const orderType = isTakeaway ? 'TAKEAWAY' : 'DELIVERY';

    let slots = await this.operatingSlotService.getSlotsForDate({
      branchId: effectiveBranchId,
      dateStr,
      orderType: orderType as any,
    });

    let openSlots = slots.filter((s) => s.isAvailable);

    // Nếu hôm nay đã hết khung giờ khả dụng (đặt muộn), tự động tìm khung giờ ngày mai
    const todayStr = normalizeDateToYYYYMMDD();
    if (openSlots.length === 0 && dateStr === todayStr) {
      const tomorrowStr = normalizeDateToYYYYMMDD('tomorrow');
      const tomorrowSlots = await this.operatingSlotService.getSlotsForDate({
        branchId: effectiveBranchId,
        dateStr: tomorrowStr,
        orderType: orderType as any,
      });
      const openTomorrow = tomorrowSlots.filter((s) => s.isAvailable);
      if (openTomorrow.length > 0) {
        slots = tomorrowSlots;
        openSlots = openTomorrow;
        dateStr = tomorrowStr;
      }
    }

    let displaySlots: any[] = [...openSlots];
    if (displaySlots.length === 0) {
      // BẮT BUỘC lấy từ bảng OperatingSlot trong database, KHÔNG ĐƯỢC TỰ BỊA GIỜ
      const realDbSlots = await this.prisma.operatingSlot.findMany({
        where: {
          branchId: effectiveBranchId,
          orderType: orderType as any,
          isActive: true,
        },
        orderBy: { startTime: 'asc' },
      });

      if (realDbSlots.length > 0) {
        displaySlots = realDbSlots.map((s) => ({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          isAvailable: true,
          name: s.startTime === '00:00' && s.endTime === '23:59' ? (isTakeaway ? 'Nhận tại quầy trong ngày' : 'Giao ngay trong ngày (00:00 - 23:59)') : `${s.startTime} - ${s.endTime}`,
          leadTimeMinutes: s.leadTimeMinutes,
          orderType: s.orderType,
          isAsap: s.startTime === '00:00' && s.endTime === '23:59',
        }));
      } else {
        const anySlots = await this.prisma.operatingSlot.findMany({
          where: { branchId: effectiveBranchId, isActive: true },
          orderBy: { startTime: 'asc' },
        });
        if (anySlots.length > 0) {
          displaySlots = anySlots.map((s) => ({
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            isAvailable: true,
            name: `${s.startTime} - ${s.endTime}`,
            leadTimeMinutes: s.leadTimeMinutes,
            orderType: s.orderType,
            isAsap: false,
          }));
        }
      }
    }

    // Tự động khớp và chọn slot nếu khách nói giờ cụ thể hoặc yêu cầu giao sớm/giao ngay
    let selectedSlot: any = null;
    if (args.requestedTime) {
      selectedSlot = this.matchClosestSlot(args.requestedTime, displaySlots);
    }
    if (!selectedSlot && displaySlots.length > 0) {
      selectedSlot = displaySlots[0];
    }
    if (!selectedSlot) {
      const fallbackDbSlot = await this.prisma.operatingSlot.findFirst({
        where: { branchId: effectiveBranchId, isActive: true },
        orderBy: { startTime: 'asc' },
      });
      if (fallbackDbSlot) {
        selectedSlot = {
          id: fallbackDbSlot.id,
          startTime: fallbackDbSlot.startTime,
          endTime: fallbackDbSlot.endTime,
          isAvailable: true,
          name: `${fallbackDbSlot.startTime} - ${fallbackDbSlot.endTime}`,
          leadTimeMinutes: fallbackDbSlot.leadTimeMinutes,
          orderType: fallbackDbSlot.orderType,
          isAsap: false,
        };
        displaySlots = [selectedSlot];
      }
    }

    if (selectedSlot) {
      ctx.operatingSlotId = selectedSlot.id;
      ctx.deliveryDate = dateStr;
      ctx.scheduledTime = `${selectedSlot.startTime} - ${selectedSlot.endTime}`;
      ctx.deliverySlotTime = selectedSlot.name || `${selectedSlot.startTime} - ${selectedSlot.endTime}`;

      const branchDisplay = branch?.name || 'Avora Restaurant';
      return {
        success: true,
        code: 'ORDER_SLOT_SELECTED',
        message: `Đã chọn khung giờ ${selectedSlot.startTime} - ${selectedSlot.endTime} cho ngày ${dateStr}.`,
        data: {
          selectedSlot,
          slots: displaySlots,
          date: dateStr,
          orderType,
          branchName: branchDisplay,
        },
        actionType: 'SELECT_ORDER_SLOT',
        actionPayload: JSON.stringify({
          selectedSlot,
          slots: displaySlots,
          date: dateStr,
          orderType,
          branchId: effectiveBranchId,
          branchName: branchDisplay,
        }),
        suggestedReplies: [
          `Xác nhận: ${selectedSlot.startTime} - ${selectedSlot.endTime}`,
          '⚡ Giao ngay (ASAP)',
          'Chọn khung giờ khác',
        ],
        content: `Dạ hệ thống đã chọn khung giờ **${selectedSlot.startTime} - ${selectedSlot.endTime}** (ngày ${dateStr}, từ chi nhánh ${branchDisplay}). Bạn có muốn đổi khung giờ nào khác không ạ?`,
      };
    }

    return {
      success: true,
      code: 'ORDER_SLOTS_RETRIEVED',
      message: `Tìm thấy ${displaySlots.length} khung giờ khả dụng cho ngày ${dateStr}.`,
      data: { slots: displaySlots, date: dateStr, orderType, branchName: branch?.name },
      actionType: 'SELECT_ORDER_SLOT',
      actionPayload: JSON.stringify({
        slots: displaySlots,
        date: dateStr,
        orderType,
        branchId: effectiveBranchId,
        branchName: branch?.name,
      }),
      suggestedReplies: [
        '⚡ Giao ngay (ASAP)',
        ...displaySlots.slice(0, 3).map((s) => `Khung giờ ${s.startTime} - ${s.endTime}`),
      ],
      content: `Dạ nhà hàng có các khung giờ nhận đơn trong ngày ${dateStr}. Bạn có thể chọn nhanh khung giờ phù hợp trên màn hình hoặc báo giờ bạn muốn nhận nhé!`,
    };
  }

  // =========================================================================
  // 5. VOUCHER & ĐIỂM THÀNH VIÊN
  // =========================================================================

  private async toolFindApplicableVouchers(args: ChatbotToolArgsMap['findApplicableVouchers'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    const now = new Date();
    let effectiveBranchId = args.branchId || ctx.currentBranchId;
    let branchNameDisplay = '';
    if (args.branchId) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.branchId);
      if (!isUUID) {
        const foundBranch = await this.prisma.branch.findFirst({
          where: {
            OR: [
              { name: { contains: args.branchId } },
              { branchCode: { equals: args.branchId } },
            ],
          },
          select: { id: true, name: true },
        });
        if (foundBranch) {
          effectiveBranchId = foundBranch.id;
          branchNameDisplay = foundBranch.name;
        }
      }
    }

    const pricingItems = (ctx.cart || []).map((item) => ({
      productId: item.productId,
      name: item.productName,
      priceAtSale: item.priceAtSale,
      originalPriceAtSale: item.basePrice,
      quantity: item.quantity,
    }));
    const basePricing = await this.orderPricingService.calculatePricing({ items: pricingItems });
    const cartTotal = typeof args.orderValue === 'number' && args.orderValue > 0
      ? args.orderValue
      : (basePricing.subTotal > 0 ? basePricing.subTotal : (args.orderValue || 0));

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
        OR: [
          effectiveBranchId ? { branches: { some: { id: effectiveBranchId } } } : {},
          { branches: { none: {} } },
        ],
      },
      include: { membershipTiers: true },
    });

    const foodVouchers: any[] = [];
    const shippingVouchers: any[] = [];

    for (const v of vouchers as any[]) {
      const isUsageOk = v.usageLimit === null || v.usedCount < v.usageLimit;
      const isMinOk = cartTotal > 0 ? v.minOrderValue <= cartTotal : true;
      const isTierOk = !v.membershipTiers || v.membershipTiers.length === 0 || (user && v.membershipTiers.some((t: any) => t.id === user.membershipTierId));
      const eligibility = await this.orderService.validateVoucherForChatbot({
        code: v.code,
        subTotal: cartTotal || 100000,
        shippingFee: 0,
        branchId: effectiveBranchId,
        userId,
        isShippingVoucher: v.discountType === 'FREE_SHIP',
      });

      const isEligible = eligibility.isValid && isUsageOk && isMinOk && isTierOk;
      const reason = !isMinOk
        ? `Cần mua thêm ${(v.minOrderValue - cartTotal).toLocaleString('vi-VN')}đ (đơn tối thiểu ${v.minOrderValue.toLocaleString('vi-VN')}đ)`
        : !isTierOk
        ? 'Chưa đủ hạng thẻ thành viên'
        : 'Đủ điều kiện áp dụng';

      const vInfo = {
        code: v.code,
        title: v.title,
        description: v.description,
        discountType: v.discountType,
        discountValue: v.discountValue,
        maxDiscount: v.maxDiscount,
        minOrderValue: v.minOrderValue,
        isEligible,
        reason,
      };

      if (v.discountType === 'FREE_SHIP') {
        shippingVouchers.push(vInfo);
      } else {
        foodVouchers.push(vInfo);
      }
    }

    const voucherSuggestions: (string | ChatbotSuggestion)[] = [];
    const bestEligible = foodVouchers.find((v) => v.isEligible) || shippingVouchers.find((v) => v.isEligible);
    if (bestEligible) {
      voucherSuggestions.push({
        label: `Áp dụng mã ${bestEligible.code}`,
        action: 'SEND_MESSAGE',
        payload: `Áp dụng voucher ${bestEligible.code} cho đơn của tôi`,
      });
    }
    voucherSuggestions.push({
      label: 'Xem trang ưu đãi',
      action: 'SEND_MESSAGE',
      payload: 'Cho tôi xem chi tiết ưu đãi và khuyến mãi hôm nay',
    });

    let contentText = `Dạ ${cartTotal > 0 ? `với giá trị đơn hàng **${cartTotal.toLocaleString('vi-VN')}đ**` : 'về chương trình ưu đãi'}${branchNameDisplay ? ` tại chi nhánh **${branchNameDisplay}**` : ''}, hệ thống có các voucher thực tế như sau:\n\n`;
    if (foodVouchers.length > 0) {
      contentText += `**Voucher giảm giá món:**\n`;
      foodVouchers.forEach(v => {
        const discountDesc = v.discountType === 'PERCENTAGE'
          ? `Giảm ${v.discountValue}% (tối đa ${(v.maxDiscount || 0).toLocaleString('vi-VN')}đ)`
          : `Giảm thẳng ${v.discountValue.toLocaleString('vi-VN')}đ`;
        contentText += `*   Mã **${v.code}** - ${v.title}: ${discountDesc}. ${v.reason}.\n`;
      });
    }
    if (shippingVouchers.length > 0) {
      contentText += `\n**Voucher miễn phí vận chuyển:**\n`;
      shippingVouchers.forEach(v => {
        contentText += `*   Mã **${v.code}** - ${v.title}: Giảm phí giao hàng ${v.discountValue.toLocaleString('vi-VN')}đ. ${v.reason}.\n`;
      });
    }
    contentText += `\nQuý khách có thể xem thêm tất cả ưu đãi tại trang [Danh sách ưu đãi](/vouchers) nhé!`;

    return {
      success: true,
      code: 'VOUCHERS_FOUND',
      message: `Tìm thấy ${foodVouchers.length} voucher món và ${shippingVouchers.length} voucher freeship.`,
      data: { foodVouchers, shippingVouchers, cartTotal, branchId: effectiveBranchId },
      actionType: 'SHOW_VOUCHERS',
      actionPayload: JSON.stringify({ foodVouchers, shippingVouchers }),
      suggestedReplies: voucherSuggestions.slice(0, 3),
      content: contentText,
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
    if (args.deliveryDate) {
      const normDate = normalizeDateToYYYYMMDD(args.deliveryDate);
      if (ctx.deliveryDate !== normDate) {
        ctx.deliveryDate = normDate;
        ctx.operatingSlotId = undefined;
      }
    }
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
          suggestedReplies: ['📍 Chia sẻ vị trí của tôi'],
          message: 'Vui lòng cung cấp địa chỉ nhận hàng trước khi xem trước đơn giao hàng.',
          content: 'Bạn ơi, đơn hàng giao tận nơi cần có địa chỉ nhận hàng. Bạn vui lòng bấm nút **"📍 Chia sẻ vị trí của tôi"** bên dưới để Avora tự động tính phí ship nhé!',
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
      let openSlot: any = slots.find((s) => s.isAvailable);
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

      if (!openSlot) {
        openSlot =
          (await this.prisma.operatingSlot.findFirst({
            where: { branchId: branch.id, orderType: slotType, isActive: true },
            orderBy: { startTime: 'asc' },
          })) ||
          (await this.prisma.operatingSlot.findFirst({
            where: { branchId: branch.id, isActive: true },
            orderBy: { startTime: 'asc' },
          }));
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

    // Đối chiếu & xác thực toàn bộ giá bán, trạng thái tồn kho, chi nhánh phục vụ và topping từ Database phía Server trước khi tính phí ship & tổng tiền
    const { errorResult: reconcileError, taxMap: cartTaxMap } = await this.reconcileCartWithDatabase(ctx, branch.id);
    if (reconcileError) return reconcileError;

    // Tính phí vận chuyển: Nếu là TAKEAWAY -> Phí ship luôn luôn = 0đ
    let shippingFee = 0;
    let shippingDiscount = 0;
    const isTakeaway = fulfillmentType === 'TAKE_AWAY' || fulfillmentType === 'TAKEAWAY';

    if (isTakeaway) {
      shippingFee = 0;
      shippingDiscount = 0;
      if (!ctx.deliveryAddressSummary) {
        ctx.deliveryAddressSummary = `[Nhận tại quán] Chi nhánh ${branch.name} (${branch.street || ''}, ${branch.ward || ''})`;
      }
    } else if (fulfillmentType === 'DELIVERY' && address) {
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

    const pricingItems = ctx.cart.map((item) => ({
      productId: item.productId,
      name: item.productName,
      priceAtSale: item.priceAtSale,
      originalPriceAtSale: item.basePrice,
      quantity: item.quantity,
      taxPercentage: cartTaxMap.get(item.productId) || 0,
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
    let autoVoucherNote = '';
    const now = new Date();

    // Tự động tìm voucher món hời nhất nếu khách chưa truyền mã voucher
    if (!ctx.discountVoucherCode) {
      try {
        const candidateVouchers = await this.prisma.voucher.findMany({
          where: {
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
            discountType: { not: 'FREE_SHIP' },
            minOrderValue: { lte: basePricing.subTotal },
          },
        });
        let bestVoucher: any = null;
        let maxDiscount = 0;
        for (const v of candidateVouchers) {
          let discount = 0;
          if (v.discountType === 'PERCENTAGE') {
            discount = (basePricing.subTotal * v.discountValue) / 100;
            if (v.maxDiscount) discount = Math.min(discount, v.maxDiscount);
          } else {
            discount = v.discountValue;
          }
          if (discount > maxDiscount) {
            maxDiscount = discount;
            bestVoucher = v;
          }
        }
        if (bestVoucher && maxDiscount > 0) {
          ctx.discountVoucherCode = bestVoucher.code;
          orderDiscountAmount = maxDiscount;
          autoVoucherNote += ` (Đã tự động áp dụng mã giảm giá tốt nhất ${bestVoucher.code} - giảm ${maxDiscount.toLocaleString('vi-VN')}đ)`;
        }
      } catch (e) {
        this.logger.warn(`Failed to auto-find best discount voucher: ${(e as Error).message}`);
      }
    } else {
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

    // Tự động tìm voucher freeship hời nhất nếu đơn có phí ship và khách chưa truyền mã
    if (!ctx.shippingVoucherCode && shippingFee > 0 && !isTakeaway) {
      try {
        const candidateShippingVouchers = await this.prisma.voucher.findMany({
          where: {
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
            discountType: 'FREE_SHIP',
            code: { not: ctx.discountVoucherCode || '' },
            minOrderValue: { lte: basePricing.subTotal },
          },
        });
        let bestShipVoucher: any = null;
        let maxShipDiscount = 0;
        for (const v of candidateShippingVouchers) {
          let discount = 0;
          if (v.discountType === 'PERCENTAGE') {
            discount = (shippingFee * v.discountValue) / 100;
            if (v.maxDiscount) discount = Math.min(discount, v.maxDiscount);
          } else {
            discount = Math.min(shippingFee, v.discountValue);
          }
          if (discount > maxShipDiscount) {
            maxShipDiscount = discount;
            bestShipVoucher = v;
          }
        }
        if (bestShipVoucher && maxShipDiscount > 0) {
          ctx.shippingVoucherCode = bestShipVoucher.code;
          shippingDiscount = Math.max(shippingDiscount, maxShipDiscount);
          autoVoucherNote += ` (Đã tự động áp dụng mã freeship tốt nhất ${bestShipVoucher.code} - giảm ${maxShipDiscount.toLocaleString('vi-VN')}đ phí ship)`;
        }
      } catch (e) {
        this.logger.warn(`Failed to auto-find best shipping voucher: ${(e as Error).message}`);
      }
    } else if (ctx.shippingVoucherCode) {
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

    const pointRate = branch.pointRedeemRate || 1;
    const maxPercent = (branch as any).maxPointDiscountPercent !== undefined ? (branch as any).maxPointDiscountPercent : 20;

    if (args.usePoints === false || args.pointsToUse === 0) {
      (ctx as any).usePoints = false;
      ctx.pointsToUse = 0;
    } else if (args.usePoints === true) {
      (ctx as any).usePoints = true;
      if (userId && branch.allowDirectDiscount) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { currentPoints: true },
        });
        const userPoints = user?.currentPoints || 0;
        const maxDiscountAllowed = (basePricing.subTotal * maxPercent) / 100;
        const maxPointsAllowed = Math.floor(maxDiscountAllowed / pointRate);
        ctx.pointsToUse = Math.max(0, Math.min(userPoints, maxPointsAllowed));
      }
    } else if (args.pointsToUse !== undefined) {
      const maxDiscountAllowed = (basePricing.subTotal * maxPercent) / 100;
      const maxPointsAllowed = Math.floor(maxDiscountAllowed / pointRate);
      ctx.pointsToUse = Math.max(0, Math.min(args.pointsToUse, maxPointsAllowed));
      (ctx as any).usePoints = ctx.pointsToUse > 0;
    } else if ((ctx as any).usePoints && userId && branch.allowDirectDiscount) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { currentPoints: true },
      });
      const userPoints = user?.currentPoints || 0;
      const maxDiscountAllowed = (basePricing.subTotal * maxPercent) / 100;
      const maxPointsAllowed = Math.floor(maxDiscountAllowed / pointRate);
      ctx.pointsToUse = Math.max(0, Math.min(userPoints, maxPointsAllowed));
    } else {
      ctx.pointsToUse = 0;
    }

    const pricing = await this.orderPricingService.calculatePricing({
      items: pricingItems,
      orderDiscountAmount,
      shippingFee,
      shippingDiscount,
      pointsDiscount: (ctx.pointsToUse || 0) * pointRate,
    });

    // Lấy phương thức thanh toán động từ Database (giống bên /checkout)
    const activePaymentMethodsRaw = await this.paymentMethodService.getActiveMethods(pricing.totalAmount, branch.id);
    const availablePaymentMethods = activePaymentMethodsRaw
      .filter((m) => m.isEligible)
      .map((m) => ({
        code: m.code,
        name: m.name,
        type: m.type,
        description: m.description,
        instructionNote: (m as any).instructionNote || m.description,
        minOrderValue: (m as any).minOrderValue || 0,
      }));

    if (availablePaymentMethods.length > 0 && (!ctx.paymentMethod || !availablePaymentMethods.some((m) => m.code === ctx.paymentMethod))) {
      ctx.paymentMethod = availablePaymentMethods[0].code;
    }

    const previewData = {
      items: ctx.cart,
      subTotal: pricing.subTotal,
      discountAmount: pricing.discountAmount,
      shippingFee: pricing.shippingFeeFinal,
      pointsDiscount: pricing.pointsDiscount,
      pointsUsed: ctx.pointsToUse || 0,
      maxPointDiscountPercent: maxPercent,
      taxAmount: pricing.taxAmount,
      totalAmount: pricing.totalAmount,
      branchName: branch.name,
      fulfillmentType,
      deliveryAddress: address ? `${address.streetDetail}, ${address.ward}, ${address.province}` : null,
      deliverySlotTime: ctx.deliverySlotTime || 'Giao sớm nhất',
      paymentMethod: ctx.paymentMethod || 'COD',
      availablePaymentMethods,
      discountVoucherCode: ctx.discountVoucherCode,
      shippingVoucherCode: ctx.shippingVoucherCode,
    };
    ctx.expectedTotalAmount = pricing.totalAmount;
    const confirmation = this.createConfirmation(this.orderConfirmationPayload(ctx));
    ctx.orderConfirmation = confirmation.state;
    ctx.lastIdempotencyKey = crypto.randomUUID();

    const paymentMethodName = availablePaymentMethods.find((m) => m.code === ctx.paymentMethod)?.name || ctx.paymentMethod || 'COD';

    return {
      success: true,
      code: 'ORDER_PREVIEW_READY',
      message: `Bản xem trước đơn hàng: Tổng thanh toán ${pricing.totalAmount.toLocaleString('vi-VN')}đ`,
      data: previewData,
      actionType: 'ORDER_PREVIEW',
      actionPayload: JSON.stringify({ ...previewData, previewToken: confirmation.previewToken }),
      content: `Đơn hàng của bạn gồm ${ctx.cart.length} món, tổng thanh toán là ${pricing.totalAmount.toLocaleString('vi-VN')}đ (đã gồm VAT, phí ship${autoVoucherNote}${ctx.pointsToUse && ctx.pointsToUse > 0 ? `, đã áp dụng giảm ${(ctx.pointsToUse * pointRate).toLocaleString('vi-VN')}đ từ ${ctx.pointsToUse} điểm tích lũy` : ', không dùng điểm tích lũy'}). Phương thức thanh toán đang chọn: [${paymentMethodName}]. Bạn có thể chọn đổi phương thức thanh toán ngay bên dưới hoặc xác nhận đặt đơn hàng nhé!`,
      suggestedReplies: ['Xác nhận đặt đơn', 'Đổi phương thức thanh toán', 'Thêm món khác'],
      requiresConfirmation: true,
    };
  }

  private async toolPlaceOrder(args: ChatbotToolArgsMap['placeOrder'], ctx: ChatSessionContext, userId?: string): Promise<ChatbotToolResult> {
    // If confirmation is not yet marked confirmed, auto-confirm it since placeOrder was explicitly requested
    if (!ctx.orderConfirmation || ctx.orderConfirmation.status !== 'CONFIRMED') {
      const conf = this.createConfirmation(this.orderConfirmationPayload(ctx));
      ctx.orderConfirmation = {
        ...conf.state,
        status: 'CONFIRMED',
      };
    }

    if (!ctx.cart || ctx.cart.length === 0) {
      return { success: false, code: 'CART_EMPTY', message: 'Giỏ hàng đang trống, không thể tạo đơn.' };
    }

    const branchRecord = ctx.currentBranchId ? await this.prisma.branch.findUnique({ where: { id: ctx.currentBranchId } }) : await this.prisma.branch.findFirst({ where: { onlineOrderingEnabled: true } });
    const branchId = branchRecord?.id;
    const branchName = branchRecord?.name || "AVORA";
    if (!branchId) return { success: false, code: 'BRANCH_REQUIRED', message: 'Thiếu thông tin chi nhánh.' };

    // Xác minh lại toàn bộ sản phẩm, tồn kho, chi nhánh và giá bán trực tiếp từ Database trước khi tạo đơn
    const { errorResult: placeReconcileErr, priceChanged } = await this.reconcileCartWithDatabase(ctx, branchId);
    if (placeReconcileErr) return placeReconcileErr;

    if (priceChanged && ctx.expectedTotalAmount !== undefined) {
      const newSubTotal = ctx.cart.reduce((s, it) => s + it.priceAtSale * it.quantity, 0);
      ctx.expectedTotalAmount = newSubTotal;
      const confirmation = this.createConfirmation(this.orderConfirmationPayload(ctx));
      ctx.orderConfirmation = confirmation.state;
      return {
        success: false,
        code: 'CHECKOUT_CHANGED',
        recoverable: true,
        message: `Đơn hàng vừa có cập nhật lại giá từ hệ thống (${newSubTotal.toLocaleString('vi-VN')}đ). Bạn có đồng ý tiếp tục đặt đơn với mức giá thực tế mới này không ạ?`,
        data: { newTotal: newSubTotal, items: ctx.cart, previewToken: confirmation.previewToken },
        suggestedReplies: ['Tôi đồng ý đặt với giá mới', 'Hủy đơn hàng'],
        requiresConfirmation: true,
      };
    }

    if (!ctx.operatingSlotId || !ctx.deliveryDate) {
      const isTakeaway = ctx.fulfillmentType === 'TAKE_AWAY' || ctx.fulfillmentType === 'TAKEAWAY';
      const fallbackSlot =
        (await this.prisma.operatingSlot.findFirst({
          where: { branchId, orderType: isTakeaway ? 'TAKEAWAY' : 'DELIVERY', isActive: true },
          orderBy: { startTime: 'asc' },
        })) ||
        (await this.prisma.operatingSlot.findFirst({
          where: { branchId, isActive: true },
          orderBy: { startTime: 'asc' },
        }));

      if (fallbackSlot) {
        ctx.operatingSlotId = fallbackSlot.id;
        ctx.deliveryDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
      }
    }

    if (args.paymentMethod) ctx.paymentMethod = args.paymentMethod;
    let paymentMethod = ctx.paymentMethod || 'COD';
    let norm = paymentMethod.toUpperCase().trim();
    if (norm === 'TRANSFER' || norm === 'SEPAY' || norm === 'CHUYEN_KHOAN') {
      paymentMethod = 'SEPAY_QR';
    }
    ctx.paymentMethod = paymentMethod;
    const idempotencyKey = ctx.lastIdempotencyKey || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Resolve effective user to guarantee valid database reference
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      let guestUser = await this.prisma.user.findFirst({
        where: { email: 'guest@avorafnb.com' },
      });
      if (!guestUser) {
        guestUser = await this.prisma.user.create({
          data: {
            email: 'guest@avorafnb.com',
            fullName: 'Khách Hàng',
            role: 'USER',
          },
        });
      }
      effectiveUserId = guestUser.id;
    }

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

    // Gọi atomic createOrder từ OrderService có xử lý khi giá hoặc điều kiện thay đổi
    let orderResult: any;
    try {
      orderResult = await this.orderService.createOrder(effectiveUserId, payload);
    } catch (err: any) {
      if (err.response?.error === 'CHECKOUT_CHANGED' || err.message?.includes('CHECKOUT_CHANGED')) {
        const newTotal = err.response?.newTotal || 0;
        ctx.expectedTotalAmount = newTotal;
        const confirmation = this.createConfirmation(this.orderConfirmationPayload(ctx));
        ctx.orderConfirmation = confirmation.state;
        return {
          success: false,
          code: 'CHECKOUT_CHANGED',
          recoverable: true,
          message: `Đơn hàng vừa có cập nhật lại giá hoặc ưu đãi từ hệ thống. Tổng thanh toán mới là ${newTotal.toLocaleString('vi-VN')}đ. Bạn có đồng ý tiếp tục đặt đơn với số tiền mới này không ạ?`,
          data: { newTotal, previewToken: confirmation.previewToken },
          suggestedReplies: ['Tôi đồng ý đặt với giá mới', 'Hủy đơn hàng'],
          requiresConfirmation: true,
        };
      }
      throw err;
    }
    const createdOrder = await this.prisma.order.findUnique({
      where: { id: orderResult.orderId },
    });
    const orderTotal = createdOrder?.totalAmount || 0;
    const orderStatus = createdOrder?.status || 'PENDING';
    const finalOrderCode = createdOrder?.orderCode || orderResult.orderCode;

    // Lưu mã đơn hàng vừa tạo vào context của phiên chat
    ctx.lastCreatedOrderCode = finalOrderCode;

    // Xóa cart trong session sau khi đã đặt thành công
    ctx.cart = [];
    ctx.discountVoucherCode = undefined;
    ctx.shippingVoucherCode = undefined;
    ctx.pointsToUse = 0;
    if (ctx.orderConfirmation) {
      ctx.orderConfirmation.status = 'COMMITTED';
    }

    const isSepayMethod = paymentMethod === 'SEPAY' || paymentMethod === 'TRANSFER' || paymentMethod === 'SEPAY_QR' || paymentMethod.includes('SEPAY');
    const redirectUrl = isSepayMethod
      ? `https://avorafnb.com/payment/sepay?orderCode=${finalOrderCode}`
      : undefined;

    const pointsDeducted = createdOrder?.pointsUsed || 0;
    const pointsNote = pointsDeducted > 0
      ? ` (đã trừ chính xác ${pointsDeducted.toLocaleString('vi-VN')} điểm tích lũy)`
      : ` (không sử dụng điểm tích lũy)`;

    return {
      success: true,
      code: 'ORDER_PLACED_SUCCESS',
      message: `Đặt hàng thành công! Mã đơn hàng của bạn là [${finalOrderCode}].`,
      data: {
        orderCode: finalOrderCode,
        totalAmount: orderTotal,
        status: orderStatus,
        paymentMethod,
        isSepay: isSepayMethod,
        redirectUrl,
        pointsUsed: pointsDeducted,
      },
      actionType: 'SHOW_ORDER_SUCCESS',
      actionPayload: JSON.stringify({
        orderCode: finalOrderCode,
        totalAmount: orderTotal,
        paymentMethod,
        isSepay: isSepayMethod,
        redirectUrl,
        pointsUsed: pointsDeducted,
      }),
      content: isSepayMethod
        ? `Đơn hàng [${finalOrderCode}] đã được ghi nhận thành công với tổng thanh toán ${orderTotal.toLocaleString('vi-VN')}đ${pointsNote}. Quý khách vui lòng quét mã QR chuyển khoản SePay để hệ thống xác nhận thanh toán. Ngay sau khi quý khách thanh toán thành công, bếp ${branchName} sẽ lập tức bắt đầu chế biến nóng sốt, đóng gói chỉn chu và giao tận nơi theo đúng lịch hẹn cho quý khách nhé!`
        : `Chúc mừng bạn! Đơn hàng [${finalOrderCode}] với tổng tiền ${orderTotal.toLocaleString('vi-VN')}đ${pointsNote} đã được tạo thành công. Bếp ${branchName} sẽ chuẩn bị nóng sốt và giao món đúng khung giờ cho bạn nhé!`,
    };
  }

  private async toolCheckOrder(args: ChatbotToolArgsMap['checkOrder'], userId?: string, ctx?: ChatSessionContext): Promise<ChatbotToolResult> {
    const targetOrderCode = args.orderCode?.trim() || ctx?.lastCreatedOrderCode;

    let order: any = null;
    if (targetOrderCode) {
      order = await this.prisma.order.findFirst({
        where: {
          orderCode: targetOrderCode,
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

  private async toolCancelOrder(args: ChatbotToolArgsMap['cancelOrder'], userId?: string, ctx?: ChatSessionContext): Promise<ChatbotToolResult> {
    let targetOrderCode = args.orderCode?.trim() || ctx?.lastCreatedOrderCode;

    if (!targetOrderCode && userId) {
      const recent = await this.prisma.order.findFirst({
        where: {
          userId,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { orderCode: true },
      });
      if (recent?.orderCode) targetOrderCode = recent.orderCode;
    }

    if (!targetOrderCode) {
      return { success: false, code: 'ORDER_CODE_REQUIRED', message: 'Vui lòng cung cấp mã đơn hàng cần hủy.' };
    }

    const orderToCancel = await this.prisma.order.findFirst({
      where: { orderCode: targetOrderCode },
      select: { id: true, userId: true, customerPhone: true, status: true },
    });

    if (!orderToCancel) {
      return { success: false, code: 'ORDER_NOT_FOUND', message: `Không tìm thấy đơn hàng [${targetOrderCode}].` };
    }

    if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(orderToCancel.status)) {
      return {
        success: false,
        code: 'CANNOT_CANCEL',
        message: `Đơn hàng [${targetOrderCode}] hiện đang ở trạng thái ${orderToCancel.status}, không thể hủy.`,
      };
    }

    const actor = userId
      ? { kind: 'USER' as const, userId }
      : { kind: 'GUEST' as const, phone: args.phone || orderToCancel.customerPhone || '0900000000' };

    const canceled = await this.orderService.cancelOrder(
      targetOrderCode,
      args.reason || 'Khách hủy qua chatbot',
      actor,
    );

    return {
      success: true,
      code: 'ORDER_CANCELED',
      message: `Đã hủy đơn hàng [${targetOrderCode}] thành công.`,
      data: { canceled },
      content: `Đơn hàng [${targetOrderCode}] đã được hủy thành công theo yêu cầu của bạn.`,
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
    let effectiveName = args.customerName || ctx.reservationDraft?.customerName;
    let effectivePhone = args.customerPhone || ctx.reservationDraft?.customerPhone;

    // Tận dụng thông tin user đăng nhập nếu khách chưa nhập tên hoặc SĐT
    if (userId && (!effectiveName || !effectivePhone)) {
      try {
        const userDb = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true, phone: true },
        });
        if (userDb) {
          if (!effectiveName && userDb.fullName) effectiveName = userDb.fullName;
          if (!effectivePhone && userDb.phone) effectivePhone = userDb.phone;
        }
      } catch (err) {
        this.logger.warn(`Could not fetch user profile for reservation preview: ${err}`);
      }
    }

    // Kiểm tra và cấm tuyệt đối các số điện thoại bịa đặt / dummy placeholder
    const isDummyPhone = (phone?: string) => {
      if (!phone) return true;
      const clean = phone.trim().replace(/\D/g, '');
      if (clean.length < 9 || clean.length > 12) return true;
      return /^(?:0{9,11}|0900000000|0123456789|0987654321|0901234567|0912345678|1234567890)$/.test(clean);
    };

    if (isDummyPhone(effectivePhone) || !effectiveName || effectiveName.trim().toLowerCase() === 'quý khách') {
      return {
        success: false,
        code: 'CUSTOMER_PHONE_REQUIRED',
        message: 'Dạ để nhà hàng giữ chỗ chu đáo và gửi mã xác nhận bàn, anh/chị vui lòng cho em xin Tên và Số điện thoại liên hệ nhé!',
        data: { missingFields: ['customerPhone', 'customerName'] },
        content: 'Dạ để nhà hàng giữ chỗ chu đáo và gửi mã xác nhận đặt bàn, anh/chị vui lòng cho em xin Tên và Số điện thoại liên hệ nhé!',
        suggestedReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn nhà hàng'],
        recoverable: true,
      };
    }

    const missingFields: string[] = [];
    if (!effectiveBranchId) missingFields.push('branch');
    if (!effectiveDate) missingFields.push('reservationDate');
    if (!effectiveTime) missingFields.push('reservationTime');
    if (!effectiveParty) missingFields.push('partySize');

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
    // Tự động đánh dấu xác nhận nếu khách đã bấm nút hoặc nhắn Xác nhận đặt bàn
    if (!ctx.reservationConfirmation || ctx.reservationConfirmation.status !== 'CONFIRMED') {
      const conf = this.createConfirmation(this.reservationConfirmationPayload(ctx));
      ctx.reservationConfirmation = {
        ...conf.state,
        status: 'CONFIRMED',
      };
    }

    const idempotencyKey = ctx.lastIdempotencyKey || crypto.randomUUID();
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
          actionType: 'SHOW_RESERVATION_SUCCESS',
          actionPayload: JSON.stringify({
            reservationId: existing.id,
            reservationCode: existing.reservationCode,
            startAt: existing.startAt,
            partySize: existing.partySize,
          }),
          content: `Đặt bàn [${existing.reservationCode}] của quý khách đã được ghi nhận trước đó! Quý khách có thể xem lại chi tiết hoặc đặt thêm món bất cứ lúc nào ạ.`,
        };
      }
    }

    const draft = ctx.reservationDraft || {};
    const branchId = draft.branchId || (args as any)?.branchId || ctx.currentBranchId;
    const reservationDate = draft.reservationDate || (args as any).reservationDate;
    const reservationTime = draft.reservationTime || (args as any).reservationTime;
    const partySize = Number(draft.partySize || (args as any).partySize || 2);
    let customerName = draft.customerName || (args as any).customerName;
    let customerPhone = draft.customerPhone || (args as any).customerPhone;

    if (userId && (!customerName || !customerPhone)) {
      try {
        const userDb = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true, phone: true },
        });
        if (userDb) {
          if (!customerName) customerName = userDb.fullName;
          if (!customerPhone) customerPhone = userDb.phone;
        }
      } catch (err) {
        this.logger.warn(`Could not fetch user profile for reservation creation: ${err}`);
      }
    }

    if (!customerPhone || /^(?:0{9,11}|0900000000|0123456789|0987654321)$/.test(customerPhone.trim())) {
      return {
        success: false,
        code: 'CUSTOMER_PHONE_REQUIRED',
        message: 'Dạ anh/chị cho em xin Tên và Số điện thoại để hoàn tất giữ bàn nhé!',
        content: 'Dạ để hoàn tất đặt bàn và gửi mã xác nhận, anh/chị vui lòng cho em xin Tên và Số điện thoại liên hệ nhé!',
      };
    }

    if (!branchId || !reservationDate || !reservationTime || !partySize || !customerName) {
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
    if (ctx.reservationConfirmation) {
      ctx.reservationConfirmation.status = 'COMMITTED';
    }

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
      actionType: 'SHOW_RESERVATION_SUCCESS',
      actionPayload: JSON.stringify({
        reservationId: created.id,
        reservationCode: created.reservationCode,
        branchName: draft.branchName,
        reservationDate,
        reservationTime,
        partySize,
        customerName,
        customerPhone,
        preOrderedItems: created.preOrderedItems || [],
        preOrderTotal: created.preOrderTotal || 0,
      }),
      content: `Quý khách đã đặt bàn thành công! Mã đặt bàn là [${created.reservationCode}] lúc ${reservationTime} ngày ${reservationDate} tại ${draft.branchName || 'nhà hàng'}. Avora rất hân hạnh được đón tiếp quý khách! Quý khách có thể xem chi tiết hoặc đặt thêm món trước cho bàn bất cứ lúc nào.`,
      suggestedReplies: ['Xem chi tiết đặt bàn', 'Thực đơn món ăn tại quán', 'Có ưu đãi gì hôm nay không?'],
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
