import { Module } from '@nestjs/common';
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

@Module({
  imports: [PrismaModule, HomeModule, CategoryModule, ProductModule, AuthModule, AddressModule, OrderModule, NotificationModule, PromotionModule, ChatbotModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
