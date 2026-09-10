import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  async getPublicSettings() {
    const keys = [
      'restaurant_name',
      'restaurant_phone',
      'restaurant_address',
      'logo_desktop_url',
      'logo_mobile_url',
      'favicon_url',
    ];
    const data = await this.settingsService.getSettings(keys);
    return {
      success: true,
      data: {
        restaurant_name: data.restaurant_name || 'AVORA Restaurant',
        restaurant_phone: data.restaurant_phone || '',
        restaurant_address: data.restaurant_address || '',
        logo_desktop_url: data.logo_desktop_url || '/avora_logo_ngang.png',
        logo_mobile_url: data.logo_mobile_url || '/avora_logo.png',
        favicon_url: data.favicon_url || '/avora_logo.png',
      },
    };
  }
}
