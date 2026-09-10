import { Controller, Get, Patch, Body, Query, UseGuards, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeBroadcastService } from '../../order/realtime-broadcast.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
    private readonly realtimeBroadcastService: RealtimeBroadcastService,
  ) {}

  @Get()
  @RequirePermission('settings.general.view')
  async getSettings(@Query('keys') keys?: string) {
    const keyArray = keys ? keys.split(',') : ['restaurant', 'delivery'];
    const data = await this.settingsService.getSettings(keyArray);
    return { data };
  }

  @Patch()
  @RequirePermission('settings.general.update')
  async updateSettings(@Body() body: Record<string, any>, @Req() req: any) {
    const data = await this.settingsService.updateSettings(body);
    
    // Audit Log
    if (req.user?.id) {
      await this.prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'UPDATE_SETTINGS',
          target: 'System Settings',
          newValue: JSON.stringify(Object.keys(body)),
        },
      });
    }

    // Realtime Broadcasts
    if (body.vat_price_mode !== undefined) {
      this.realtimeBroadcastService.broadcastVatSettingsUpdate({
        vatPriceMode: String(body.vat_price_mode),
        vatEnabled: true,
      });
    }

    if (
      body.free_shipping_threshold !== undefined ||
      body.free_shipping_enabled !== undefined ||
      body.delivery_fee !== undefined ||
      body.delivery_min_free !== undefined ||
      body.delivery_base_fee !== undefined
    ) {
      this.realtimeBroadcastService.broadcastShippingSettingsUpdate({
        threshold: Number(body.free_shipping_threshold || body.delivery_min_free),
        enabled: body.free_shipping_enabled !== 'false' && body.free_shipping_enabled !== false,
      });
    }

    return { data, message: 'Settings updated successfully' };
  }
}
