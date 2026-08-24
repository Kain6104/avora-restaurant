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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionController = void 0;
const common_1 = require("@nestjs/common");
const promotion_service_1 = require("./promotion.service");
let PromotionController = class PromotionController {
    constructor(promotionService) {
        this.promotionService = promotionService;
    }
    async getCurrentFlashSale() {
        return this.promotionService.getCurrentFlashSale();
    }
    async getFlashSaleQuota(userId) {
        if (!userId)
            return {};
        return this.promotionService.getFlashSaleQuota(userId);
    }
    async getVouchers(userId) {
        return this.promotionService.getVouchers(userId);
    }
    async applyVoucher(code, orderValue, userId, shippingFee = 15000) {
        return this.promotionService.applyVoucher(code, orderValue, userId, shippingFee);
    }
};
exports.PromotionController = PromotionController;
__decorate([
    (0, common_1.Get)('flash-sale/current'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "getCurrentFlashSale", null);
__decorate([
    (0, common_1.Post)('flash-sale/quota'),
    __param(0, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "getFlashSaleQuota", null);
__decorate([
    (0, common_1.Post)('vouchers'),
    __param(0, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "getVouchers", null);
__decorate([
    (0, common_1.Post)('vouchers/apply'),
    __param(0, (0, common_1.Body)('code')),
    __param(1, (0, common_1.Body)('orderValue')),
    __param(2, (0, common_1.Body)('userId')),
    __param(3, (0, common_1.Body)('shippingFee')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String, Number]),
    __metadata("design:returntype", Promise)
], PromotionController.prototype, "applyVoucher", null);
exports.PromotionController = PromotionController = __decorate([
    (0, common_1.Controller)('promotions'),
    __metadata("design:paramtypes", [promotion_service_1.PromotionService])
], PromotionController);
