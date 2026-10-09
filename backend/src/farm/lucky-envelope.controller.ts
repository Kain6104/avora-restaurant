import { Controller, Get, Post, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { FarmMaintenanceGuard } from './guards/farm-maintenance.guard';
import { LuckyEnvelopeService } from './lucky-envelope.service';

@Controller('farm/lucky-envelope')
export class LuckyEnvelopeController {
  constructor(private readonly luckyEnvelopeService: LuckyEnvelopeService) {}

  /**
   * Lấy thể lệ sự kiện và danh sách phần thưởng kèm tỷ lệ xác suất minh bạch (từ Database)
   */
  @Get('rules-and-rewards')
  @UseGuards(OptionalJwtAuthGuard)
  async getRulesAndRewards() {
    const data = await this.luckyEnvelopeService.getPublicRewardsAndRules();
    return { success: true, data };
  }

  /**
   * Lấy trạng thái lì xì của người chơi (số vé, số bao treo trên cây, trạng thái sự kiện)
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Request() req: any) {
    const data = await this.luckyEnvelopeService.getUserStatus(req.user.id);
    return { success: true, data };
  }

  /**
   * Mở bao lì xì may mắn (Transaction-safe, server-side weighted random)
   */
  @Post('open')
  @UseGuards(JwtAuthGuard, FarmMaintenanceGuard)
  async openEnvelope(@Request() req: any) {
    const data = await this.luckyEnvelopeService.openEnvelope(req.user.id);
    return { success: true, data };
  }

  /**
   * Lịch sử mở lì xì gần đây của người chơi
   */
  @Get('my-history')
  @UseGuards(JwtAuthGuard)
  async getMyHistory(@Request() req: any, @Query('limit') limit?: string) {
    const take = limit ? parseInt(limit, 10) : 20;
    const data = await this.luckyEnvelopeService.getUserHistory(req.user.id, take);
    return { success: true, data };
  }
}
