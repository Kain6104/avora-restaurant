import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { PromotionModule } from '../promotion/promotion.module';

@Module({
  imports: [PromotionModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
