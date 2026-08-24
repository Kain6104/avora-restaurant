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
exports.PromotionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PromotionService = class PromotionService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCurrentFlashSale() {
        const now = new Date();
        const flashSale = await this.prisma.flashSale.findFirst({
            where: {
                isActive: true,
                startTime: { lte: now },
                endTime: { gte: now },
            },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                category: true,
                            }
                        }
                    }
                }
            }
        });
        if (!flashSale)
            return null;
        // Tính thời gian còn lại (số giây)
        const countdown = Math.max(0, Math.floor((flashSale.endTime.getTime() - now.getTime()) / 1000));
        // Đếm số lượng đã bán thực tế từ các OrderItem không bị Hủy (CANCELLED)
        const itemsWithActualSold = await Promise.all(flashSale.items.map(async (item) => {
            const soldAggregate = await this.prisma.orderItem.aggregate({
                where: {
                    productId: item.productId,
                    flashSaleId: flashSale.id,
                    order: {
                        status: { not: 'CANCELLED' }
                    }
                },
                _sum: { quantity: true }
            });
            const actualSold = soldAggregate._sum.quantity || 0;
            return Object.assign(Object.assign({}, item), { sold: actualSold // Ghi đè trường sold từ DB bằng giá trị tính toán thực tế
             });
        }));
        return Object.assign(Object.assign({}, flashSale), { items: itemsWithActualSold, countdown });
    }
    async enrichProductsWithFlashSale(products) {
        if (!products || products.length === 0)
            return products;
        const activeFlashSale = await this.getCurrentFlashSale();
        if (!activeFlashSale)
            return products;
        const flashSaleMap = new Map();
        for (const item of activeFlashSale.items) {
            flashSaleMap.set(item.productId, item);
        }
        return products.map(p => {
            const fsItem = flashSaleMap.get(p.id);
            if (fsItem) {
                return Object.assign(Object.assign({}, p), { flashSalePrice: fsItem.flashSalePrice, flashSaleId: activeFlashSale.id, flashSaleStock: fsItem.stock, flashSaleSold: fsItem.sold, maxQuantityPerUser: fsItem.maxQuantityPerUser });
            }
            return p;
        });
    }
    async getFlashSaleQuota(userId) {
        const activeFlashSale = await this.getCurrentFlashSale();
        if (!activeFlashSale)
            return {};
        const quotaMap = {};
        for (const item of activeFlashSale.items) {
            const overallAvailable = Math.max(0, item.stock - item.sold);
            let userAvailable = overallAvailable;
            if (item.maxQuantityPerUser) {
                const pastOrders = await this.prisma.orderItem.aggregate({
                    where: {
                        productId: item.productId,
                        flashSaleId: activeFlashSale.id,
                        order: { userId, status: { not: 'CANCELLED' } }
                    },
                    _sum: { quantity: true }
                });
                const bought = pastOrders._sum.quantity || 0;
                const remainingQuota = Math.max(0, item.maxQuantityPerUser - bought);
                userAvailable = Math.min(overallAvailable, remainingQuota);
            }
            quotaMap[item.productId] = userAvailable;
        }
        return quotaMap;
    }
    async getVouchers(userId) {
        const now = new Date();
        let userTierId = null;
        if (userId) {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (user) {
                userTierId = user.membershipTierId;
            }
        }
        const vouchers = await this.prisma.voucher.findMany({
            where: {
                isActive: true,
                isPublic: true,
                startDate: { lte: now },
                endDate: { gte: now },
                // Chỉ lấy những voucher không yêu cầu hạng thẻ HOẶC yêu cầu đúng hạng thẻ của user này
                OR: [
                    { membershipTierId: null },
                    ...(userTierId ? [{ membershipTierId: userTierId }] : [])
                ]
            }
        });
        return vouchers;
    }
    async applyVoucher(code, orderValue, userId, shippingFee = 0) {
        const now = new Date();
        const voucher = await this.prisma.voucher.findUnique({
            where: { code }
        });
        if (!voucher) {
            throw new common_1.NotFoundException('Mã khuyến mãi không tồn tại');
        }
        if (!voucher.isActive || voucher.startDate > now || voucher.endDate < now) {
            throw new common_1.BadRequestException('Mã khuyến mãi đã hết hạn hoặc chưa khả dụng');
        }
        if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
            throw new common_1.BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
        }
        if (orderValue < voucher.minOrderValue) {
            throw new common_1.BadRequestException(`Đơn hàng tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ để áp dụng mã này`);
        }
        // Check membership tier if required
        if (voucher.membershipTierId && userId) {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if ((user === null || user === void 0 ? void 0 : user.membershipTierId) !== voucher.membershipTierId) {
                throw new common_1.BadRequestException('Bạn không đủ điều kiện hạng thẻ để sử dụng mã này');
            }
        }
        else if (voucher.membershipTierId && !userId) {
            throw new common_1.BadRequestException('Vui lòng đăng nhập để sử dụng mã khuyến mãi này');
        }
        // Calculate discount amount
        let discountAmount = 0;
        if (voucher.discountType === 'PERCENTAGE') {
            discountAmount = (orderValue * voucher.discountValue) / 100;
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
        return {
            success: true,
            voucher,
            discountAmount
        };
    }
};
exports.PromotionService = PromotionService;
exports.PromotionService = PromotionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PromotionService);
