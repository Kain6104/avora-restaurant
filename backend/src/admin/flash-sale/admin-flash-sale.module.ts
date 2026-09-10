import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FlashSaleCoreModule } from '../../flash-sale/flash-sale.module';
import { AdminFlashSaleService } from './admin-flash-sale.service';
import { AdminFlashSaleController } from './admin-flash-sale.controller';
import { OrderModule } from '../../order/order.module';

@Module({
  imports: [PrismaModule, FlashSaleCoreModule, OrderModule],
  controllers: [AdminFlashSaleController],
  providers: [AdminFlashSaleService],
  exports: [AdminFlashSaleService],
})
export class AdminFlashSaleModule {}
