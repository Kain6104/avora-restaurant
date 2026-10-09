import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { FarmMaintenanceGuard } from './guards/farm-maintenance.guard';
import { FarmService } from './farm.service';
import { CropService } from './crop.service';
import { PlotService } from './plot.service';
import { HarvestService } from './harvest.service';
import { InventoryService } from './inventory.service';
import { FarmShopService } from './farm-shop.service';
import { FarmRewardService } from './farm-reward.service';
import { FarmSocialService } from './farm-social.service';
import { FarmMissionService } from './farm-mission.service';
import { FarmAssetService } from './farm-asset.service';
import { FarmTransactionService } from './farm-transaction.service';
import { FarmExchangeService } from './farm-exchange.service';
import { FarmMailService } from './farm-mail.service';
import {
  PlantCropDto,
  PlantMysteryPackDto,
  WaterPlotDto,
  WaterBatchDto,
  FertilizePlotDto,
  UnlockPlotDto,
  HarvestPlotDto,
  UprootPlotDto,
  ShopPurchaseDto,
  RedeemRewardDto,
  FriendActionDto,
  AddFriendDto,
  FriendRespondDto,
  ExchangePointsDto,
  ExchangeCropRewardDto,
} from './dto/farm.dto';

@Controller('farm')
@UseGuards(OptionalJwtAuthGuard)
export class FarmController {
  constructor(
    private readonly farmService: FarmService,
    private readonly cropService: CropService,
    private readonly plotService: PlotService,
    private readonly harvestService: HarvestService,
    private readonly inventoryService: InventoryService,
    private readonly farmShopService: FarmShopService,
    private readonly farmRewardService: FarmRewardService,
    private readonly farmSocialService: FarmSocialService,
    private readonly farmMissionService: FarmMissionService,
    private readonly farmAssetService: FarmAssetService,
    private readonly farmTransactionService: FarmTransactionService,
    private readonly farmExchangeService: FarmExchangeService,
    private readonly farmMailService: FarmMailService,
  ) {}

  // ==========================================
  // 1. MAINTENANCE & GENERAL
  // ==========================================

  @Get('maintenance-status')
  async getMaintenanceStatus() {
    const data = await this.farmService.getMaintenanceStatus();
    return { success: true, data };
  }

  // ==========================================
  // 2. FARM STATE & CROPS
  // ==========================================

  @Get('state')
  @UseGuards(JwtAuthGuard)
  async getFarmState(@Request() req: any) {
    const data = await this.farmService.getFarmState(req.user.id);
    return { success: true, data };
  }

  @Post('level-up')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async manualLevelUp(@Request() req: any) {
    const result = await this.farmService.manualLevelUp(req.user.id);
    return { success: true, data: result };
  }

  @Post('tutorial/complete')
  @UseGuards(JwtAuthGuard)
  async completeTutorial(@Request() req: any) {
    const result = await this.farmService.completeTutorial(req.user.id);
    return { success: true, data: result };
  }

  @Get('crops')
  async getAvailableCrops() {
    const data = await this.cropService.getAllCrops();
    return { success: true, data };
  }

  @Get('assets')
  async getFarmAssets() {
    const data = await this.farmAssetService.getAllAssets();
    return { success: true, data };
  }

  @Get('inventory')
  @UseGuards(JwtAuthGuard)
  async getInventory(@Request() req: any) {
    const farm = await this.farmService.getOrCreateUserFarm(req.user.id);
    const data = await this.inventoryService.getUserInventory(farm!.id, farm?.level);
    return { success: true, data };
  }

  @Get('inventory/unseen-count')
  @UseGuards(JwtAuthGuard)
  async getUnseenInventoryCount(@Request() req: any) {
    const farm = await this.farmService.getOrCreateUserFarm(req.user.id);
    const count = await this.inventoryService.getUnseenCount(farm!.id);
    return { success: true, data: { count } };
  }

  @Post('inventory/toggle-lock')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async toggleInventoryLock(@Request() req: any, @Body() body: { itemId: string }) {
    if (!body?.itemId) throw new BadRequestException('Mã vật phẩm không được để trống');
    const farm = await this.farmService.getOrCreateUserFarm(req.user.id);
    const result = await this.inventoryService.toggleItemLock(farm!.id, body.itemId);
    return { success: true, data: result };
  }

  @Post('inventory/mark-seen')
  @UseGuards(JwtAuthGuard)
  async markInventorySeen(@Request() req: any, @Body() body: { itemIds?: string[] }) {
    const farm = await this.farmService.getOrCreateUserFarm(req.user.id);
    const result = await this.inventoryService.markItemsSeen(farm!.id, body?.itemIds);
    return { success: true, data: result };
  }

