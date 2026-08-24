"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const home_module_1 = require("./home/home.module");
const category_module_1 = require("./category/category.module");
const product_module_1 = require("./product/product.module");
const auth_module_1 = require("./auth/auth.module");
const address_module_1 = require("./address/address.module");
const order_module_1 = require("./order/order.module");
const notification_module_1 = require("./notification/notification.module");
const promotion_module_1 = require("./promotion/promotion.module");
const chatbot_module_1 = require("./chatbot/chatbot.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, home_module_1.HomeModule, category_module_1.CategoryModule, product_module_1.ProductModule, auth_module_1.AuthModule, address_module_1.AddressModule, order_module_1.OrderModule, notification_module_1.NotificationModule, promotion_module_1.PromotionModule, chatbot_module_1.ChatbotModule],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
