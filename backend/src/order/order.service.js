"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notification_service_1 = require("../notification/notification.service");
const client_1 = require("@prisma/client");
const promotion_service_1 = require("../promotion/promotion.service");
let OrderService = class OrderService {
    constructor(prisma, notificationService, promotionService) {
        this.prisma = prisma;
        this.notificationService = notificationService;
        this.promotionService = promotionService;
    }
    async createOrder(userId, payload) {
        const { addressId, branchId, cartItems, note, paymentMethod, vatInfo } = payload;
        if (!addressId || !cartItems || cartItems.length === 0) {
            throw new common_1.BadRequestException('Invalid payload');
        }
        // 1. Fetch User and Address securely from DB
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        const address = await this.prisma.address.findUnique({ where: { id: addressId } });
        if (!address || address.userId !== userId) {
            throw new common_1.BadRequestException('Address not found or unauthorized');
        }
        const customerName = address.recipientName || user.fullName;
        const customerPhone = address.phone || user.phone || '';
        const deliveryAddress = `${address.streetDetail}, ${address.ward}, ${address.district ? address.district + ', ' : ''}${address.province}`;
        // 2. Wrap order logic in Transaction
        const txResult = await this.prisma.$transaction(async (tx) => {
            const productIds = cartItems.map((item) => item.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds } },
            });
            const productMap = new Map(products.map((p) => [p.id, p]));
            const allOptionItemIds = cartItems.flatMap((item) => item.optionItemIds || []);
            const optionItems = await tx.optionItem.findMany({
                where: { id: { in: allOptionItemIds } },
            });
            const optionItemMap = new Map(optionItems.map((o) => [o.id, o]));
            // 3. Server-side Calculation
            let subTotal = 0;
            const orderItemsData = [];
            const now = new Date();
            for (const cartItem of cartItems) {
                const product = productMap.get(cartItem.productId);
                if (!product)
                    throw new common_1.BadRequestException(`Product not found: ${cartItem.productId}`);
                let itemOptionsAdjustment = 0;
                const itemOptionsData = [];
                const optionsTextParts = [];
                for (const optionId of cartItem.optionItemIds || []) {
                    const optionItem = optionItemMap.get(optionId);
                    if (!optionItem)
                        throw new common_1.BadRequestException(`Option not found: ${optionId}`);
                    itemOptionsAdjustment += optionItem.priceAdjustment;
                    itemOptionsData.push({
                        optionItemId: optionItem.id,
                        nameAtSale: optionItem.name,
                        priceAdjustmentAtSale: optionItem.priceAdjustment,
                    });
                    optionsTextParts.push(optionItem.name);
                }
                let flashSaleQuantity = 0;
                let normalQuantity = cartItem.quantity;
                let flashSaleBasePrice = product.price;
                let actualFlashSaleId = null;
                // Check if item is part of Flash Sale
                if (cartItem.isFlashSaleItem && cartItem.flashSaleId) {
                    const fsItem = await tx.flashSaleItem.findFirst({
                        where: {
                            flashSaleId: cartItem.flashSaleId,
                            productId: product.id,
                            flashSale: {
                                isActive: true,
                                startTime: { lte: now },
                                endTime: { gte: now }
                            }
                        }
                    });
                    if (fsItem) {
                        let availableForUser = Math.max(0, fsItem.stock - fsItem.sold);
                        if (fsItem.maxQuantityPerUser) {
                            const pastOrders = await tx.orderItem.aggregate({
                                where: {
                                    productId: product.id,
                                    flashSaleId: cartItem.flashSaleId,
                                    order: { userId, status: { not: 'CANCELLED' } }
                                },
                                _sum: { quantity: true }
                            });
                            const bought = pastOrders._sum.quantity || 0;
                            const userQuota = Math.max(0, fsItem.maxQuantityPerUser - bought);
                            availableForUser = Math.min(availableForUser, userQuota);
                        }
                        flashSaleQuantity = Math.min(cartItem.quantity, availableForUser);
                        normalQuantity = cartItem.quantity - flashSaleQuantity;
                        if (flashSaleQuantity > 0) {
                            flashSaleBasePrice = fsItem.flashSalePrice;
                            actualFlashSaleId = fsItem.flashSaleId;
                            await tx.flashSaleItem.update({
                                where: { id: fsItem.id },
                                data: { sold: { increment: flashSaleQuantity } }
                            });
                        }
                    }
                }
                // Push Flash Sale Part
                if (flashSaleQuantity > 0) {
                    const priceAtSale = flashSaleBasePrice + itemOptionsAdjustment;
                    subTotal += priceAtSale * flashSaleQuantity;
                    orderItemsData.push({
                        productId: product.id,
                        quantity: flashSaleQuantity,
                        priceAtSale: priceAtSale,
                        originalPriceAtSale: product.price,
                        optionsTextSnapshot: optionsTextParts.join(', '),
                        isFlashSaleItem: true,
                        flashSaleId: actualFlashSaleId,
                        selectedOptions: {
                            create: itemOptionsData.map(o => (Object.assign({}, o))),
                        },
                    });
                }
                // Push Normal Price Part
                if (normalQuantity > 0) {
                    const priceAtSale = product.price + itemOptionsAdjustment;
                    subTotal += priceAtSale * normalQuantity;
                    orderItemsData.push({
                        productId: product.id,
                        quantity: normalQuantity,
                        priceAtSale: priceAtSale,
                        originalPriceAtSale: product.price,
                        optionsTextSnapshot: optionsTextParts.join(', '),
                        isFlashSaleItem: false,
                        flashSaleId: null,
                        selectedOptions: {
                            create: itemOptionsData.map(o => (Object.assign({}, o))),
                        },
                    });
                }
            }
            let discountAmount = 0;
            let voucherId = null;
            const shippingFee = 15000;
            if (payload.voucherCode) {
                try {
                    const voucher = await tx.voucher.findUnique({ where: { code: payload.voucherCode } });
                    if (!voucher)
                        throw new Error('Voucher không hợp lệ.');
                    if (!voucher.isActive)
                        throw new Error('Voucher không khả dụng.');
                    if (voucher.startDate > now || voucher.endDate < now)
                        throw new Error('Voucher đã hết hạn hoặc chưa bắt đầu.');
                    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit)
                        throw new Error('Voucher đã hết lượt sử dụng.');
                    if (subTotal < voucher.minOrderValue)
                        throw new Error(`Đơn hàng chưa đạt giá trị tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ.`);
                    if (voucher.membershipTierId && user.membershipTierId !== voucher.membershipTierId)
                        throw new Error('Voucher không dành cho hạng thành viên của bạn.');
                    if (voucher.discountType === 'PERCENTAGE') {
                        discountAmount = (subTotal * voucher.discountValue) / 100;
                        if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
                            discountAmount = voucher.maxDiscount;
                        }
                    }
                    else if (voucher.discountType === 'FIXED_AMOUNT') {
                        discountAmount = voucher.discountValue;
                    }
                    else if (voucher.discountType === 'FREE_SHIP') {
                        discountAmount = Math.min(voucher.discountValue, shippingFee);
                    }
                    voucherId = voucher.id;
                }
                catch (e) {
                    throw new common_1.BadRequestException(e.message || 'Invalid voucher');
                }
            }
            const totalAmount = Math.max(0, subTotal - discountAmount) + shippingFee;
            const orderCode = `ORD-${Date.now()}`;
            // 4. Create Order
            const newOrder = await tx.order.create({
                data: {
                    orderCode,
                    userId,
                    branchId,
                    customerName,
                    customerPhone,
                    deliveryAddress,
                    latitude: address.latitude,
                    longitude: address.longitude,
                    note,
                    paymentMethod: paymentMethod || 'COD',
                    subTotal,
                    discountAmount,
                    shippingFee,
                    totalAmount,
                    voucherId,
                    isInvoiceRequested: (vatInfo === null || vatInfo === void 0 ? void 0 : vatInfo.isInvoiceRequested) || false,
                    invoiceCompanyName: vatInfo === null || vatInfo === void 0 ? void 0 : vatInfo.invoiceCompanyName,
                    invoiceTaxCode: vatInfo === null || vatInfo === void 0 ? void 0 : vatInfo.invoiceTaxCode,
                    invoiceAddress: vatInfo === null || vatInfo === void 0 ? void 0 : vatInfo.invoiceAddress,
                    invoiceEmail: vatInfo === null || vatInfo === void 0 ? void 0 : vatInfo.invoiceEmail,
                    status: 'PENDING',
                    orderItems: {
                        create: orderItemsData,
                    },
                },
            });
            if (voucherId) {
                await tx.voucher.update({
                    where: { id: voucherId },
                    data: { usedCount: { increment: 1 } }
                });
            }
            return newOrder;
        });
        // Tạo thông báo đơn hàng
        await this.notificationService.createNotification({
            userId,
            title: 'Đặt hàng thành công!',
            content: `Đơn hàng ${txResult.orderCode} của bạn đã được tiếp nhận và đang chờ xử lý. Cảm ơn bạn đã chọn Avora!`,
            type: 'ORDER',
            referenceId: txResult.orderCode,
            url: `/orders/${txResult.orderCode}`,
        });
        return { success: true, orderId: txResult.id, orderCode: txResult.orderCode };
    }
    async getOrders(userId) {
        return this.prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                orderItems: {
                    include: {
                        product: true
                    }
                }
            }
        });
    }
    async getOrderByCode(userId, orderCode) {
        const order = await this.prisma.order.findFirst({
            where: { userId, orderCode },
            include: {
                branch: true,
                orderItems: {
                    include: {
                        product: true,
                        selectedOptions: {
                            include: {
                                optionItem: true
                            }
                        }
                    }
                }
            }
        });
        if (!order) {
            throw new common_1.BadRequestException('Order not found');
        }
        return order;
    }
    async cancelOrder(userId, orderCode, reason) {
        if (!reason || reason.trim() === '') {
            throw new common_1.BadRequestException('Cancel reason is required');
        }
        const order = await this.prisma.order.findFirst({
            where: { userId, orderCode },
            include: { orderItems: true }
        });
        if (!order) {
            throw new common_1.BadRequestException('Đơn hàng không tìm thấy.');
        }
        if (order.status !== 'PENDING') {
            throw new common_1.BadRequestException('Đơn hàng này không ở trạng thái có thể hủy. Vui lòng liên hệ hotline để được hỗ trợ!');
        }
        return this.prisma.$transaction(async (tx) => {
            // 1. Update order status
            const cancelledOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    status: 'CANCELLED',
                    cancelReason: reason,
                    canceledBy: userId,
                    canceledAt: new Date(),
                }
            });
            // 2. Hoàn lại số lượng đã bán (sold) cho Flash Sale nếu có
            for (const item of order.orderItems) {
                if (item.isFlashSaleItem && item.flashSaleId) {
                    await tx.flashSaleItem.updateMany({
                        where: {
                            flashSaleId: item.flashSaleId,
                            productId: item.productId,
                        },
                        data: {
                            sold: { decrement: item.quantity }
                        }
                    });
                }
            }
            return cancelledOrder;
        });
    }
    async updateOrderStatus(orderId, status, actionByUserId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { user: true }
        });
        if (!order) {
            throw new common_1.BadRequestException('Order not found');
        }
        if (order.status === status) {
            return order; // Không có gì thay đổi
        }
        // Dùng Transaction để đảm bảo tính toàn vẹn dữ liệu
        return this.prisma.$transaction(async (tx) => {
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: { status },
            });
            // Nếu đơn hàng vừa hoàn thành, cộng điểm và nâng hạng
            if (status === client_1.OrderStatus.COMPLETED && order.status !== client_1.OrderStatus.COMPLETED) {
                const amount = order.totalAmount;
                const newTotalSpending = order.user.totalSpending + amount;
                // Tỷ lệ quy đổi điểm cơ bản (Ví dụ 1,000 VNĐ = 1 Điểm)
                // Nếu muốn dùng PointMultiplier của hạng thẻ thì có thể nhân thêm
                let pointMultiplier = 1.0;
                if (order.user.membershipTierId) {
                    const currentTier = await tx.membershipTier.findUnique({ where: { id: order.user.membershipTierId } });
                    if (currentTier)
                        pointMultiplier = currentTier.pointMultiplier;
                }
                const pointsEarned = Math.floor((amount / 1000) * pointMultiplier);
                // Tìm tất cả các hạng thẻ để xét duyệt nâng hạng (Sắp xếp từ cao xuống thấp)
                const tiers = await tx.membershipTier.findMany({
                    orderBy: { minSpending: 'desc' },
                });
                // Hạng mới sẽ là hạng cao nhất mà user đủ điều kiện minSpending
                const newTier = tiers.find(tier => newTotalSpending >= tier.minSpending);
                await tx.user.update({
                    where: { id: order.userId },
                    data: {
                        totalSpending: newTotalSpending,
                        points: { increment: pointsEarned },
                        currentPoints: { increment: pointsEarned },
                        membershipTierId: newTier ? newTier.id : undefined,
                    },
                });
                // Ghi lại lịch sử giao dịch điểm
                await tx.pointTransaction.create({
                    data: {
                        userId: order.userId,
                        membershipTierId: newTier ? newTier.id : undefined,
                        balanceBefore: order.user.points,
                        amount: pointsEarned,
                        balanceAfter: order.user.points + pointsEarned,
                        source: client_1.PointTransactionSource.ORDER,
                        orderId: order.id,
                        description: `Tích điểm đơn hàng ${order.orderCode} (Hệ số x${pointMultiplier})`,
                    },
                });
            }
            return updatedOrder;
        });
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        promotion_service_1.PromotionService])
], OrderService);