  @Post('inventory/quick-sell')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async quickSellInventory(
    @Request() req: any,
    @Body() body: { items: Array<{ itemId: string; quantity: number }> },
  ) {
    const result = await this.inventoryService.quickSell(req.user.id, body.items);
    return { success: true, data: result };
  }

  @Get('collection')
  @UseGuards(JwtAuthGuard)
  async getCollectionAlbum(@Request() req: any) {
    const data = await this.farmService.getCollectionAlbum(req.user.id);
    return { success: true, data };
  }

  @Get('plant-detail')
  @UseGuards(JwtAuthGuard)
  async getPlantDetail(
    @Request() req: any,
    @Query('cropCode') cropCode: string,
    @Query('mutationCode') mutationCode?: string,
  ) {
    if (!cropCode) {
      throw new BadRequestException('Mã cây trồng cropCode không được để trống');
    }
    const data = await this.farmService.getPlantDetail(req.user.id, cropCode, mutationCode);
    return { success: true, data };
  }

  @Post('collection/claim-milestone')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async claimCollectionMilestone(@Request() req: any, @Body() dto: { tier: number }) {
    const result = await this.farmService.claimCollectionMilestone(req.user.id, dto.tier);
    return { success: true, data: result };
  }

  @Post('collection/claim-crop-reward')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async claimCropMasteryReward(@Request() req: any, @Body() dto: { cropId: string }) {
    const result = await this.farmService.claimCropMasteryReward(req.user.id, dto.cropId);
    return { success: true, data: result };
  }

  // ==========================================
  // 3. PLOT ACTIONS (SERVER-ENFORCED MAINTENANCE)
  // ==========================================

  @Post('plots/unlock')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async unlockPlot(@Request() req: any, @Body() dto: UnlockPlotDto) {
    const result = await this.plotService.unlockPlot(req.user.id, dto.plotIndex);
    return { success: true, data: result };
  }

  @Post('plots/plant')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async plantCrop(@Request() req: any, @Body() dto: PlantCropDto) {
    const result = await this.plotService.plant(req.user.id, dto.plotIndex, dto.cropCode);
    await this.farmMissionService.trackAction(req.user.id, 'PLANT', 1);
    return { success: true, data: result };
  }

  @Post('plots/plant-mystery')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async plantMysteryPack(@Request() req: any, @Body() dto: PlantMysteryPackDto) {
    const result = await this.plotService.plantMysteryPack(req.user.id, dto.plotIndex, dto.packCode || 'MYSTERY_SEED_PACK');
    await this.farmMissionService.trackAction(req.user.id, 'PLANT', 1);
    return { success: true, data: result };
  }

  @Post('plots/water')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async waterPlot(@Request() req: any, @Body() dto: WaterPlotDto) {
    const result = await this.plotService.water(req.user.id, dto.plotIndex);
    await this.farmMissionService.trackAction(req.user.id, 'WATER', 1);
    return { success: true, data: result };
  }

  @Post('plots/water-batch')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async waterBatch(@Request() req: any, @Body() dto: WaterBatchDto) {
    const result = await this.plotService.waterBatch(req.user.id, dto.plotIndexes);
    if (result.wateredCount > 0) {
      await this.farmMissionService.trackAction(req.user.id, 'WATER', result.wateredCount);
    }
    return { success: true, data: result };
  }

  @Post('plots/fertilize')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async fertilizePlot(@Request() req: any, @Body() dto: FertilizePlotDto) {
    const fertCode = dto.fertilizerCode || dto.fertilizerType || 'FERTILIZER_SPEED';
    const result = await this.plotService.fertilize(req.user.id, dto.plotIndex, fertCode);
    await this.farmMissionService.trackAction(req.user.id, 'FERTILIZE', 1);
    return { success: true, data: result };
  }

  @Post('plots/harvest')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async harvestPlot(@Request() req: any, @Body() dto: HarvestPlotDto) {
    const result = await this.harvestService.harvestPlot(req.user.id, dto.plotIndex);
    await this.farmMissionService.trackAction(req.user.id, 'HARVEST', 1);
    if (result.isMutated) {
      await this.farmMissionService.trackAction(req.user.id, 'DISCOVER_MUTATION', 1);
    }
    return { success: true, data: result };
  }

  @Post('plots/harvest-all')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async harvestAll(@Request() req: any) {
    const result = await this.harvestService.harvestAll(req.user.id);
    if ((result.harvestedCount ?? 0) > 0) {
      await this.farmMissionService.trackAction(req.user.id, 'HARVEST', result.harvestedCount!);
    }
    return { success: true, data: result };
  }

