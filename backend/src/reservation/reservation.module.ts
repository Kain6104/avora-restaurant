import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { ReservationService } from './reservation.service';
import { TableService } from './table.service';
import { ReservationScheduler } from './reservation.scheduler';
import { ReservationController } from './reservation.controller';
import { AdminReservationController } from './admin-reservation.controller';
import { TableController } from './table.controller';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [
    ReservationController,
    AdminReservationController,
    TableController,
  ],
  providers: [
    ReservationService,
    TableService,
    ReservationScheduler,
  ],
  exports: [ReservationService, TableService],
})
export class ReservationModule {}
