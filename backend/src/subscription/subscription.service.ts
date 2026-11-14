import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto, PauseSkipScheduleDto, ChooseScheduleDishDto } from './dto/create-subscription.dto';
import {
  SubscriptionStatus,
  DeliveryScheduleStatus,
  SubscriptionPlanType,
  SubscriptionMealSlot,
  OrderStatus,
  OrderSource,
  KitchenStatus,
} from '@prisma/client';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách các gói thuê bao bữa ăn đang mở bán
   */
  async getPlans() {
    return this.prisma.mealSubscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { basePrice: 'asc' },
    });
  }

  /**
   * Đăng ký gói thuê bao bữa ăn mới & tự động sinh lịch giao hàng cho toàn bộ chu kỳ
   */
  async subscribe(userId: string, dto: CreateSubscriptionDto) {
    const plan = await this.prisma.mealSubscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Gói thuê bao không tồn tại hoặc tạm ngưng phục vụ.');
    }

    // Đảm bảo userId luôn là một user hợp lệ trong DB, không để crash foreign key
    let validUserId = userId;
    let existingUser = validUserId && validUserId !== 'demo-user-id'
      ? await this.prisma.user.findUnique({ where: { id: validUserId } })
      : null;

    if (!existingUser && dto.recipientPhone) {
      existingUser = await this.prisma.user.findFirst({
        where: { phone: dto.recipientPhone },
      });
    }

    if (!existingUser) {
      try {
        const guestPhone = dto.recipientPhone || `guest_${Date.now()}`;
        const newUser = await this.prisma.user.create({
          data: {
            phone: guestPhone,
            email: `${guestPhone.replace(/[^a-zA-Z0-9]/g, '')}@avorafnb.com`,
            fullName: dto.recipientName || 'Khách hàng Thuê bao',
            role: 'USER',
          },
        });
        validUserId = newUser.id;
      } catch (err) {
        // Fallback sang bất kỳ user nào có sẵn trong DB
        const firstUser = await this.prisma.user.findFirst({ select: { id: true } });
        validUserId = firstUser ? firstUser.id : validUserId;
      }
    } else {
      validUserId = existingUser.id;
    }

    // 1. Xác định ngày bắt đầu (Mặc định là ngày làm việc tiếp theo)
    let start = dto.startDate ? new Date(dto.startDate) : new Date();
    start.setDate(start.getDate() + 1); // Bắt đầu từ ngày mai
    start.setHours(0, 0, 0, 0);

    // 2. Tính toán danh sách các ngày giao hàng (Bỏ qua T7, CN nếu là gói ngày làm việc)
    const isWorkdayOnly =
      plan.planType === SubscriptionPlanType.WEEKLY_5_DAYS ||
      plan.planType === SubscriptionPlanType.MONTHLY_20_DAYS;

    const deliveryDates: Date[] = [];
    const currDate = new Date(start);

    while (deliveryDates.length < plan.totalMeals) {
      const dayOfWeek = currDate.getDay(); // 0: CN, 6: T7
      if (!isWorkdayOnly || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        deliveryDates.push(new Date(currDate));
      }
      currDate.setDate(currDate.getDate() + 1);
    }

    const endDate = deliveryDates[deliveryDates.length - 1];

    // 2.5 Xác định chi nhánh phục vụ gần nhất và hợp lệ (Tránh lỗi Foreign Key và lỗi khoảng cách xuyên tỉnh)
    const allBranches = await this.prisma.branch.findMany({
      where: { onlineOrderingEnabled: true },
      select: { id: true, name: true, branchCode: true, latitude: true, longitude: true },
    });

    let targetBranchId = dto.branchId;
    let minDistanceKm = Infinity;
    let bestBranch = allBranches[0];

    if (dto.deliveryLatitude && dto.deliveryLongitude) {
      const R = 6371; // km
      for (const branch of allBranches) {
        if (branch.latitude && branch.longitude) {
          const dLat = (dto.deliveryLatitude - branch.latitude) * Math.PI / 180;
          const dLon = (dto.deliveryLongitude - branch.longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(branch.latitude * Math.PI / 180) * Math.cos(dto.deliveryLatitude * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = R * c;
          if (dist < minDistanceKm) {
            minDistanceKm = dist;
            bestBranch = branch;
          }
        }
      }
      targetBranchId = bestBranch?.id;
    } else if (targetBranchId) {
      const matched = allBranches.find(b => b.id === targetBranchId || b.branchCode === targetBranchId);
      if (matched) targetBranchId = matched.id;
      else targetBranchId = allBranches[0]?.id;
    } else {
      targetBranchId = allBranches[0]?.id;
    }

    // 2.6 Tính phí ship theo khoảng cách
    let extraDailyShippingFee = 0;
    if (minDistanceKm !== Infinity) {
      if (minDistanceKm > 15) {
        throw new BadRequestException(`Khoảng cách giao hàng (${minDistanceKm.toFixed(1)}km đến ${bestBranch?.name || 'nhà hàng'}) vượt quá bán kính phục vụ tối đa 15km của nhà hàng.`);
      } else if (minDistanceKm > 10) {
        extraDailyShippingFee = 20000;
      } else if (minDistanceKm > 7) {
        extraDailyShippingFee = 10000;
      } else if (minDistanceKm > 4) {
        extraDailyShippingFee = 5000;
      } else {
        extraDailyShippingFee = 0; // Freeship dưới 4km
      }
    }

    // 3. Chuẩn bị món gợi ý sẵn (Bestsellers) để gán cho các ngày nếu bật Auto-Surprise
    const bestSellers = await this.prisma.product.findMany({
      where: { available: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });

    const subscriptionCode = `SUB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const isPaidImmediately = dto.paymentMethod === 'COD';
    const initialStatus = isPaidImmediately ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING_PAYMENT;

    // 4. Tạo Subscription trong DB
    const subscription = await this.prisma.userMealSubscription.create({
      data: {
        subscriptionCode,
        userId: validUserId,
        planId: plan.id,
        status: initialStatus,
        mealSlot: dto.mealSlot || plan.mealSlot,
        branchId: targetBranchId!,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        deliveryAddress: dto.deliveryAddress,
        deliveryTimeSlot: dto.deliveryTimeSlot || (dto.mealSlot === SubscriptionMealSlot.DINNER ? '18:15' : '11:30'),
        deliveryNote: dto.deliveryNote || null,
        isAutoSurprise: dto.isAutoSurprise !== undefined ? dto.isAutoSurprise : true,
        dietaryPreferencesJson: dto.dietaryPreferences ? JSON.stringify(dto.dietaryPreferences) : '[]',
        dislikedIngredientIdsJson: dto.dislikedIngredientIds ? JSON.stringify(dto.dislikedIngredientIds) : '[]',
        startDate: deliveryDates[0],
        endDate,
        remainingMeals: plan.totalMeals,
        usedMeals: 0,
        autoRenew: true,
        schedules: {
          create: deliveryDates.map((date, idx) => {
            const assignedProduct = bestSellers.length > 0 ? bestSellers[idx % bestSellers.length] : null;
            return {
              deliveryDate: date,
              deliverySlot: dto.deliveryTimeSlot || (dto.mealSlot === SubscriptionMealSlot.DINNER ? '18:15' : '11:30'),
              status: DeliveryScheduleStatus.SCHEDULED,
              productId: assignedProduct ? assignedProduct.id : null,
            };
          }),
        },
      },
      include: {
        plan: true,
        schedules: {
          include: { product: true, customRecipe: true },
          orderBy: { deliveryDate: 'asc' },
        },
      },
    });

    return {
      success: true,
      message: `Đăng ký gói thuê bao [${plan.name}] thành công! Toàn bộ ${plan.totalMeals} bữa ăn đã được tự động lên lịch.`,
      subscription,
    };
  }

  /**
   * Lấy danh sách thuê bao của người dùng
   */
  async getMySubscriptions(userId?: string, phone?: string) {
    const orConds: any[] = [];
    if (userId && userId !== 'demo-user-id') {
      orConds.push({ userId });
    }
    if (phone && phone.trim()) {
      orConds.push({ recipientPhone: phone.trim() });
    }
    if (orConds.length === 0) {
      if (userId) orConds.push({ userId });
    }

    return this.prisma.userMealSubscription.findMany({
      where: orConds.length > 0 ? { OR: orConds } : {},
      include: {
        plan: true,
        schedules: {
          include: {
            product: { select: { id: true, name: true, imageUrl: true } },
            customRecipe: { select: { id: true, recipeName: true, coverImageUrl: true } },
          },
          orderBy: { deliveryDate: 'asc' },
        },
        _count: {
          select: { schedules: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lấy chi tiết lịch giao hàng của 1 thuê bao (Lịch 20/30 ngày)
   */
  async getSubscriptionDetails(idOrCode: string, userId?: string, userRole?: string) {
    const normCode = idOrCode.replace('_', '-');
    const altCode = idOrCode.replace('-', '_');

    const sub = await this.prisma.userMealSubscription.findFirst({
      where: {
        OR: [
          { id: idOrCode },
          { subscriptionCode: idOrCode },
          { subscriptionCode: normCode },
          { subscriptionCode: altCode },
        ],
      },
      include: {
        plan: true,
        user: { select: { id: true, fullName: true, phone: true, email: true } },
        schedules: {
          include: {
            product: {
              select: { id: true, name: true, price: true, imageUrl: true, category: true },
            },
            customRecipe: {
              select: { id: true, recipeCode: true, recipeName: true, totalPrice: true, coverImageUrl: true, totalCalories: true },
            },
            order: {
              select: { id: true, temporaryOrderCode: true, status: true, totalAmount: true },
            },
          },
          orderBy: { deliveryDate: 'asc' },
        },
      },
    });

    if (!sub) {
      throw new NotFoundException(`Không tìm thấy gói thuê bao ${idOrCode}`);
    }

    if (userId && userRole !== 'ADMIN' && sub.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem thông tin gói thuê bao của người khác.');
    }

    return sub;
  }

  /**
   * Tạm dừng bữa ăn 1 ngày (Pause / Skip) & Tự động gia hạn bù ngày cuối kỳ
   */
  async pauseOrSkipSchedule(scheduleId: string, userId?: string, dto?: PauseSkipScheduleDto, userRole?: string) {
    const schedule = await this.prisma.subscriptionDeliverySchedule.findUnique({
      where: { id: scheduleId },
      include: { subscription: { include: { plan: true } } },
    });

    if (!schedule) {
      throw new NotFoundException('Không tìm thấy lịch giao hàng.');
    }

    if (userId && userRole !== 'ADMIN' && schedule.subscription.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác lịch giao hàng này.');
    }

    const isResume = (dto as any)?.action === 'RESUME' || schedule.status === DeliveryScheduleStatus.PAUSED_SKIPPED;

    if (isResume) {
      await this.prisma.subscriptionDeliverySchedule.update({
        where: { id: scheduleId },
        data: {
          status: DeliveryScheduleStatus.SCHEDULED,
          pauseReason: null,
        },
      });
      return {
        success: true,
        message: `Đã kích hoạt lại bữa ăn ngày ${new Date(schedule.deliveryDate).toLocaleDateString('vi-VN')} thành công!`,
      };
    }

    if (schedule.status !== DeliveryScheduleStatus.SCHEDULED) {
      throw new BadRequestException('Chỉ có thể tạm hoãn các bữa ăn chưa bắt đầu chế biến.');
    }

    // 1. Chuyển trạng thái ngày này sang PAUSED_SKIPPED
    await this.prisma.subscriptionDeliverySchedule.update({
      where: { id: scheduleId },
      data: {
        status: DeliveryScheduleStatus.PAUSED_SKIPPED,
        pauseReason: dto?.reason || 'Khách tạm hoãn bữa ăn',
      },
    });

    // 2. Tìm ngày làm việc tiếp theo sau endDate của thuê bao để bù bữa ăn này (Bù kỳ thông minh)
    const isWorkdayOnly =
      schedule.subscription.plan.planType === SubscriptionPlanType.WEEKLY_5_DAYS ||
      schedule.subscription.plan.planType === SubscriptionPlanType.MONTHLY_20_DAYS;

    const newEnd = new Date(schedule.subscription.endDate);
    newEnd.setDate(newEnd.getDate() + 1);

    while (isWorkdayOnly && (newEnd.getDay() === 0 || newEnd.getDay() === 6)) {
      newEnd.setDate(newEnd.getDate() + 1);
    }

    // 3. Tạo một lịch bù mới vào cuối kỳ
    await this.prisma.subscriptionDeliverySchedule.create({
      data: {
        subscriptionId: schedule.subscriptionId,
        deliveryDate: newEnd,
        deliverySlot: schedule.deliverySlot,
        status: DeliveryScheduleStatus.SCHEDULED,
        productId: schedule.productId,
        customRecipeId: schedule.customRecipeId,
      },
    });

    // 4. Kéo dài endDate của Subscription
    await this.prisma.userMealSubscription.update({
      where: { id: schedule.subscriptionId },
      data: {
        endDate: newEnd,
      },
    });

    return {
      success: true,
      message: `Đã tạm hoãn bữa ăn ngày ${new Date(schedule.deliveryDate).toLocaleDateString('vi-VN')}. Hệ thống đã tự động bù thêm một bữa ăn vào ngày ${newEnd.toLocaleDateString('vi-VN')} ở cuối chu kỳ!`,
      newEndDate: newEnd,
    };
  }

  /**
   * Tự chọn món hoặc đổi sang đĩa ăn tự phối (Custom Recipe) cho 1 ngày cụ thể
   */
  async chooseDishForSchedule(scheduleId: string, userId?: string, dto?: ChooseScheduleDishDto, userRole?: string) {
    const schedule = await this.prisma.subscriptionDeliverySchedule.findUnique({
      where: { id: scheduleId },
      include: { subscription: true },
    });

    if (!schedule) {
      throw new NotFoundException('Không tìm thấy lịch giao hàng.');
    }

    if (userId && userRole !== 'ADMIN' && schedule.subscription.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền sửa đổi lịch này.');
    }

    if (schedule.status !== DeliveryScheduleStatus.SCHEDULED) {
      throw new BadRequestException('Không thể đổi món cho bữa ăn đang được chế biến hoặc đã hoàn thành.');
    }

    const updated = await this.prisma.subscriptionDeliverySchedule.update({
      where: { id: scheduleId },
      data: {
        productId: dto?.productId || null,
        customRecipeId: dto?.customRecipeId || null,
      },
      include: { product: true, customRecipe: true },
    });

    return {
      success: true,
      message: 'Đã cập nhật món ăn cho ngày đã chọn thành công!',
      schedule: updated,
    };
  }

  /**
   * Cron Job Tự động hóa: Bắn đơn hàng tự động sang bếp chi nhánh cho ngày hôm nay
   */
  async dispatchDailyMealsCron(targetSlot?: 'LUNCH' | 'DINNER') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const schedules = await this.prisma.subscriptionDeliverySchedule.findMany({
      where: {
        deliveryDate: today,
        status: DeliveryScheduleStatus.SCHEDULED,
        ...(targetSlot ? { subscription: { mealSlot: targetSlot } } : {}),
      },
      include: {
        subscription: true,
        product: true,
        customRecipe: { include: { items: { include: { ingredient: true } } } },
      },
    });

    this.logger.log(`[Auto-Pantry Cron] Found ${schedules.length} meals to dispatch today (${today.toISOString()})`);

    const dispatchedOrders: any[] = [];

    for (const sch of schedules) {
      try {
        const itemPrice = sch.product?.price || sch.customRecipe?.totalPrice || 85000;
        const itemName = sch.product?.name || sch.customRecipe?.recipeName || 'Bữa Ăn Thuê Bao Định Kỳ';

        const orderCode = `AVR-SUB-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        // Tạo đơn hàng Order
        const order = await this.prisma.order.create({
          data: {
            temporaryOrderCode: orderCode,
            branchId: sch.subscription.branchId || 'e6af60e3-9549-4dbc-beb0-3c035a1b6f08',
            userId: sch.subscription.userId,
            customerName: sch.subscription.recipientName,
            customerPhone: sch.subscription.recipientPhone,
            deliveryAddress: sch.subscription.deliveryAddress,
            orderSource: OrderSource.WEB,
            status: OrderStatus.PREPARING,
            kitchenStatus: KitchenStatus.PREPARING,
            totalAmount: itemPrice,
            subTotal: itemPrice,
            orderItems: {
              create: [
                {
                  productId: sch.productId || '03ed5645-06e6-42d0-bf8e-8e7eb2290e6c', // Fallback product
                  customRecipeId: sch.customRecipeId || null,
                  quantity: 1,
                  priceAtSale: itemPrice,
                  originalPriceAtSale: itemPrice,
                  note: `[ĐƠN THUÊ BAO AUTO-PANTRY #${sch.subscription.subscriptionCode}] Giờ giao: ${sch.deliverySlot}. ${sch.subscription.deliveryNote || ''}`,
                },
              ],
            },
          },
        });

        // Cập nhật schedule
        await this.prisma.subscriptionDeliverySchedule.update({
          where: { id: sch.id },
          data: {
            status: DeliveryScheduleStatus.PREPARING,
            generatedOrderId: order.id,
          },
        });

        // Cập nhật số bữa đã dùng trong subscription
        await this.prisma.userMealSubscription.update({
          where: { id: sch.subscriptionId },
          data: {
            usedMeals: { increment: 1 },
            remainingMeals: { decrement: 1 },
          },
        });

        dispatchedOrders.push({ scheduleId: sch.id, orderId: order.id, orderCode });
      } catch (err: any) {
        this.logger.error(`Failed to dispatch schedule ${sch.id}: ${err.message}`);
      }
    }

    return {
      dispatchedCount: dispatchedOrders.length,
      orders: dispatchedOrders,
    };
  }

  /**
   * ==========================================
   * ADMIN MANAGEMENT APIS FOR AUTO-PANTRY™
   * ==========================================
   */

  /**
   * 1. Lấy danh sách toàn bộ các gói thuê bao khách đã đăng ký (Phân trang, tìm kiếm, lọc)
   */
  async getAdminSubscriptions(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    branchId?: string;
    planId?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 12));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.status && params.status !== 'ALL') {
      where.status = params.status as any;
    }

    if (params.branchId && params.branchId !== 'ALL') {
      where.branchId = params.branchId;
    }

    if (params.planId && params.planId !== 'ALL') {
      where.planId = params.planId;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { subscriptionCode: { contains: q } },
        { recipientName: { contains: q } },
        { recipientPhone: { contains: q } },
        { deliveryAddress: { contains: q } },
        { user: { fullName: { contains: q } } },
        { user: { phone: { contains: q } } },
      ];
    }

    const [total, subscriptions, statusCounts] = await Promise.all([
      this.prisma.userMealSubscription.count({ where }),
      this.prisma.userMealSubscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
            },
          },
          schedules: {
            orderBy: { deliveryDate: 'asc' },
            include: {
              product: {
                select: { id: true, name: true, imageUrl: true, price: true },
              },
              customRecipe: {
                select: { id: true, recipeCode: true, recipeName: true, totalPrice: true },
              },
            },
          },
        },
      }),
      // Đếm số lượng theo từng trạng thái để làm KPI bar
      this.prisma.userMealSubscription.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const statusCountsMap: Record<string, number> = {
      ALL: 0,
      ACTIVE: 0,
      PENDING_PAYMENT: 0,
      PAUSED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    let totalAll = 0;
    for (const sc of statusCounts) {
      statusCountsMap[sc.status] = sc._count.id;
      totalAll += sc._count.id;
    }
    statusCountsMap.ALL = totalAll;

    return {
      success: true,
      data: subscriptions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      statusCounts: statusCountsMap,
    };
  }

  /**
   * 2. Admin cập nhật trạng thái gói thuê bao (Kích hoạt thủ công, Tạm dừng, Hủy gói)
   */
  async updateAdminSubscriptionStatus(id: string, status: SubscriptionStatus, notes?: string) {
    const sub = await this.prisma.userMealSubscription.findFirst({
      where: {
        OR: [
          { id },
          { subscriptionCode: id },
        ],
      },
      include: { plan: true },
    });

    if (!sub) {
      throw new NotFoundException(`Không tìm thấy gói thuê bao ${id}`);
    }

    const updated = await this.prisma.userMealSubscription.update({
      where: { id: sub.id },
      data: {
        status,
        ...(notes ? { deliveryNote: notes } : {}),
      },
      include: {
        plan: true,
        user: { select: { id: true, fullName: true, phone: true } },
      },
    });

    this.logger.log(`[Admin] Đã cập nhật trạng thái gói ${sub.subscriptionCode} -> ${status}`);
    return {
      success: true,
      message: `Đã cập nhật trạng thái gói ${sub.subscriptionCode} sang ${status}`,
      data: updated,
    };
  }

  /**
   * 3. Admin / Bếp đổi trạng thái một ngày giao cụ thể trong lịch
   */
  async updateAdminScheduleStatus(scheduleId: string, status: DeliveryScheduleStatus) {
    const schedule = await this.prisma.subscriptionDeliverySchedule.findUnique({
      where: { id: scheduleId },
      include: { subscription: true },
    });

    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy ngày giao hàng ID ${scheduleId}`);
    }

    const updated = await this.prisma.subscriptionDeliverySchedule.update({
      where: { id: scheduleId },
      data: { status },
      include: {
        product: true,
        customRecipe: true,
      },
    });

    return {
      success: true,
      message: `Đã cập nhật trạng thái bữa ăn ngày ${schedule.deliveryDate.toLocaleDateString('vi-VN')} sang ${status}`,
      data: updated,
    };
  }

  /**
   * 4. Bảng điều độ bếp tổng hợp: Hôm nay/Ngày mai cần chuẩn bị bao nhiêu suất món gì
   */
  async getAdminDispatchSummary(targetDateStr?: string, mealSlot?: 'LUNCH' | 'DINNER', branchId?: string) {
    let targetDate = new Date();
    if (targetDateStr) {
      targetDate = new Date(targetDateStr);
    }
    targetDate.setHours(0, 0, 0, 0);

    const where: any = {
      deliveryDate: targetDate,
      status: { in: [DeliveryScheduleStatus.SCHEDULED, DeliveryScheduleStatus.PREPARING] },
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        ...(mealSlot ? { mealSlot } : {}),
        ...(branchId && branchId !== 'ALL' ? { branchId } : {}),
      },
    };

    const schedules = await this.prisma.subscriptionDeliverySchedule.findMany({
      where,
      include: {
        subscription: {
          select: {
            id: true,
            subscriptionCode: true,
            recipientName: true,
            recipientPhone: true,
            deliveryAddress: true,
            deliveryTimeSlot: true,
            mealSlot: true,
            deliveryNote: true,
            branchId: true,
          },
        },
        product: { select: { id: true, name: true, imageUrl: true } },
        customRecipe: { select: { id: true, recipeCode: true, recipeName: true } },
      },
    });

    // Gom nhóm theo món ăn
    const dishSummaryMap = new Map<string, { name: string; imageUrl?: string; count: number; schedules: any[] }>();

    for (const sch of schedules) {
      const dishName = sch.product?.name || sch.customRecipe?.recipeName || 'Đĩa Cơm Dinh Dưỡng Signature';
      const dishImage = sch.product?.imageUrl || '';
      const existing = dishSummaryMap.get(dishName);
      if (existing) {
        existing.count += 1;
        existing.schedules.push(sch);
      } else {
        dishSummaryMap.set(dishName, {
          name: dishName,
          imageUrl: dishImage,
          count: 1,
          schedules: [sch],
        });
      }
    }

    return {
      success: true,
      date: targetDate.toISOString(),
      mealSlot: mealSlot || 'ALL',
      totalMeals: schedules.length,
      dishSummary: Array.from(dishSummaryMap.values()),
      allSchedules: schedules,
    };
  }
}
