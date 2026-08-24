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
exports.HomeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const promotion_service_1 = require("../promotion/promotion.service");
let HomeService = class HomeService {
    constructor(prisma, promotionService) {
        this.prisma = prisma;
        this.promotionService = promotionService;
    }
    async getHomePageData() {
        const [banners, categories, bestSellers, aiRecommended] = await Promise.all([
            this.prisma.banner.findMany({
                where: { active: true },
                orderBy: { bannerOrder: 'asc' },
            }),
            this.prisma.category.findMany({
                orderBy: { displayOrder: 'asc' },
            }),
            this.prisma.product.findMany({
                where: { isBestSeller: true, available: true },
                include: {
                    category: true,
                    optionGroups: { include: { optionItems: true } },
                    branches: { select: { id: true } }
                },
                take: 20,
            }),
            this.prisma.product.findMany({
                where: { isAiRecommended: true, available: true },
                include: {
                    category: true,
                    optionGroups: { include: { optionItems: true } },
                    branches: { select: { id: true } }
                },
                take: 10,
            }),
        ]);
        const enrichedBestSellers = await this.promotionService.enrichProductsWithFlashSale(bestSellers);
        const enrichedAiRecommended = await this.promotionService.enrichProductsWithFlashSale(aiRecommended);
        return {
            banners,
            categories,
            bestSellers: enrichedBestSellers,
            aiRecommended: enrichedAiRecommended,
        };
    }
    async getBranches() {
        return this.prisma.branch.findMany({
            select: {
                id: true,
                name: true,
                street: true,
                ward: true,
                district: true,
                province: true,
                phone: true,
                openTime: true,
                closeTime: true,
                latitude: true,
                longitude: true,
                onlineOrderingEnabled: true,
            },
            orderBy: { createdAt: 'asc' },
        });
    }
};
exports.HomeService = HomeService;
exports.HomeService = HomeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, promotion_service_1.PromotionService])
], HomeService);
