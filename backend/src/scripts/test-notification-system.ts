import { PrismaClient, RoleType, ScopeType, BranchScopeType } from '@prisma/client';
import { NotificationRecipientService } from '../notification/notification-recipient.service';
import { NotificationService } from '../notification/notification.service';
import { ForbiddenException } from '@nestjs/common';

const prisma = new PrismaClient();

async function runTests() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU TEST TOÀN DIỆN HỆ THỐNG NOTIFICATION REALTIME AVORA');
  console.log('================================================================\n');

  const mockGateway = {
    server: {
      to: () => ({
        emit: () => {},
      }),
    },
  } as any;

  const recipientService = new NotificationRecipientService(prisma as any);
  const notificationService = new NotificationService(prisma as any, mockGateway, mockGateway);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  try {
    // 0. Setup Test Data (Branches, Roles, Users)
    console.log('--- 0. THIẾT LẬP DỮ LIỆU TEST ---');
    const branch1 = await prisma.branch.upsert({
      where: { branchCode: 'AVO-TEST-1' },
      create: { name: 'AVORA Test Q1', branchCode: 'AVO-TEST-1', street: '1 Test', district: 'Q1', province: 'HCM' },
      update: {},
    });

    const branch2 = await prisma.branch.upsert({
      where: { branchCode: 'AVO-TEST-2' },
      create: { name: 'AVORA Test Q2', branchCode: 'AVO-TEST-2', street: '2 Test', district: 'Q2', province: 'HCM' },
      update: {},
    });

    // Customer user (strictly USER role)
    const customer = await prisma.user.upsert({
      where: { email: 'customer.test@avora.vn' },
      create: { email: 'customer.test@avora.vn', fullName: 'Khách Hàng Test', passwordHash: 'hash', role: RoleType.USER },
      update: { role: RoleType.USER },
    });

    // Staff AVO1 (WAITER role)
    const staffBranch1 = await prisma.user.upsert({
      where: { email: 'staff.avo1@avora.vn' },
      create: { email: 'staff.avo1@avora.vn', fullName: 'Staff AVO1', passwordHash: 'hash', role: RoleType.WAITER },
      update: { role: RoleType.WAITER },
    });

    // Staff AVO2 (WAITER role)
    const staffBranch2 = await prisma.user.upsert({
      where: { email: 'staff.avo2@avora.vn' },
      create: { email: 'staff.avo2@avora.vn', fullName: 'Staff AVO2', passwordHash: 'hash', role: RoleType.WAITER },
      update: { role: RoleType.WAITER },
    });

    // Marketing Staff (MANAGER role, Global scope, comments.view)
    const staffMarketing = await prisma.user.upsert({
      where: { email: 'marketing.test@avora.vn' },
      create: { email: 'marketing.test@avora.vn', fullName: 'Marketing Staff', passwordHash: 'hash', role: RoleType.MANAGER },
      update: { role: RoleType.MANAGER },
    });

    // Permissions
    const permOrdersView = await prisma.permission.upsert({
      where: { key: 'orders.view' },
      create: { key: 'orders.view', groupKey: 'orders', name: 'Xem đơn hàng', scopeType: ScopeType.BRANCH },
      update: {},
    });

    const permCommentsView = await prisma.permission.upsert({
      where: { key: 'comments.view' },
      create: { key: 'comments.view', groupKey: 'articles', name: 'Xem bình luận', scopeType: ScopeType.GLOBAL },
      update: {},
    });

    // Roles
    const rolePos = await prisma.accessRole.upsert({
      where: { code: 'TEST_POS_ROLE' },
      create: { code: 'TEST_POS_ROLE', name: 'Test POS Role', scopeType: ScopeType.BRANCH, isActive: true },
      update: {},
    });

    const roleMarketing = await prisma.accessRole.upsert({
      where: { code: 'TEST_MKT_ROLE' },
      create: { code: 'TEST_MKT_ROLE', name: 'Test Marketing Role', scopeType: ScopeType.GLOBAL, isActive: true },
      update: {},
    });

    // Role Permissions
    await prisma.rolePermission.upsert({
      where: { roleId_permissionKey: { roleId: rolePos.id, permissionKey: permOrdersView.key } },
      create: { roleId: rolePos.id, permissionKey: permOrdersView.key },
      update: {},
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionKey: { roleId: roleMarketing.id, permissionKey: permCommentsView.key } },
      create: { roleId: roleMarketing.id, permissionKey: permCommentsView.key },
      update: {},
    });

    // Clean old assignments for these test users
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: [customer.id, staffBranch1.id, staffBranch2.id, staffMarketing.id] } },
    });

    // Assign staffBranch1 to branch1 (SELECTED_BRANCHES)
    const assign1 = await prisma.userRoleAssignment.create({
      data: {
        userId: staffBranch1.id,
        roleId: rolePos.id,
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        isActive: true,
        branches: {
          create: [{ branchId: branch1.id }],
        },
      },
    });

    // Assign staffBranch2 to branch2 (SELECTED_BRANCHES)
    const assign2 = await prisma.userRoleAssignment.create({
      data: {
        userId: staffBranch2.id,
        roleId: rolePos.id,
        branchScope: BranchScopeType.SELECTED_BRANCHES,
        isActive: true,
        branches: {
          create: [{ branchId: branch2.id }],
        },
      },
    });

    // Assign staffMarketing to GLOBAL (ALL_BRANCHES)
    await prisma.userRoleAssignment.create({
      data: {
        userId: staffMarketing.id,
        roleId: roleMarketing.id,
        branchScope: BranchScopeType.ALL_BRANCHES,
        isActive: true,
      },
    });

    console.log('✅ Dữ liệu test khởi tạo thành công.\n');

    // TEST 1: Customer exclusion
    console.log('--- TEST 1: KHÁCH HÀNG (USER) TUYỆT ĐỐI KHÔNG NHẬN STAFF NOTIFICATION ---');
    const orderRecipients = await recipientService.resolveRecipients({
      eventType: 'ONLINE_ORDER_CREATED',
      branchId: branch1.id,
      requiredPermissions: ['orders.view'],
      appScopes: ['POS', 'ADMIN'],
    });
    const orderRecipientIds = orderRecipients.map((r) => r.id);

    assert(!orderRecipientIds.includes(customer.id), 'Khách hàng customer.test không nằm trong danh sách người nhận đơn hàng');

    // TEST 2: Multi-Branch Isolation
    console.log('\n--- TEST 2: CÔ LẬP ĐƠN VỊ CHI NHÁNH (MULTI-BRANCH ISOLATION) ---');
    assert(orderRecipientIds.includes(staffBranch1.id), 'Staff AVO1 nhận thông báo đơn hàng của AVO1');
    assert(!orderRecipientIds.includes(staffBranch2.id), 'Staff AVO2 KHÔNG nhận thông báo đơn hàng của AVO1 (chống cross-branch leak)');

    // TEST 3: Permission-specific targeting (Comments vs Kitchen)
    console.log('\n--- TEST 3: PHÂN QUYỀN CHUYÊN BIỆT (COMMENTS VS KITCHEN/POS) ---');
    const commentRecipients = await recipientService.resolveRecipients({
      eventType: 'ARTICLE_COMMENT_CREATED',
      requiredPermissions: ['comments.view'],
      appScopes: ['ADMIN'],
    });
    const commentRecipientIds = commentRecipients.map((r) => r.id);

    assert(commentRecipientIds.includes(staffMarketing.id), 'Staff Marketing (có comments.view) nhận thông báo bình luận');
    assert(!commentRecipientIds.includes(staffBranch1.id), 'Staff POS AVO1 KHÔNG nhận thông báo bình luận');
    assert(!commentRecipientIds.includes(staffBranch2.id), 'Staff POS AVO2 KHÔNG nhận thông báo bình luận');
    assert(!commentRecipientIds.includes(customer.id), 'Khách hàng KHÔNG nhận thông báo bình luận');

    // TEST 4: Idempotency & Database Persistence
    console.log('\n--- TEST 4: IDEMPOTENCY & CHỐNG DUPLICATE EVENT DATABASE ---');
    const testEventId = `TEST_EVT_${Date.now()}`;
    
    // Clean up any test notifs
    await prisma.notification.deleteMany({ where: { eventId: testEventId } });

    // Insert 1st time
    await prisma.notification.createMany({
      data: [
        {
          userId: staffBranch1.id,
          branchId: branch1.id,
          eventId: testEventId,
          eventType: 'ONLINE_ORDER_CREATED',
          category: 'ORDER',
          title: 'Đơn hàng mới',
          content: 'Đơn hàng online vừa tạo',
          priority: 2,
        },
      ],
      skipDuplicates: true,
    });

    // Attempt duplicate insert with same eventId + userId (e.g. repeated payment webhook)
    await prisma.notification.createMany({
      data: [
        {
          userId: staffBranch1.id,
          branchId: branch1.id,
          eventId: testEventId,
          eventType: 'ONLINE_ORDER_CREATED',
          category: 'ORDER',
          title: 'Đơn hàng mới (RETRY)',
          content: 'Đơn hàng online vừa tạo',
          priority: 2,
        },
      ],
      skipDuplicates: true,
    });

    const notifCount = await prisma.notification.count({
      where: { eventId: testEventId, userId: staffBranch1.id },
    });

    assert(notifCount === 1, 'Idempotency thành công: Đúng 1 notification được lưu dù webhook retry 2 lần');

    // TEST 5: IDOR Protection on Mark As Read
    console.log('\n--- TEST 5: BẢO MẬT IDOR KHI ĐÁNH DẤU ĐÃ ĐỌC ---');
    const targetNotif = await prisma.notification.findFirst({
      where: { eventId: testEventId, userId: staffBranch1.id },
    });

    let idorCaught = false;
    try {
      // staffBranch2 attempts to mark read staffBranch1's notification
      await notificationService.markAsRead(staffBranch2.id, targetNotif!.id);
    } catch (e) {
      if (e instanceof ForbiddenException) {
        idorCaught = true;
      }
    }

    assert(idorCaught, 'IDOR chặn thành công: Staff AVO2 không thể đánh dấu đã đọc notification của Staff AVO1 (403 Forbidden)');

    // TEST 6: Mark As Read ownership verified & unread count decrement
    console.log('\n--- TEST 6: CHỦ SỞ HỮU ĐÁNH DẤU ĐÃ ĐỌC THÀNH CÔNG ---');
    const resBefore = await notificationService.getUnreadCount(staffBranch1.id);
    await notificationService.markAsRead(staffBranch1.id, targetNotif!.id);
    const resAfter = await notificationService.getUnreadCount(staffBranch1.id);

    const updatedNotif = await prisma.notification.findUnique({
      where: { id: targetNotif!.id },
    });

    assert(updatedNotif?.isRead === true, 'Notification được cập nhật isRead = true');
    assert(updatedNotif?.readAt !== null, 'Notification ghi nhận timestamp readAt chính xác');
    assert(resBefore.unreadCount - resAfter.unreadCount === 1, 'Unread count giảm chính xác 1 đơn vị');

    // TEST 7: Clean up test records
    console.log('\n--- TEST 7: DỌN DẸP DỮ LIỆU TEST ---');
    await prisma.notification.deleteMany({ where: { eventId: testEventId } });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: [customer.id, staffBranch1.id, staffBranch2.id, staffMarketing.id] } },
    });
    assert(true, 'Dọn dẹp dữ liệu test hoàn tất');

  } catch (error) {
    console.error('❌ Lỗi trong quá trình chạy test:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`🏁 KẾT QUẢ TEST: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
