import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchScopeType, ScopeType } from '@prisma/client';
import { SYSTEM_ROLE_CODES, PERMISSIONS_CATALOG } from '../constants/permissions-registry';

export interface UserBranchPermission {
  isGlobal: boolean;
  branchIds: string[];
}

export interface UserEffectivePermissions {
  userId: string;
  isAdmin: boolean;
  roleCodes: string[];
  permissions: Record<string, UserBranchPermission>;
  cachedAt: number;
}

export interface UserCapabilitiesDto {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
    defaultBranchId?: string | null;
    role?: string;
    roleName?: string;
  };
  roles: {
    id: string;
    code: string;
    name: string;
    isSystem: boolean;
    scopeType: ScopeType;
  }[];
  assignments: {
    roleCode: string;
    roleName: string;
    branchScope: BranchScopeType;
    isPrimary: boolean;
    branches: { id: string; name: string; branchCode: string }[];
  }[];
  effectivePermissions: Record<string, { isGlobal: boolean; branchIds: string[] }>;
  allBranches: { id: string; name: string; branchCode: string }[];
  defaultBranchId?: string | null;
}

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  // In-memory Cache: userId -> UserEffectivePermissions (TTL: 5 mins)
  private readonly cache = new Map<string, UserEffectivePermissions>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tính toán hoặc lấy từ cache toàn bộ quyền hạn thực tế của người dùng
   */
  async getEffectivePermissions(userId: string): Promise<UserEffectivePermissions> {
    const cached = this.cache.get(userId);
    const now = Date.now();
    if (cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached;
    }

    // 1. Tải thông tin người dùng từ database để kiểm tra role trực tiếp
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, branchId: true },
    });

    const isSystemAdminByRole = userRecord?.role === 'ADMIN';

    // 2. Tải tất cả các Role Assignment đang active của user
    let assignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        isActive: true,
        role: { isActive: true },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        branches: {
          include: {
            branch: {
              select: { id: true, name: true, branchCode: true },
            },
          },
        },
      },
    });

    // Auto-heal: Nếu user có role === 'ADMIN' trong bảng User nhưng chưa có UserRoleAssignment role ADMIN
    const hasAdminAssignment = assignments.some((a) => a.role.code === SYSTEM_ROLE_CODES.ADMIN);
    if (isSystemAdminByRole && !hasAdminAssignment) {
      try {
        const adminRole = await this.prisma.accessRole.findUnique({
          where: { code: SYSTEM_ROLE_CODES.ADMIN },
        });
        if (adminRole) {
          await this.prisma.userRoleAssignment.upsert({
            where: {
              userId_roleId: {
                userId,
                roleId: adminRole.id,
              },
            },
            create: {
              userId,
              roleId: adminRole.id,
              branchScope: BranchScopeType.ALL_BRANCHES,
              isPrimary: true,
              isActive: true,
            },
            update: {
              branchScope: BranchScopeType.ALL_BRANCHES,
              isPrimary: true,
              isActive: true,
            },
          });

          // Nạp lại assignments sau khi auto-heal
          assignments = await this.prisma.userRoleAssignment.findMany({
            where: {
              userId,
              isActive: true,
              role: { isActive: true },
            },
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
              branches: {
                include: {
                  branch: {
                    select: { id: true, name: true, branchCode: true },
                  },
                },
              },
            },
          });
        }
      } catch (e) {
        this.logger.warn(`Failed to auto-heal admin role assignment for user ${userId}:`, e);
      }
    }

    // 3. Tải toàn bộ chi nhánh hiện có để hỗ trợ ALL_BRANCHES
    const allBranches = await this.prisma.branch.findMany({
      select: { id: true },
    });
    const allBranchIds = allBranches.map((b) => b.id);

    const permissionMap: Record<string, { isGlobal: boolean; branchSet: Set<string> }> = {};
    const roleCodes: string[] = [];
    let isAdmin = isSystemAdminByRole;

    for (const assignment of assignments) {
      const role = assignment.role;
      if (!roleCodes.includes(role.code)) {
        roleCodes.push(role.code);
      }

      if (role.code === SYSTEM_ROLE_CODES.ADMIN) {
        isAdmin = true;
      }

      const isAllBranches = assignment.branchScope === BranchScopeType.ALL_BRANCHES;
      const assignedBranchIds = (assignment.branches || [])
        .map((b: any) => b.branchId || b.branch?.id)
        .filter(Boolean);

      for (const rp of role.permissions || []) {
        const permKey = rp.permissionKey || rp.permission?.key;
        if (!permKey) continue;

        if (!permissionMap[permKey]) {
          permissionMap[permKey] = {
            isGlobal: false,
            branchSet: new Set<string>(),
          };
        }

        // Quyền chỉ là isGlobal nếu role là ADMIN hoặc assignment có phạm vi ALL_BRANCHES kèm theo scope GLOBAL
        if (role.code === SYSTEM_ROLE_CODES.ADMIN) {
          permissionMap[permKey].isGlobal = true;
        }

        if (isAllBranches) {
          // Có quyền trên tất cả chi nhánh
          allBranchIds.forEach((id) => permissionMap[permKey].branchSet.add(id));
          if (role.scopeType === ScopeType.GLOBAL || rp.permission?.scopeType === ScopeType.GLOBAL) {
            permissionMap[permKey].isGlobal = true;
          }
        } else {
          // Chỉ có quyền trên danh sách chi nhánh được chỉ định
          assignedBranchIds.forEach((id) => permissionMap[permKey].branchSet.add(id));
        }
      }
    }

    // Nếu là Admin, đảm bảo có toàn bộ quyền trong PERMISSIONS_CATALOG
    if (isAdmin) {
      if (!roleCodes.includes(SYSTEM_ROLE_CODES.ADMIN)) {
        roleCodes.unshift(SYSTEM_ROLE_CODES.ADMIN);
      }
      for (const perm of PERMISSIONS_CATALOG) {
        permissionMap[perm.key] = {
          isGlobal: true,
          branchSet: new Set(allBranchIds),
        };
      }
    }

    // Chuyển Set sang Array
    const finalPermissions: Record<string, UserBranchPermission> = {};
    for (const [key, value] of Object.entries(permissionMap)) {
      finalPermissions[key] = {
        isGlobal: value.isGlobal || isAdmin,
        branchIds: isAdmin ? allBranchIds : Array.from(value.branchSet),
      };
    }

    const result: UserEffectivePermissions = {
      userId,
      isAdmin,
      roleCodes,
      permissions: finalPermissions,
      cachedAt: now,
    };

    this.cache.set(userId, result);
    return result;
  }

  /**
   * Kiểm tra người dùng có quyền cụ thể hay không (ở bất kỳ đâu hoặc toàn cục)
   */
  async hasPermission(userId: string, permissionKey: string): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId);
    if (effective.isAdmin) return true;

    const perm = effective.permissions[permissionKey];
    if (!perm) return false;

    return perm.isGlobal || perm.branchIds.length > 0;
  }

  /**
   * Kiểm tra người dùng có quyền trên một chi nhánh cụ thể hay không
   */
  async hasPermissionForBranch(
    userId: string,
    permissionKey: string,
    branchId?: string | null,
  ): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId);
    if (effective.isAdmin) return true;

    const perm = effective.permissions[permissionKey];
    if (!perm) return false;

    // Nếu quyền là Global
    if (perm.isGlobal) return true;

    // Nếu không yêu cầu chi nhánh cụ thể, chỉ cần có quyền ở >= 1 chi nhánh
    if (!branchId || branchId === 'ALL') {
      return perm.branchIds.length > 0;
    }

    return perm.branchIds.includes(branchId);
  }

  /**
   * Lấy danh sách các chi nhánh được phép thao tác đối với một quyền
   */
  async getAllowedBranches(
    userId: string,
    permissionKey: string,
  ): Promise<{ isAll: boolean; branchIds: string[] }> {
    const effective = await this.getEffectivePermissions(userId);
    if (effective.isAdmin) {
      const allBranches = await this.prisma.branch.findMany({ select: { id: true } });
      return { isAll: true, branchIds: allBranches.map((b) => b.id) };
    }

    const perm = effective.permissions[permissionKey];
    if (!perm) {
      return { isAll: false, branchIds: [] };
    }

    if (perm.isGlobal) {
      const allBranches = await this.prisma.branch.findMany({ select: { id: true } });
      return { isAll: true, branchIds: allBranches.map((b) => b.id) };
    }

    return { isAll: false, branchIds: perm.branchIds };
  }

  /**
   * Lấy toàn bộ Capabilities trả về cho client (/auth/me/capabilities)
   */
  async getCapabilities(userId: string): Promise<UserCapabilitiesDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        branchId: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const effective = await this.getEffectivePermissions(userId);

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, isActive: true },
      include: {
        role: true,
        branches: {
          include: {
            branch: {
              select: { id: true, name: true, branchCode: true },
            },
          },
        },
      },
    });

    const allBranches = await this.prisma.branch.findMany({
      select: { id: true, name: true, branchCode: true },
    });

    const isSystemAdmin = effective.isAdmin || user.role === 'ADMIN';

    const primaryAssignment = isSystemAdmin
      ? assignments.find((a) => a.role.code === SYSTEM_ROLE_CODES.ADMIN) || assignments.find((a) => a.isPrimary) || assignments[0]
      : assignments.find((a) => a.isPrimary) || assignments[0];
    const primaryRole = primaryAssignment?.role;

    const mappedRoles = assignments.map((a) => ({
      id: a.role.id,
      code: a.role.code,
      name: a.role.name,
      isSystem: a.role.isSystem,
      scopeType: a.role.scopeType,
    }));

    if (isSystemAdmin && !mappedRoles.some((r) => r.code === SYSTEM_ROLE_CODES.ADMIN)) {
      mappedRoles.unshift({
        id: 'system-admin-role',
        code: SYSTEM_ROLE_CODES.ADMIN,
        name: 'Admin toàn quyền',
        isSystem: true,
        scopeType: ScopeType.GLOBAL,
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        defaultBranchId: user.branchId,
        role: isSystemAdmin ? 'ADMIN' : (primaryRole?.code || user.role || 'USER'),
        roleName: isSystemAdmin
          ? 'Quản trị viên toàn quyền'
          : (primaryRole?.name || (user.role === 'ADMIN' ? 'Quản trị viên toàn quyền' : 'Nhân viên')),
      },
      roles: mappedRoles,
      assignments: assignments.map((a) => ({
        roleCode: a.role.code,
        roleName: a.role.name,
        branchScope: a.branchScope,
        isPrimary: a.isPrimary,
        branches: a.branches.map((b) => b.branch),
      })),
      effectivePermissions: effective.permissions,
      allBranches,
      defaultBranchId: user.branchId,
    };
  }

  /**
   * Thu hồi / Làm mới cache quyền của 1 user
   */
  invalidateUser(userId: string): void {
    this.cache.delete(userId);
    this.logger.log(`Invalidated authorization cache for user: ${userId}`);
  }

  /**
   * Thu hồi toàn bộ cache khi có thay đổi lớn trên vai trò
   */
  invalidateAll(): void {
    this.cache.clear();
    this.logger.log('Invalidated ALL authorization cache');
  }
}
