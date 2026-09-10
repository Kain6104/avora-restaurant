import { Module, Global } from '@nestjs/common';
import { ShippingFeeService } from './shipping-fee.service';
import { ShippingController } from './shipping.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [ShippingController],
  providers: [ShippingFeeService],
  exports: [ShippingFeeService],
})
export class ShippingModule {}
