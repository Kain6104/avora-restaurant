import { Module } from '@nestjs/common';
import { OperatingSlotService } from './operating-slot.service';
import { OperatingSlotController } from './operating-slot.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [OperatingSlotService],
  controllers: [OperatingSlotController],
  exports: [OperatingSlotService],
})
export class OperatingSlotModule {}
