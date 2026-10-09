import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FarmMaintenanceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Kiểm tra cấu hình bảo trì từ SystemSetting
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'farm_maintenance' },
    });

    if (!setting) {
      return true;
    }

    let config: { enabled?: boolean; message?: string; estimatedEndTime?: string } = {};
    try {
      config = JSON.parse(setting.value);
    } catch {
      return true;
    }

    if (!config.enabled) {
      return true;
    }

    // 2. Nếu đang bảo trì, kiểm tra xem user có phải Admin/Manager có quyền bypass không
    const user = request.user;
    if (user) {
      const roleName = user.role?.name || user.roleName || user.role;
      if (['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(roleName)) {
        return true;
      }

      // Kiểm tra user permissions nếu có
      if (Array.isArray(user.permissions) && user.permissions.includes('farm.manage_shop')) {
        return true;
      }
    }

    // 3. Chặn cưỡng chế từ Server đối với khách hàng thông thường
    throw new HttpException(
      {
        success: false,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: {
          code: 'FARM_UNDER_MAINTENANCE',
          message:
            config.message ||
            'Khu vườn AVORA Farm đang được các nghệ nhân chăm sóc nâng cấp định kỳ. Quý khách vui lòng trở lại sau!',
          estimatedEndTime: config.estimatedEndTime || null,
        },
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
