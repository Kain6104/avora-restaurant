import { Controller, Get, Patch, Body, Query, UseGuards, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RoleType } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permissions';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  @Roles(RoleType.ADMIN)
  @Permissions(PERMISSIONS.SETTINGS_VIEW)
  async getSettings(@Query('keys') keys?: string) {
    const keyArray = keys ? keys.split(',') : ['restaurant', 'delivery'];
    const data = await this.settingsService.getSettings(keyArray);
    return { data };
  }

  @Patch()
  @Roles(RoleType.ADMIN)
  @Permissions(PERMISSIONS.SETTINGS_UPDATE)
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
        }
      });
    }

    return { data, message: 'Settings updated successfully' };
  }
}