  @Post('plots/uproot')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async uprootPlot(@Request() req: any, @Body() dto: UprootPlotDto) {
    const result = await this.plotService.uproot(req.user.id, dto.plotIndex);
    return { success: true, data: result };
  }

  // ==========================================
  // 4. SHOP & ECONOMY (MAINTENANCE PROTECTED)
  // ==========================================

  @Get('shop')
  @UseGuards(JwtAuthGuard)
  async getShopCatalog(@Request() req: any) {
    const data = await this.farmShopService.getShopCatalog(req.user.id);
    return { success: true, data };
  }

  @Get('shop/catalog')
  @UseGuards(JwtAuthGuard)
  async getShopCatalogAlias(@Request() req: any) {
    const data = await this.farmShopService.getShopCatalog(req.user.id);
    return { success: true, data };
  }

  @Post('shop/purchase')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async purchaseItem(@Request() req: any, @Body() dto: ShopPurchaseDto) {
    const result = await this.farmShopService.purchaseItem(req.user.id, dto.itemCode, dto.quantity);
    return { success: true, data: result };
  }

  @Post('shop/sell')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async sellCrop(@Request() req: any, @Body() dto: ShopPurchaseDto) {
    const result = await this.farmShopService.sellCrop(req.user.id, dto.itemCode, dto.quantity);
    return { success: true, data: result };
  }

  @Post('shop/exchange')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async exchangeProduce(@Request() req: any, @Body() dto: ExchangeCropRewardDto) {
    const result = await this.farmShopService.exchangeProduce(req.user.id, dto.exchangeCode);
    return { success: true, data: result };
  }

  // ==========================================
  // 5. REWARDS & LOYALTY EXCHANGE (MAINTENANCE PROTECTED)
  // ==========================================

  @Get('rewards')
  @UseGuards(JwtAuthGuard)
  async getRewardsCatalog(@Request() req: any) {
    const data = await this.farmRewardService.getRewardsCatalog(req.user.id);
    return { success: true, data };
  }

  @Get('rewards/catalog')
  @UseGuards(JwtAuthGuard)
  async getRewardsCatalogAlias(@Request() req: any) {
    const data = await this.farmRewardService.getRewardsCatalog(req.user.id);
    return { success: true, data };
  }

  @Post('rewards/redeem')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async redeemReward(@Request() req: any, @Body() dto: RedeemRewardDto) {
    const codeOrId = dto.rewardCode || dto.rewardId;
    if (!codeOrId) {
      throw new BadRequestException('Mã phần thưởng không được để trống');
    }
    const result = await this.farmRewardService.redeemReward(req.user.id, codeOrId);
    return { success: true, data: result };
  }

  @Post('rewards/exchange-points')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async exchangeCoinsToPoints(@Request() req: any, @Body() dto: ExchangePointsDto) {
    const result = await this.farmRewardService.exchangeCoinsToPoints(req.user.id, dto.coinsAmount);
    return { success: true, data: result };
  }

  @Get('rewards/my-vouchers')
  @UseGuards(JwtAuthGuard)
  async getMyVouchers(@Request() req: any) {
    const data = await this.farmRewardService.getUserCustomerVouchers(req.user.id);
    return { success: true, data };
  }

  // ==========================================
  // 6. SOCIAL & FRIENDS (MAINTENANCE PROTECTED)
  // ==========================================

  @Get('friends/social-overview')
  @UseGuards(JwtAuthGuard)
  async getSocialOverview(@Request() req: any) {
    const data = await this.farmSocialService.getSocialOverview(req.user.id);
    return { success: true, data };
  }

  @Post('friends/add')
  @UseGuards(JwtAuthGuard)
  async addFriend(@Request() req: any, @Body() dto: AddFriendDto) {
    const result = await this.farmSocialService.addFriend(req.user.id, dto.friendUserId);
    return { success: true, data: result };
  }

  @Post('friends/accept')
  @UseGuards(JwtAuthGuard)
  async acceptFriendRequest(@Request() req: any, @Body() dto: FriendRespondDto) {
    const result = await this.farmSocialService.acceptFriendRequest(req.user.id, dto.requesterUserId);
    return { success: true, data: result };
  }

  @Post('friends/reject')
  @UseGuards(JwtAuthGuard)
  async rejectFriendRequest(@Request() req: any, @Body() dto: FriendRespondDto) {
    const result = await this.farmSocialService.rejectFriendRequest(req.user.id, dto.requesterUserId);
    return { success: true, data: result };
  }

  @Get('friends')
  @UseGuards(JwtAuthGuard)
  async getFriendsList(@Request() req: any) {
    const data = await this.farmSocialService.getFriendsList(req.user.id);
    return { success: true, data };
  }

