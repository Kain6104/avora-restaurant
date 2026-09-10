import { Module } from '@nestjs/common';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';
import { FlashSaleCoreModule } from '../flash-sale/flash-sale.module';

@Module({
  imports: [FlashSaleCoreModule],
  controllers: [PromotionController],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
