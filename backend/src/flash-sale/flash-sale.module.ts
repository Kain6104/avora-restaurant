import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FlashSaleValidationService } from './flash-sale-validation.service';
import { FlashSaleStockService } from './flash-sale-stock.service';
import { FlashSalePricingService } from './flash-sale-pricing.service';

@Module({
  imports: [PrismaModule],
  providers: [
    FlashSaleValidationService,
    FlashSaleStockService,
    FlashSalePricingService,
  ],
  exports: [
    FlashSaleValidationService,
    FlashSaleStockService,
    FlashSalePricingService,
  ],
})
export class FlashSaleCoreModule {}