  @Get('friends/journal')
  @UseGuards(JwtAuthGuard)
  async getSocialJournal(@Request() req: any, @Query('limit') limit?: number) {
    const data = await this.farmSocialService.getSocialJournal(req.user.id, Number(limit) || 40);
    return { success: true, data };
  }

  @Get('friends/:friendUserId')
  @UseGuards(JwtAuthGuard)
  async getFriendFarmState(@Request() req: any, @Param('friendUserId') friendUserId: string) {
    const data = await this.farmSocialService.getFriendFarmState(req.user.id, friendUserId);
    return { success: true, data };
  }

  @Post('friends/water')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async waterFriendPlot(@Request() req: any, @Body() dto: FriendActionDto) {
    const result = await this.farmSocialService.waterFriendPlot(
      req.user.id,
      dto.friendUserId,
      dto.plotIndex,
    );
    await this.farmMissionService.trackAction(req.user.id, 'HELP_FRIEND', 1);
    return { success: true, data: result };
  }

  @Post('friends/gather')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async gatherFriendCrop(@Request() req: any, @Body() dto: FriendActionDto) {
    const result = await this.farmSocialService.gatherFriendCrop(
      req.user.id,
      dto.friendUserId,
      dto.plotIndex,
    );
    return { success: true, data: result };
  }

  // ==========================================
  // 7. MISSIONS
  // ==========================================

  @Get('missions')
  @UseGuards(JwtAuthGuard)
  async getMissions(@Request() req: any) {
    const data = await this.farmMissionService.getUserMissions(req.user.id);
    return { success: true, data };
  }

  @Get('missions/summary')
  @UseGuards(JwtAuthGuard)
  async getMissionsSummary(@Request() req: any) {
    const data = await this.farmMissionService.getMissionsSummary(req.user.id);
    return { success: true, data };
  }

  @Post('missions/claim')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async claimMissionReward(
    @Request() req: any,
    @Body() body: { missionCode?: string; missionId?: string },
  ) {
    const codeOrId = body?.missionCode || body?.missionId || '';
    const result = await this.farmMissionService.claimReward(req.user.id, codeOrId);
    return { success: true, data: result };
  }

  @Post('missions/claim-all')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async claimAllMissionRewards(
    @Request() req: any,
    @Body() body: { type?: any },
  ) {
    const result = await this.farmMissionService.claimAllRewards(req.user.id, body?.type);
    return { success: true, data: result };
  }

  // ==========================================
  // 8. DYNAMIC COIN TO POINT EXCHANGE
  // ==========================================

  @Get('exchange/config')
  @UseGuards(JwtAuthGuard)
  async getExchangeConfig(@Request() req: any) {
    const data = await this.farmExchangeService.getUserExchangeOverview(req.user.id);
    return { success: true, data };
  }

  @Post('exchange/execute')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async executeExchange(@Request() req: any, @Body() dto: { amountCoin: number }) {
    const result = await this.farmExchangeService.executeExchange(req.user.id, dto.amountCoin);
    return { success: true, data: result };
  }

  // ==========================================
  // 9. TRANSACTION LEDGER & HISTORY
  // ==========================================

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getUserHistory(
    @Request() req: any,
    @Query('tab') tab: string = 'ALL',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    const data = await this.farmTransactionService.getUserHistory(
      req.user.id,
      tab,
      Number(page),
      Number(limit),
      search,
    );
    return { success: true, data };
  }

  // ==========================================
  // 10. MAILBOX SYSTEM
  // ==========================================

  @Get('mails')
  @UseGuards(JwtAuthGuard)
  async getUserMails(@Request() req: any) {
    const data = await this.farmMailService.getUserMails(req.user.id);
    return { success: true, data };
  }

  @Get('mails/unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadMailCount(@Request() req: any) {
    const data = await this.farmMailService.getUnreadCount(req.user.id);
    return { success: true, data };
  }

  @Post('mails/:id/claim')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async claimMail(@Request() req: any, @Param('id') id: string) {
    const result = await this.farmMailService.claimMail(req.user.id, id);
    return { success: true, data: result };
  }

  @Post('mails/claim-all')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async claimAllMails(@Request() req: any) {
    const result = await this.farmMailService.claimAllMails(req.user.id);
    return { success: true, data: result };
  }

  @Post('mails/:id/read')
  @UseGuards(JwtAuthGuard)
  async markMailAsRead(@Request() req: any, @Param('id') id: string) {
    const result = await this.farmMailService.markAsRead(req.user.id, id);
    return { success: true, data: result };
  }
}

