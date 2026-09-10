import { PrismaClient, ScopeType, BranchScopeType, RiskLevel } from '@prisma/client';
import {
  PERMISSIONS_CATALOG,
  SYSTEM_ROLES_DEFINITION,
  DEFAULT_SYSTEM_ROLE_PERMISSIONS,
} from '../common/constants/permissions-registry';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Bắt đầu di trú và khởi tạo hệ thống RBAC AVORA...');

  // 1. Đồng bộ Permission Catalog vào bảng Permission
  console.log(`\n📦 1. Upsert ${PERMISSIONS_CATALOG.length} permissions vào DB...`);
  for (const perm of PERMISSIONS_CATALOG) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      create: {
        key: perm.key,
        groupKey: perm.groupKey,
        name: perm.name,
        description: perm.description,
        scopeType: perm.scopeType,
        riskLevel: perm.riskLevel,
        sortOrder: perm.sortOrder,
      },
      update: {
        groupKey: perm.groupKey,
        name: perm.name,
        description: perm.description,
        scopeType: perm.scopeType,
        riskLevel: perm.riskLevel,
        sortOrder: perm.sortOrder,
      },
    });
  }
  console.log('✅ Đã đồng bộ 100% permissions vào DB.');

  // 2. Tạo 5 System Roles
  console.log('\n👑 2. Upsert 5 System Roles...');
  for (const roleDef of SYSTEM_ROLES_DEFINITION) {
    const role = await prisma.accessRole.upsert({
      where: { code: roleDef.code },
      create: {
        code: roleDef.code,
        name: roleDef.name,
        description: roleDef.description,
        scopeType: roleDef.scopeType,
        isSystem: true,
        isActive: true,
      },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        scopeType: roleDef.scopeType,
        isSystem: true,
        isActive: true,
      },
    });

    // 3. Gán RolePermission mặc định
    const defaultPerms = DEFAULT_SYSTEM_ROLE_PERMISSIONS[roleDef.code] || [];
    console.log(`  - Role ${roleDef.code}: Gán ${defaultPerms.length} permissions...`);

    // Xóa các RolePermission hiện tại của system role rồi insert lại để đảm bảo đồng bộ
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    for (const permKey of defaultPerms) {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionKey: permKey,
        },
      });
    }
  }
  console.log('✅ Đã cấu hình 5 System Roles và RolePermissions.');

  // 4. Di trú User Legacy
  console.log('\n👥 3. Di trú tài khoản người dùng hiện tại sang UserRoleAssignment...');
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, role: true, branchId: true },
  });

  const rolesInDb = await prisma.accessRole.findMany();
  const roleMap = new Map(rolesInDb.map((r) => [r.code, r.id]));

  for (const user of users) {
    let targetRoleCode: string | null = null;
    let branchScope: BranchScopeType = BranchScopeType.ALL_BRANCHES;
    let assignedBranchId: string | null = user.branchId;

    if (user.role === 'ADMIN') {
      targetRoleCode = 'ADMIN';
      branchScope = BranchScopeType.ALL_BRANCHES;
    } else if (user.role === 'MANAGER') {
      targetRoleCode = 'BRANCH_MANAGER';
      branchScope = assignedBranchId ? BranchScopeType.SELECTED_BRANCHES : BranchScopeType.ALL_BRANCHES;
    } else if (user.role === 'CHEF') {
      targetRoleCode = 'BRANCH_KITCHEN';
      branchScope = assignedBranchId ? BranchScopeType.SELECTED_BRANCHES : BranchScopeType.ALL_BRANCHES;
    } else if (user.role === 'WAITER') {
      targetRoleCode = 'BRANCH_WAITER';
      branchScope = assignedBranchId ? BranchScopeType.SELECTED_BRANCHES : BranchScopeType.ALL_BRANCHES;
    }

    if (targetRoleCode) {
      const roleId = roleMap.get(targetRoleCode);
      if (roleId) {
        const assignment = await prisma.userRoleAssignment.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId,
            },
          },
          create: {
            userId: user.id,
            roleId,
            branchScope,
            isPrimary: true,
            isActive: true,
          },
          update: {
            branchScope,
            isPrimary: true,
            isActive: true,
          },
        });

        if (branchScope === BranchScopeType.SELECTED_BRANCHES && assignedBranchId) {
          await prisma.userRoleBranch.upsert({
            where: {
              assignmentId_branchId: {
                assignmentId: assignment.id,
                branchId: assignedBranchId,
              },
            },
            create: {
              assignmentId: assignment.id,
              branchId: assignedBranchId,
            },
            update: {},
          });
        }
        console.log(`  -> Gán ${user.email} (${user.role}) vào ${targetRoleCode} [${branchScope}]`);
      }
    } else {
      console.log(`  -> Bỏ qua ${user.email} (Khách hàng thông thường - USER)`);
    }
  }

  // 5. Ghi AuditLog
  const firstAdmin = users.find((u) => u.role === 'ADMIN');
  if (firstAdmin) {
    await prisma.auditLog.create({
      data: {
        userId: firstAdmin.id,
        action: 'RBAC_SYSTEM_INITIALIZED',
        target: 'System',
        newValue: JSON.stringify({
          permissionsCount: PERMISSIONS_CATALOG.length,
          systemRolesCount: SYSTEM_ROLES_DEFINITION.length,
          migratedUsers: users.length,
        }),
      },
    });
  }

  console.log('\n🎉 DI TRÚ VÀ SEED RBAC HOÀN TẤT THÀNH CÔNG!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi seed RBAC:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
