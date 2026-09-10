import { Module } from '@nestjs/common';
import { BannerTrackingController } from './banner-tracking.controller';
import { BannerTrackingService } from './banner-tracking.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BannerTrackingController],
  providers: [BannerTrackingService],
  exports: [BannerTrackingService],
})
export class BannerModule {}
