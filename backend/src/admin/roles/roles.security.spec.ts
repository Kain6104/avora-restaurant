import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '../../common/services/authorization.service';
import { RolesService } from './roles.service';
import { PosGateway } from '../../pos/pos.gateway';
import { BranchScopeType, ScopeType } from '@prisma/client';
import { SYSTEM_ROLE_CODES } from '../../common/constants/permissions-registry';

describe('AVORA Enterprise RBAC Security Test Suite (16 Mandatory Tests)', () => {
  let authorizationService: AuthorizationService;
  let rolesService: RolesService;
  let posGateway: PosGateway;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'AVO1', name: 'AVORA Quận 1', branchCode: 'AVO1' },
          { id: 'AVO2', name: 'AVORA Thảo Điền', branchCode: 'AVO2' },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      order: {
        findUnique: jest.fn(),
      },
      userRoleAssignment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      userRoleBranch: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      accessRole: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rolePermission: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(true),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    authorizationService = new AuthorizationService(mockPrisma);

    const mockJwt: any = {
      verify: jest.fn().mockReturnValue({ sub: 'user-waiter' }),
    };

    posGateway = new PosGateway(mockJwt, authorizationService, mockPrisma);
    rolesService = new RolesService(mockPrisma, authorizationService, posGateway);
  });

  // TEST 1: Manager AVO1 xem Order AVO2 -> 403
  it('1. Manager AVO1 xem Order AVO2 -> 403 Forbidden', async () => {
    // User is Manager at AVO1 only
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'mgr-1',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'BRANCH_MANAGER',
          permissions: [{ permission: { key: 'orders.view', scopeType: ScopeType.BRANCH } }],
        },
        branches: [{ branch: { id: 'AVO1', name: 'AVORA Quận 1' } }],
      },
    ]);

    const hasAccessAVO1 = await authorizationService.hasPermissionForBranch('mgr-1', 'orders.view', 'AVO1');
    const hasAccessAVO2 = await authorizationService.hasPermissionForBranch('mgr-1', 'orders.view', 'AVO2');

    expect(hasAccessAVO1).toBe(true);
    expect(hasAccessAVO2).toBe(false); // DENIED
  });

  // TEST 2: Waiter AVO1 join Socket AVO2 -> reject
  it('2. Waiter AVO1 join Socket AVO2 -> reject', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'waiter-1',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'BRANCH_WAITER',
          permissions: [{ permission: { key: 'waiter.access', scopeType: ScopeType.BRANCH } }],
        },
        branches: [{ branch: { id: 'AVO1', name: 'AVORA Quận 1' } }],
      },
    ]);

    const mockSocket: any = {
      id: 'sock-1',
      data: { userId: 'waiter-1' },
      join: jest.fn(),
    };

    // Attempt to join AVO2
    const result = await posGateway.handleJoinBranch(mockSocket, { branchId: 'AVO2' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Forbidden');
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  // TEST 3: Kitchen gọi Payment API -> 403
  it('3. Kitchen gọi Payment API -> 403', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'chef-1',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'BRANCH_KITCHEN',
          permissions: [
            { permission: { key: 'kitchen.orders.view', scopeType: ScopeType.BRANCH } },
            { permission: { key: 'kitchen.item.ready', scopeType: ScopeType.BRANCH } },
          ],
        },
        branches: [{ branch: { id: 'AVO1', name: 'AVORA Quận 1' } }],
      },
    ]);

    const canCollect = await authorizationService.hasPermission('chef-1', 'pos.payment.collect');
    const canComplete = await authorizationService.hasPermission('chef-1', 'pos.payment.complete');

    expect(canCollect).toBe(false);
    expect(canComplete).toBe(false);
  });

  // TEST 4: Staff không refund gọi refund API -> 403
  it('4. Staff không refund gọi refund API -> 403', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'staff-1',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'BRANCH_STAFF',
          permissions: [
            { permission: { key: 'pos.order.create', scopeType: ScopeType.BRANCH } },
            { permission: { key: 'pos.payment.collect', scopeType: ScopeType.BRANCH } },
          ],
        },
        branches: [{ branch: { id: 'AVO1', name: 'AVORA Quận 1' } }],
      },
    ]);

    const canRefund = await authorizationService.hasPermission('staff-1', 'pos.payment.refund');
    const canOrderRefund = await authorizationService.hasPermission('staff-1', 'orders.refund');

    expect(canRefund).toBe(false);
    expect(canOrderRefund).toBe(false);
  });

  // TEST 5: User không roles.update sửa Role -> 403
  it('5. User không có quyền roles.update sửa Role -> 403', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'cashier-1',
        branchScope: BranchScopeType.ALL_BRANCHES,
        role: {
          code: 'CASHIER',
          permissions: [{ permission: { key: 'pos.access', scopeType: ScopeType.BRANCH } }],
        },
        branches: [],
      },
    ]);

    const canUpdateRole = await authorizationService.hasPermission('cashier-1', 'roles.update');
    expect(canUpdateRole).toBe(false);
  });

  // TEST 6: Manager tự cấp quyền cao hơn -> reject
  it('6. Manager tự cấp quyền cao hơn hoặc sửa ADMIN -> reject', async () => {
    mockPrisma.accessRole.findUnique.mockResolvedValue({
      id: 'role-admin',
      code: SYSTEM_ROLE_CODES.ADMIN,
      name: 'System Admin',
      permissions: [],
    });

    // Try to strip or modify ADMIN permissions
    await expect(
      rolesService.update('role-admin', { permissionKeys: ['orders.view'] }, 'mgr-1')
    ).rejects.toThrow(ForbiddenException);
  });

  // TEST 7: User tự nâng quyền -> reject
  it('7. User tự nâng quyền -> reject', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'user-normal',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'USER',
          permissions: [],
        },
        branches: [],
      },
    ]);

    const canAssign = await authorizationService.hasPermission('user-normal', 'roles.assign');
    expect(canAssign).toBe(false);
  });

  // TEST 8: Last System Admin removal -> reject
  it('8. Last System Admin removal -> reject', async () => {
    mockPrisma.userRoleAssignment.findUnique.mockResolvedValue({
      id: 'asg-admin-1',
      userId: 'admin-1',
      role: { code: SYSTEM_ROLE_CODES.ADMIN, name: 'Quản trị viên' },
      user: { id: 'admin-1', email: 'admin@avora.vn' },
    });

    // Only 1 admin in system
    mockPrisma.userRoleAssignment.count.mockResolvedValue(1);

    await expect(
      rolesService.removeAssignment('admin-1', 'role-admin', 'admin-1')
    ).rejects.toThrow(ForbiddenException);
  });

  // TEST 9: ALL_BRANCHES có branch mới tự động
  it('9. ALL_BRANCHES tự động bao gồm chi nhánh mới được tạo', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'auditor-1',
        branchScope: BranchScopeType.ALL_BRANCHES,
        role: {
          code: 'AUDITOR',
          permissions: [{ permission: { key: 'reports.view', scopeType: ScopeType.BRANCH } }],
        },
        branches: [],
      },
    ]);

    // System now has 3 branches (AVO3 added)
    mockPrisma.branch.findMany.mockResolvedValue([
      { id: 'AVO1', name: 'AVORA Quận 1' },
      { id: 'AVO2', name: 'AVORA Thảo Điền' },
      { id: 'AVO3', name: 'AVORA Đà Nẵng' }, // NEW
    ]);

    const allowed = await authorizationService.getAllowedBranches('auditor-1', 'reports.view');
    expect(allowed.branchIds).toContain('AVO3');
    expect(allowed.branchIds.length).toBe(3);
  });

  // TEST 10: SELECTED_BRANCHES không có branch mới
  it('10. SELECTED_BRANCHES không tự ý bao gồm chi nhánh mới', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'staff-avo1',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'STAFF',
          permissions: [{ permission: { key: 'pos.order.create', scopeType: ScopeType.BRANCH } }],
        },
        branches: [{ branch: { id: 'AVO1', name: 'AVORA Quận 1' } }],
      },
    ]);

    mockPrisma.branch.findMany.mockResolvedValue([
      { id: 'AVO1', name: 'AVORA Quận 1' },
      { id: 'AVO2', name: 'AVORA Thảo Điền' },
      { id: 'AVO3', name: 'AVORA Đà Nẵng' },
    ]);

    const allowed = await authorizationService.getAllowedBranches('staff-avo1', 'pos.order.create');
    expect(allowed.branchIds).toEqual(['AVO1']);
    expect(allowed.branchIds).not.toContain('AVO3');
  });

  // TEST 11: Multi-Role Multi-Branch (Manager AVO1 + Waiter AVO2)
  it('11. Manager AVO1 + Waiter AVO2: Manager permissions không được dùng ở AVO2', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      // Assignment 1: Manager at AVO1
      {
        userId: 'multi-user',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'BRANCH_MANAGER',
          permissions: [
            { permission: { key: 'orders.refund', scopeType: ScopeType.BRANCH } },
            { permission: { key: 'pos.item.add', scopeType: ScopeType.BRANCH } },
          ],
        },
        branches: [{ branch: { id: 'AVO1', name: 'AVORA Quận 1' } }],
      },
      // Assignment 2: Waiter at AVO2
      {
        userId: 'multi-user',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'BRANCH_WAITER',
          permissions: [
            { permission: { key: 'waiter.access', scopeType: ScopeType.BRANCH } },
            { permission: { key: 'pos.item.add', scopeType: ScopeType.BRANCH } },
          ],
        },
        branches: [{ branch: { id: 'AVO2', name: 'AVORA Thảo Điền' } }],
      },
    ]);

    // Can refund at AVO1? YES
    expect(await authorizationService.hasPermissionForBranch('multi-user', 'orders.refund', 'AVO1')).toBe(true);

    // Can refund at AVO2? NO! (Waiter does not have refund)
    expect(await authorizationService.hasPermissionForBranch('multi-user', 'orders.refund', 'AVO2')).toBe(false);

    // Can add item at AVO1? YES (from Manager)
    expect(await authorizationService.hasPermissionForBranch('multi-user', 'pos.item.add', 'AVO1')).toBe(true);

    // Can add item at AVO2? YES (from Waiter)
    expect(await authorizationService.hasPermissionForBranch('multi-user', 'pos.item.add', 'AVO2')).toBe(true);

    // Can access waiter at AVO2? YES
    expect(await authorizationService.hasPermissionForBranch('multi-user', 'waiter.access', 'AVO2')).toBe(true);

    // Can access waiter at AVO1? NO
    expect(await authorizationService.hasPermissionForBranch('multi-user', 'waiter.access', 'AVO1')).toBe(false);
  });

  // TEST 12: Frontend ẩn nút nhưng Postman gọi -> 403
  it('12. Frontend ẩn nút nhưng gọi API trực tiếp -> backend chặn 403', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'user-no-delete',
        branchScope: BranchScopeType.ALL_BRANCHES,
        role: {
          code: 'STAFF',
          permissions: [{ permission: { key: 'products.view', scopeType: ScopeType.BRANCH } }],
        },
        branches: [],
      },
    ]);

    const canDelete = await authorizationService.hasPermission('user-no-delete', 'products.delete');
    expect(canDelete).toBe(false);
  });

  // TEST 13: Permission revoke realtime -> access mất ngay
  it('13. Permission revoke realtime -> cache bị hủy và quyền mất ngay lập tức', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'user-revoked',
        branchScope: BranchScopeType.ALL_BRANCHES,
        role: {
          code: 'STAFF',
          permissions: [{ permission: { key: 'pos.discount.apply', scopeType: ScopeType.BRANCH } }],
        },
        branches: [],
      },
    ]);

    // Initial check -> true
    expect(await authorizationService.hasPermission('user-revoked', 'pos.discount.apply')).toBe(true);

    // Admin revokes permission in DB
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([]);

    // Without invalidation, cache would still return true
    authorizationService.invalidateUser('user-revoked');

    // After invalidation -> false immediately!
    expect(await authorizationService.hasPermission('user-revoked', 'pos.discount.apply')).toBe(false);
  });

  // TEST 14: View-only Product: xem được, sửa/xóa API -> 403
  it('14. View-only Product: xem được nhưng sửa/xóa bị chặn', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'view-only-user',
        branchScope: BranchScopeType.ALL_BRANCHES,
        role: {
          code: 'VIEWER',
          permissions: [{ permission: { key: 'products.view', scopeType: ScopeType.GLOBAL } }],
        },
        branches: [],
      },
    ]);

    expect(await authorizationService.hasPermission('view-only-user', 'products.view')).toBe(true);
    expect(await authorizationService.hasPermission('view-only-user', 'products.update')).toBe(false);
    expect(await authorizationService.hasPermission('view-only-user', 'products.delete')).toBe(false);
  });

  // TEST 15: POS-only Role: không vào Admin settings/KDS
  it('15. POS-only Role: không thể truy cập Admin settings hoặc KDS', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'pos-only-user',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'POS_CASHIER',
          permissions: [{ permission: { key: 'pos.access', scopeType: ScopeType.BRANCH } }],
        },
        branches: [{ branch: { id: 'AVO1', name: 'AVORA Quận 1' } }],
      },
    ]);

    expect(await authorizationService.hasPermission('pos-only-user', 'pos.access')).toBe(true);
    expect(await authorizationService.hasPermission('pos-only-user', 'admin.access')).toBe(false);
    expect(await authorizationService.hasPermission('pos-only-user', 'settings.general.view')).toBe(false);
    expect(await authorizationService.hasPermission('pos-only-user', 'kds.access')).toBe(false);
  });

  // TEST 16: KDS-only Role: không vào POS hoặc Admin
  it('16. KDS-only Role: không thể truy cập POS hoặc Admin', async () => {
    mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
      {
        userId: 'kds-only-user',
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        role: {
          code: 'BRANCH_KITCHEN',
          permissions: [{ permission: { key: 'kds.access', scopeType: ScopeType.BRANCH } }],
        },
        branches: [{ branch: { id: 'AVO1', name: 'AVORA Quận 1' } }],
      },
    ]);

    expect(await authorizationService.hasPermission('kds-only-user', 'kds.access')).toBe(true);
    expect(await authorizationService.hasPermission('kds-only-user', 'pos.access')).toBe(false);
    expect(await authorizationService.hasPermission('kds-only-user', 'admin.access')).toBe(false);
  });
});
