import { Module, Global } from '@nestjs/common';
import { ShippingFeeService } from './shipping-fee.service';
import { ShippingController } from './shipping.controller';
import { GeocodeController } from './geocode.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [ShippingController, GeocodeController],
  providers: [ShippingFeeService],
  exports: [ShippingFeeService],
})
export class ShippingModule {}
