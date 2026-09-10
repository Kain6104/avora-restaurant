import { Module, Global } from '@nestjs/common';
import { OrderPricingService } from './order-pricing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [OrderPricingService],
  exports: [OrderPricingService],
})
export class PricingModule {}
