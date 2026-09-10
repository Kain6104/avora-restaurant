import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_PERMISSION_METADATA_KEY,
  PermissionMetadata,
} from '../decorators/require-permission.decorator';
import { AuthorizationService } from '../services/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Lấy metadata Permission từ handler hoặc class
    const meta = this.reflector.getAllAndOverride<PermissionMetadata | string[] | string>(
      REQUIRE_PERMISSION_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Xử lý cả định dạng mới (PermissionMetadata) lẫn mảng legacy string[]
    let permissionKey = '';
    let options: any = undefined;

    if (!meta) {
      // DEFAULT DENY: Nếu class có gắn PermissionsGuard nhưng method quên khai báo quyền
      this.logger.warn(
        `[DEFAULT DENY] Endpoint ${context.getClass().name}#${context.getHandler().name} chưa được cấu hình permission!`,
      );
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: {
          code: 'UNPROTECTED_ENDPOINT',
          message: 'Chức năng này chưa được cấu hình quyền truy cập (Default Deny).',
        },
      });
    }

    if (typeof meta === 'string') {
      permissionKey = meta;
    } else if (Array.isArray(meta)) {
      permissionKey = meta[0] || '';
    } else if (typeof meta === 'object' && 'permission' in meta) {
      permissionKey = meta.permission;
      options = meta.options;
    }

    if (!permissionKey) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: {
          code: 'PERMISSION_KEY_MISSING',
          message: 'Mã quyền không hợp lệ.',
        },
      });
    }

    // 2. Lấy thông tin user từ request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Yêu cầu đăng nhập để truy cập tài nguyên này.',
        },
      });
    }

    // 3. Trích xuất branchId mục tiêu và kiểm tra chống IDOR
    let targetBranchId: string | null | undefined = null;

    if (options?.resourceResolver && typeof options.resourceResolver === 'function') {
      // Đọc trực tiếp thực thể từ DB để lấy branchId thật, chặn giả mạo IDOR
      try {
        targetBranchId = await options.resourceResolver(request, this.prisma);
      } catch (err: any) {
        this.logger.error(`Error resolving resource branch: ${err?.message}`);
        throw new ForbiddenException({
          success: false,
          statusCode: 403,
          error: {
            code: 'RESOURCE_RESOLVE_FAILED',
            message: 'Không thể xác định phạm vi chi nhánh của tài nguyên.',
          },
        });
      }
    } else if (options?.branchExtractor && typeof options.branchExtractor === 'function') {
      targetBranchId = options.branchExtractor(request);
    } else if (options?.branchParam && request.params?.[options.branchParam]) {
      targetBranchId = request.params[options.branchParam];
    } else if (options?.branchQuery && request.query?.[options.branchQuery]) {
      targetBranchId = request.query[options.branchQuery];
    } else if (options?.branchBody && request.body?.[options.branchBody]) {
      targetBranchId = request.body[options.branchBody];
    } else {
      // Auto-fallback: kiểm tra params/query/body thông dụng
      targetBranchId =
        request.params?.branchId ||
        request.query?.branchId ||
        request.body?.branchId ||
        request.headers?.['x-branch-id'] ||
        null;
    }

    // 4. Ủy quyền qua AuthorizationService
    const hasPerm = await this.authorizationService.hasPermissionForBranch(
      user.id,
      permissionKey,
      targetBranchId,
    );

    if (!hasPerm) {
      this.logger.warn(
        `User ${user.email} (ID: ${user.id}) bị từ chối quyền '${permissionKey}' tại chi nhánh '${targetBranchId || 'ALL'}'`,
      );
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: {
          code: 'FORBIDDEN_PERMISSION',
          message: `Bạn không có quyền thực hiện thao tác '${permissionKey}' tại chi nhánh đã chọn.`,
          requiredPermission: permissionKey,
          targetBranchId: targetBranchId || null,
        },
      });
    }

    // Gán context quyền hợp lệ vào request để controller/service sử dụng
    request.authorizedBranchId = targetBranchId;
    request.requiredPermission = permissionKey;

    return true;
  }
}
