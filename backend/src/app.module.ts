import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MembershipModule } from './membership/membership.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HomeModule } from './home/home.module';
import { CategoryModule } from './category/category.module';
import { ProductModule } from './product/product.module';
import { AuthModule } from './auth/auth.module';
import { AddressModule } from './address/address.module';
import { OrderModule } from './order/order.module';
import { NotificationModule } from './notification/notification.module';
import { PromotionModule } from './promotion/promotion.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { AdminModule } from './admin/admin.module';
import { OperatingSlotModule } from './operating-slot/operating-slot.module';
import { PaymentMethodModule } from './payment-method/payment-method.module';
import { ArticleModule } from './article/article.module';
import { ReservationModule } from './reservation/reservation.module';
import { PosModule } from './pos/pos.module';
import { PrintTemplateModule } from './print-template/print-template.module';
import { PrintRoutingModule } from './print-routing/print-routing.module';
import { PricingModule } from './pricing/pricing.module';
import { ShippingModule } from './shipping/shipping.module';
import { RealtimeModule } from './realtime/realtime.module';

import { CommonModule } from './common/common.module';
import { CartModule } from './cart/cart.module';
import { RolesModule } from './admin/roles/roles.module';
import { BannerModule } from './banner/banner.module';
import { FlashSaleCoreModule } from './flash-sale/flash-sale.module';
import { BuffetModule } from './buffet/buffet.module';
import { QrOrderModule } from './qr-order/qr-order.module';
import { FarmModule } from './farm/farm.module';
import { MealArchitectModule } from './meal-architect/meal-architect.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { ReviewModule } from './review/review.module';
import { BankConnectModule } from './bank-connect/bank-connect.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 120,
        },
      ],
      errorMessage: 'Hệ thống ghi nhận quá nhiều thao tác trong thời gian ngắn. Vui lòng đợi trong giây lát rồi thử lại.',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    RolesModule,
    RealtimeModule,
    BannerModule,
    HomeModule,
    CategoryModule,
    ReviewModule,
    ProductModule,
    AuthModule,
    AddressModule,
    OrderModule,
    NotificationModule,
    PromotionModule,
    ChatbotModule,
    AdminModule,
    MembershipModule,
    OperatingSlotModule,
    PaymentMethodModule,
    ArticleModule,
    ReservationModule,
    PosModule,
    PrintTemplateModule,
    PrintRoutingModule,
    PricingModule,
    ShippingModule,
    FlashSaleCoreModule,
    BuffetModule,
    QrOrderModule,
    FarmModule,
    MealArchitectModule,
    SubscriptionModule,
    CartModule,
    BankConnectModule,
    AttendanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}

