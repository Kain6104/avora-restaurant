import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { FarmGateway } from './farm.gateway';
import { FarmService } from './farm.service';
import { CropService } from './crop.service';
import { MutationEngine } from './mutation.engine';
import { InventoryService } from './inventory.service';
import { PlotService } from './plot.service';
import { HarvestService } from './harvest.service';
import { FarmShopService } from './farm-shop.service';
import { FarmRewardService } from './farm-reward.service';
import { FarmSocialService } from './farm-social.service';
import { FarmMissionService } from './farm-mission.service';
import { FarmIntegrationService } from './farm-integration.service';
import { AdminFarmService } from './admin-farm.service';
import { FarmAssetService } from './farm-asset.service';
import { LuckyEnvelopeService } from './lucky-envelope.service';
import { AdminLuckyEnvelopeService } from './admin-lucky-envelope.service';
import { FarmController } from './farm.controller';
import { AdminFarmController } from './admin-farm.controller';
import { AdminFarmAssetController } from './farm-asset.controller';
import { LuckyEnvelopeController } from './lucky-envelope.controller';
import { AdminLuckyEnvelopeController } from './admin-lucky-envelope.controller';
import { FarmTransactionService } from './farm-transaction.service';
import { FarmExchangeService } from './farm-exchange.service';
import { FarmMailService } from './farm-mail.service';
import { FarmLayoutService } from './farm-layout.service';
import { FarmGardenAssetService } from './farm-garden-asset.service';
import { FarmLevelConfigService } from './farm-level-config.service';
import {
  AdminFarmLayoutController,
  AdminFarmGardenAssetController,
  FarmLayoutController,
} from './farm-layout.controller';
import {
  AdminFarmLevelConfigController,
  FarmLevelController,
} from './farm-level-config.controller';
import { getRequiredEnv } from '../common/utils/env.util';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: getRequiredEnv('JWT_SECRET'),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [
    FarmController,
    AdminFarmController,
    AdminFarmAssetController,
    LuckyEnvelopeController,
    AdminLuckyEnvelopeController,
    AdminFarmLayoutController,
    AdminFarmGardenAssetController,
    FarmLayoutController,
    AdminFarmLevelConfigController,
    FarmLevelController,
  ],
  providers: [
    FarmGateway,
    FarmService,
    CropService,
    MutationEngine,
    InventoryService,
    PlotService,
    HarvestService,
    FarmShopService,
    FarmRewardService,
    FarmSocialService,
    FarmMissionService,
    FarmIntegrationService,
    AdminFarmService,
    FarmAssetService,
    LuckyEnvelopeService,
    AdminLuckyEnvelopeService,
    FarmTransactionService,
    FarmExchangeService,
    FarmMailService,
    FarmLayoutService,
    FarmGardenAssetService,
    FarmLevelConfigService,
  ],
  exports: [
    FarmService,
    FarmIntegrationService,
    FarmGateway,
    FarmAssetService,
    LuckyEnvelopeService,
    FarmTransactionService,
    FarmExchangeService,
    FarmMailService,
    FarmLayoutService,
    FarmGardenAssetService,
    FarmLevelConfigService,
  ],
})
export class FarmModule {}

