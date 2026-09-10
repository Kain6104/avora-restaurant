import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { PosGateway } from '../../pos/pos.gateway';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import {
  PERMISSION_GROUPS,
  PERMISSIONS_CATALOG,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLES_DEFINITION,
  DEFAULT_SYSTEM_ROLE_PERMISSIONS,
} from '../../common/constants/permissions-registry';
import { BranchScopeType, ScopeType } from '@prisma/client';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
    @Inject(forwardRef(() => PosGateway))
    private readonly posGateway: PosGateway,
  ) {}

  async onModuleInit() {
    await this.seedSystemRolesAndPermissions();
  }

  /**
   * Tự động khởi tạo & đồng bộ danh mục quyền và 5 vai trò hệ thống mặc định
   */
  async seedSystemRolesAndPermissions() {
    try {
      this.logger.log('Đang đồng bộ danh mục quyền và 5 vai trò hệ thống...');

      // 1. Upsert tất cả Permissions
      for (const p of PERMISSIONS_CATALOG) {
        await this.prisma.permission.upsert({
          where: { key: p.key },
          create: {
            key: p.key,
            groupKey: p.groupKey,
            name: p.name,
            description: p.description,
            scopeType: p.scopeType,
            riskLevel: p.riskLevel,
            sortOrder: p.sortOrder,
          },
          update: {
            groupKey: p.groupKey,
            name: p.name,
            description: p.description,
            scopeType: p.scopeType,
            riskLevel: p.riskLevel,
            sortOrder: p.sortOrder,
          },
        });
      }

      // 2. Upsert 5 Vai trò hệ thống mặc định
      for (const def of SYSTEM_ROLES_DEFINITION) {
        const role = await this.prisma.accessRole.upsert({
          where: { code: def.code },
          create: {
            code: def.code,
            name: def.name,
            description: def.description,
            isSystem: true,
            isActive: true,
            scopeType: def.scopeType,
          },
          update: {
            name: def.name,
            description: def.description,
            isSystem: true,
            isActive: true,
            scopeType: def.scopeType,
          },
        });

        // Gán default permissions
        const defaultPermKeys = DEFAULT_SYSTEM_ROLE_PERMISSIONS[def.code] || [];
        for (const key of defaultPermKeys) {
          await this.prisma.rolePermission.upsert({
            where: {
              roleId_permissionKey: {
                roleId: role.id,
                permissionKey: key,
              },
            },
            create: {
              roleId: role.id,
              permissionKey: key,
            },
            update: {},
          });
        }

        // Xóa các permission thừa của system role không còn trong defaultPermKeys
        await this.prisma.rolePermission.deleteMany({
          where: {
            roleId: role.id,
            permissionKey: { notIn: defaultPermKeys },
          },
        });
      }

      this.authorizationService.invalidateAll();

      // 3. Tự động gán role ADMIN cho tất cả user có role = ADMIN trong bảng User mà chưa có assignment
      const adminRole = await this.prisma.accessRole.findUnique({
        where: { code: SYSTEM_ROLE_CODES.ADMIN },
      });
      if (adminRole) {
        const adminUsers = await this.prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true },
        });
        for (const u of adminUsers) {
          await this.prisma.userRoleAssignment.upsert({
            where: {
              userId_roleId: {
                userId: u.id,
                roleId: adminRole.id,
              },
            },
            create: {
              userId: u.id,
              roleId: adminRole.id,
              branchScope: BranchScopeType.ALL_BRANCHES,
              isPrimary: true,
              isActive: true,
            },
            update: {
              branchScope: BranchScopeType.ALL_BRANCHES,
              isActive: true,
            },
          });
        }
      }

      this.authorizationService.invalidateAll();
      this.logger.log('Đồng bộ 5 vai trò hệ thống và quyền hạn hoàn tất thành công.');
    } catch (err: any) {
      this.logger.error(`Lỗi khi đồng bộ quyền hệ thống: ${err?.message}`, err?.stack);
    }
  }

  /**
   * Lấy danh mục quyền hệ thống
   */
  getPermissionsCatalog() {
    return {
      groups: PERMISSION_GROUPS,
      permissions: PERMISSIONS_CATALOG,
    };
  }

  /**
   * Lấy danh sách tất cả các vai trò
   */
  async findAll() {
    const roles = await this.prisma.accessRole.findMany({
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: {
            assignments: { where: { isActive: true } },
            permissions: true,
          },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      scopeType: role.scopeType,
      memberCount: role._count.assignments,
      permissionCount: role._count.permissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  /**
   * Lấy chi tiết một vai trò kèm danh sách quyền
   */
  async findOne(id: string) {
    const role = await this.prisma.accessRole.findUnique({
      where: { id },
      include: {
        permissions: {
          select: { permissionKey: true },
        },
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, email: true, fullName: true, avatarUrl: true },
            },
            branches: {
              include: {
                branch: { select: { id: true, name: true, branchCode: true } },
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Không tìm thấy vai trò với ID: ${id}`);
    }

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      scopeType: role.scopeType,
      permissionKeys: role.permissions.map((p) => p.permissionKey),
      assignedUsers: role.assignments.map((a) => ({
        user: a.user,
        branchScope: a.branchScope,
        branches: a.branches.map((b) => b.branch),
        isPrimary: a.isPrimary,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * Tạo vai trò tùy chỉnh mới
   */
  async create(dto: CreateRoleDto, actorId: string) {
    // 1. Kiểm tra mã vai trò không trùng và không được đặt trùng system roles
    const existing = await this.prisma.accessRole.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã vai trò '${dto.code}' đã tồn tại.`);
    }

    if (Object.values(SYSTEM_ROLE_CODES).includes(dto.code as any)) {
      throw new BadRequestException(`Không được sử dụng mã vai trò hệ thống '${dto.code}'.`);
    }

    // 2. Validate permissionKeys
    const validPermKeys = new Set(PERMISSIONS_CATALOG.map((p) => p.key));
    const requestedKeys = dto.permissionKeys || [];
    for (const key of requestedKeys) {
      if (!validPermKeys.has(key)) {
        throw new BadRequestException(`Mã quyền không hợp lệ: ${key}`);
      }
    }

    // 3. Thực hiện trong Transaction
    const newRole = await this.prisma.$transaction(async (tx) => {
      const role = await tx.accessRole.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description || '',
          scopeType: dto.scopeType || ScopeType.BRANCH,
          isSystem: false,
          isActive: true,
        },
      });

      if (requestedKeys.length > 0) {
        await tx.rolePermission.createMany({
          data: requestedKeys.map((key) => ({
            roleId: role.id,
            permissionKey: key,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ROLE_CREATED',
          target: `Role:${role.code}`,
          newValue: JSON.stringify({
            name: role.name,
            scopeType: role.scopeType,
            permissionCount: requestedKeys.length,
          }),
        },
      });

      return role;
    });

    this.authorizationService.invalidateAll();
    return this.findOne(newRole.id);
  }

  /**
   * Cập nhật vai trò và danh sách quyền
   */
  async update(id: string, dto: UpdateRoleDto, actorId: string) {
    const role = await this.prisma.accessRole.findUnique({
      where: { id },
      include: { permissions: true },
    });

    if (!role) {
      throw new NotFoundException(`Không tìm thấy vai trò với ID: ${id}`);
    }

    // Không cho phép sửa quyền của SYSTEM ADMIN để tránh tự tước quyền quản trị
    if (role.code === SYSTEM_ROLE_CODES.ADMIN && dto.permissionKeys) {
      if (dto.permissionKeys.length < PERMISSIONS_CATALOG.length) {
        throw new ForbiddenException('Không thể thu hồi bớt quyền của Vai trò Quản trị viên hệ thống (ADMIN).');
      }
    }

    const validPermKeys = new Set(PERMISSIONS_CATALOG.map((p) => p.key));
    if (dto.permissionKeys) {
      for (const key of dto.permissionKeys) {
        if (!validPermKeys.has(key)) {
          throw new BadRequestException(`Mã quyền không hợp lệ: ${key}`);
        }
      }
    }

    const oldPerms = role.permissions.map((p) => p.permissionKey);

    await this.prisma.$transaction(async (tx) => {
      await tx.accessRole.update({
        where: { id },
        data: {
          name: dto.name ?? role.name,
          description: dto.description ?? role.description,
          scopeType: dto.scopeType ?? role.scopeType,
          isActive: dto.isActive ?? role.isActive,
        },
      });

      if (dto.permissionKeys) {
        // Xóa quyền cũ và gán quyền mới
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        if (dto.permissionKeys.length > 0) {
          await tx.rolePermission.createMany({
            data: dto.permissionKeys.map((key) => ({
              roleId: id,
              permissionKey: key,
            })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ROLE_UPDATED',
          target: `Role:${role.code}`,
          oldValue: JSON.stringify({
            name: role.name,
            scopeType: role.scopeType,
            permissionCount: oldPerms.length,
          }),
          newValue: JSON.stringify({
            name: dto.name ?? role.name,
            scopeType: dto.scopeType ?? role.scopeType,
            permissionCount: dto.permissionKeys ? dto.permissionKeys.length : oldPerms.length,
          }),
        },
      });
    });

    this.authorizationService.invalidateAll();
    this.posGateway.emitAuthorizationUpdated(undefined, id);
    return this.findOne(id);
  }

  /**
   * Nhân bản vai trò sang vai trò tùy chỉnh mới
   */
  async duplicate(id: string, actorId: string) {
    const sourceRole = await this.prisma.accessRole.findUnique({
      where: { id },
      include: { permissions: true },
    });

    if (!sourceRole) {
      throw new NotFoundException(`Không tìm thấy vai trò nguồn ID: ${id}`);
    }

    let candidateCode = `${sourceRole.code}_COPY`;
    let counter = 1;
    while (await this.prisma.accessRole.findUnique({ where: { code: candidateCode } })) {
      candidateCode = `${sourceRole.code}_COPY_${counter++}`;
    }

    const newRole = await this.prisma.$transaction(async (tx) => {
      const role = await tx.accessRole.create({
        data: {
          code: candidateCode,
          name: `${sourceRole.name} (Bản sao)`,
          description: sourceRole.description || '',
          scopeType: sourceRole.scopeType,
          isSystem: false,
          isActive: true,
        },
      });

      if (sourceRole.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: sourceRole.permissions.map((p) => ({
            roleId: role.id,
            permissionKey: p.permissionKey,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ROLE_DUPLICATED',
          target: `Role:${role.code}`,
          newValue: JSON.stringify({
            sourceCode: sourceRole.code,
            newCode: role.code,
            permissionCount: sourceRole.permissions.length,
          }),
        },
      });

      return role;
    });

    this.authorizationService.invalidateAll();
    return this.findOne(newRole.id);
  }

  /**
   * Xóa an toàn vai trò tùy chỉnh
   */
  async delete(id: string, actorId: string) {
    const role = await this.prisma.accessRole.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Không tìm thấy vai trò với ID: ${id}`);
    }

    if (role.isSystem) {
      throw new ForbiddenException('Không thể xóa Vai trò hệ thống mặc định.');
    }

    if (role.assignments.length > 0) {
      const userList = role.assignments.map((a) => `${a.user.fullName} (${a.user.email})`).join(', ');
      throw new BadRequestException(
        `Không thể xóa vai trò này vì đang được gán cho ${role.assignments.length} nhân viên: ${userList}. Vui lòng hủy gán trước khi xóa.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.accessRole.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ROLE_DELETED',
          target: `Role:${role.code}`,
          oldValue: JSON.stringify({
            name: role.name,
            code: role.code,
          }),
        },
      });
    });

    this.authorizationService.invalidateAll();
    this.posGateway.emitAuthorizationUpdated(undefined, id);
    return { success: true, message: `Đã xóa vai trò '${role.name}' thành công.` };
  }

  /**
   * Gán vai trò cho nhân sự
   */
  async assignRole(dto: AssignRoleDto, actorId: string) {
    // 1. Kiểm tra User và Role
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng ID: ${dto.userId}`);
    }

    const role = await this.prisma.accessRole.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new NotFoundException(`Không tìm thấy vai trò ID: ${dto.roleId}`);
    }

    // 2. Validate Branch Scope
    if (dto.branchScope === BranchScopeType.SELECTED_BRANCHES) {
      if (!dto.branchIds || dto.branchIds.length === 0) {
        throw new BadRequestException('Khi chọn phạm vi "Chi nhánh chỉ định", bắt buộc phải chọn ít nhất 1 chi nhánh.');
      }

      // Xác minh các chi nhánh tồn tại
      const count = await this.prisma.branch.count({
        where: { id: { in: dto.branchIds } },
      });
      if (count !== dto.branchIds.length) {
        throw new BadRequestException('Một hoặc nhiều chi nhánh được chọn không tồn tại.');
      }
    }

    // 3. Thực hiện gán trong Transaction
    await this.prisma.$transaction(async (tx) => {
      // Upsert assignment
      const assignment = await tx.userRoleAssignment.upsert({
        where: {
          userId_roleId: {
            userId: dto.userId,
            roleId: dto.roleId,
          },
        },
        create: {
          userId: dto.userId,
          roleId: dto.roleId,
          branchScope: dto.branchScope,
          isPrimary: dto.isPrimary ?? false,
          isActive: true,
        },
        update: {
          branchScope: dto.branchScope,
          isPrimary: dto.isPrimary ?? false,
          isActive: true,
        },
      });

      // Xóa các branch liên kết cũ
      await tx.userRoleBranch.deleteMany({
        where: { assignmentId: assignment.id },
      });

      // Thêm các branch mới nếu SELECTED_BRANCHES
      if (dto.branchScope === BranchScopeType.SELECTED_BRANCHES && dto.branchIds) {
        await tx.userRoleBranch.createMany({
          data: dto.branchIds.map((branchId) => ({
            assignmentId: assignment.id,
            branchId,
          })),
        });
      }

      // Ghi AuditLog
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ROLE_ASSIGNED',
          target: `User:${user.email}`,
          newValue: JSON.stringify({
            roleCode: role.code,
            branchScope: dto.branchScope,
            branchIds: dto.branchIds || [],
          }),
        },
      });
    });

    this.authorizationService.invalidateUser(dto.userId);
    this.posGateway.emitAuthorizationUpdated(dto.userId, dto.roleId);
    return this.getUserAssignments(dto.userId);
  }

  /**
   * Hủy gán vai trò khỏi nhân sự
   */
  async removeAssignment(userId: string, roleId: string, actorId: string) {
    const assignment = await this.prisma.userRoleAssignment.findUnique({
      where: {
        userId_roleId: { userId, roleId },
      },
      include: {
        role: true,
        user: { select: { id: true, email: true } },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Không tìm thấy bản gán vai trò này.');
    }

    // Kiểm tra an toàn: Không được gỡ vai trò ADMIN của Quản trị viên hệ thống cuối cùng
    if (assignment.role.code === SYSTEM_ROLE_CODES.ADMIN) {
      const adminCount = await this.prisma.userRoleAssignment.count({
        where: {
          role: { code: SYSTEM_ROLE_CODES.ADMIN },
          isActive: true,
        },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Không thể thu hồi vai trò Quản trị viên của System Admin cuối cùng trong hệ thống.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleBranch.deleteMany({ where: { assignmentId: assignment.id } });
      await tx.userRoleAssignment.delete({ where: { id: assignment.id } });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ROLE_UNASSIGNED',
          target: `User:${assignment.user.email}`,
          oldValue: JSON.stringify({
            roleCode: assignment.role.code,
          }),
        },
      });
    });

    this.authorizationService.invalidateUser(userId);
    this.posGateway.emitAuthorizationUpdated(userId, roleId);
    return { success: true, message: `Đã gỡ vai trò '${assignment.role.name}' khỏi người dùng.` };
  }

  /**
   * Lấy danh sách các vai trò được gán của 1 User
   */
  async getUserAssignments(userId: string) {
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
      orderBy: { createdAt: 'asc' },
    });

    return assignments.map((a) => ({
      id: a.id,
      roleId: a.role.id,
      roleCode: a.role.code,
      roleName: a.role.name,
      scopeType: a.role.scopeType,
      isSystem: a.role.isSystem,
      branchScope: a.branchScope,
      isPrimary: a.isPrimary,
      branches: a.branches.map((b) => b.branch),
      createdAt: a.createdAt,
    }));
  }
}
