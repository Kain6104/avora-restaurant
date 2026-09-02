import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(keys: string[]) {
    const settings = await (this.prisma as any).systemSetting.findMany({
      where: { key: { in: keys } }
    });
    const result: any = {};
    settings.forEach((s: any) => {
      try {
        result[s.key] = JSON.parse(s.value);
      } catch (e) {
        result[s.key] = s.value;
      }
    });
    return result;
  }

  async updateSettings(data: Record<string, any>) {
    const promises = Object.keys(data).map(key => {
      const value = typeof data[key] === 'object' ? JSON.stringify(data[key]) : String(data[key]);
      return (this.prisma as any).systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      });
    });
    await Promise.all(promises);
    return { success: true };
  }
}
