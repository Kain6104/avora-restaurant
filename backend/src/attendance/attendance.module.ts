import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { NotificationModule } from '../notification/notification.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceQrService } from './attendance-qr.service';
import { AttendanceExcelService } from './attendance-excel.service';
import { AttendanceImportService } from './attendance-import.service';

@Module({
  imports: [PrismaModule, CommonModule, NotificationModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceQrService,
    AttendanceExcelService,
    AttendanceImportService,
  ],
  exports: [
    AttendanceService,
    AttendanceQrService,
    AttendanceExcelService,
    AttendanceImportService,
  ],
})
export class AttendanceModule {}

