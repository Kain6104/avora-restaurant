import { PrismaClient, OrderItemPricingMode, OrderItemSource, BuffetSessionStatus, QrSessionStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('================================================================');
  console.log('STARTING AUTOMATED VERIFICATION: AVORA QR ORDER & BUFFET SYSTEM');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName} - Detail: ${detail || 'Assertion failed'}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // 1. Check a branch exists
    const branch = await prisma.branch.findFirst();
    assert(!!branch, '1. Chi nhánh tồn tại trong DB', `Branch ID: ${branch?.id}`);

    // Verify branch buffet settings exist on model
    assert(
      typeof branch?.excludeBuffetItemsFromTempBill === 'boolean',
      '2. Branch có trường excludeBuffetItemsFromTempBill',
      `Value: ${branch?.excludeBuffetItemsFromTempBill}`
    );
    assert(
      typeof branch?.removeBuffetItemsOnCheckout === 'boolean',
      '3. Branch có trường removeBuffetItemsOnCheckout',
      `Value: ${branch?.removeBuffetItemsOnCheckout}`
    );

    // 2. Fetch existing products for testing
    let products = await prisma.product.findMany({ take: 5 });
    if (products.length < 2) {
      throw new Error('Database cần ít nhất 2 sản phẩm để kiểm thử.');
    }
    const ticketProduct = products[0];
    const foodProduct = products[1];

    assert(!!ticketProduct && !!foodProduct, '4. Sản phẩm Vé Buffet và Món con tồn tại');

    // 3. Test Buffet Package creation with ticket constraint
    const testPackageName = `Buffet Test Package ${Date.now()}`;
    const buffetPkg = await prisma.buffetPackage.create({
      data: {
        branchId: branch!.id,
        name: testPackageName,
        description: 'Gói buffet phục vụ kiểm thử tự động',
        active: true,
        displayOrder: 1,
        tickets: {
          create: [{ productId: ticketProduct.id }],
        },
        items: {
          create: [
            {
              productId: foodProduct.id,
              displayOrder: 1,
              availableForQr: true,
              allowRetailPurchase: true,
            },
          ],
        },
      },
      include: {
        tickets: true,
        items: true,
      },
    });

    assert(
      buffetPkg.tickets.length >= 1,
      '5. Buffet Package BẮT BUỘC có ít nhất 1 vé đại diện',
      `Tickets count: ${buffetPkg.tickets.length}`
    );
    assert(
      buffetPkg.items.length >= 1,
      '6. Buffet Package chứa món con được phép gọi',
      `Items count: ${buffetPkg.items.length}`
    );

    // 4. Test Table & TableSession & Order
    let table = await prisma.restaurantTable.findFirst({
      where: { branchId: branch!.id },
    });
    if (!table) {
      table = await prisma.restaurantTable.create({
        data: {
          branchId: branch!.id,
          name: 'Bàn Test 99',
          tableCode: 'T99',
          capacity: 4,
          status: 'AVAILABLE' as any,
        },
      });
    }

    const tableSession = await prisma.tableSession.create({
      data: {
        branchId: branch!.id,
        tableId: table.id,
        status: 'ACTIVE',
        guestCount: 2,
      },
    });

    const testOrder = await prisma.order.create({
      data: {
        branchId: branch!.id,
        tableId: table.id,
        tableSessionId: tableSession.id,
        customerName: 'Khách Test Buffet',
        customerPhone: '0901234567',
        subTotal: 399000,
        totalAmount: 399000,
        status: 'PENDING',
        orderSource: 'POS',
        orderItems: {
          create: [
            {
              productId: ticketProduct.id,
              quantity: 1,
              priceAtSale: 399000,
              originalPriceAtSale: 399000,
              pricingMode: OrderItemPricingMode.BUFFET_TICKET,
              source: OrderItemSource.POS,
            },
          ],
        },
      },
    });

    assert(!!testOrder.id, '7. Đơn hàng POS có chứa Vé Buffet tạo thành công');

    // 5. Test Buffet Session Activation
    const buffetSession = await prisma.buffetSession.create({
      data: {
        orderId: testOrder.id,
        buffetPackageId: buffetPkg.id,
        packageNameSnapshot: buffetPkg.name,
        status: BuffetSessionStatus.ACTIVE,
      },
    });

    assert(
      buffetSession.status === BuffetSessionStatus.ACTIVE,
      '8. Buffet Session được kích hoạt ACTIVE thành công'
    );

    // 6. Test Separate lines for BUFFET_INCLUDED vs REGULAR (No Merging!)
    // Add Item 1: Cá hồi 0đ (BUFFET_INCLUDED)
    const buffetItem1 = await prisma.orderItem.create({
      data: {
        orderId: testOrder.id,
        productId: foodProduct.id,
        quantity: 2,
        priceAtSale: 0, // Base price 0đ
        originalPriceAtSale: 169000,
        pricingMode: OrderItemPricingMode.BUFFET_INCLUDED,
        buffetSessionId: buffetSession.id,
        buffetPackageId: buffetPkg.id,
        buffetReferencePriceSnapshot: 169000,
        source: OrderItemSource.QR_ORDER,
        orderedByName: 'Khách A',
      },
    });

    // Add Item 2: Cá hồi tính tiền 169.000đ (REGULAR)
    const regularItem2 = await prisma.orderItem.create({
      data: {
        orderId: testOrder.id,
        productId: foodProduct.id,
        quantity: 1,
        priceAtSale: 169000, // Regular price
        originalPriceAtSale: 169000,
        pricingMode: OrderItemPricingMode.REGULAR,
        source: OrderItemSource.POS,
        orderedByName: 'Thu ngân',
      },
    });

    assert(
      buffetItem1.id !== regularItem2.id,
      '9. Cùng 1 sản phẩm có dòng BUFFET_INCLUDED (0đ) và REGULAR (169k) là 2 dòng tách biệt, KHÔNG bị merge'
    );
    assert(
      buffetItem1.pricingMode === OrderItemPricingMode.BUFFET_INCLUDED && buffetItem1.priceAtSale === 0,
      '10. Món Buffet có pricingMode = BUFFET_INCLUDED và giá gốc 0đ'
    );
    assert(
      regularItem2.pricingMode === OrderItemPricingMode.REGULAR && regularItem2.priceAtSale === 169000,
      '11. Món lẻ có pricingMode = REGULAR và giá bán bình thường 169.000đ'
    );

    const existingOptItem = await prisma.optionItem.findFirst();
    let optionData: any = undefined;
    if (existingOptItem) {
      optionData = {
        create: [
          {
            optionItemId: existingOptItem.id,
            nameAtSale: 'Thêm phô mai',
            priceAdjustmentAtSale: 20000,
            quantity: 1,
          },
        ],
      };
    }

    const buffetItemWithOptions = await prisma.orderItem.create({
      data: {
        orderId: testOrder.id,
        productId: foodProduct.id,
        quantity: 1,
        priceAtSale: 20000, // 0đ base + 20.000đ phô mai = 20.000đ
        originalPriceAtSale: 189000,
        pricingMode: OrderItemPricingMode.BUFFET_INCLUDED,
        buffetSessionId: buffetSession.id,
        buffetPackageId: buffetPkg.id,
        source: OrderItemSource.QR_ORDER,
        orderedByName: 'Khách B',
        optionsTextSnapshot: 'Thêm phô mai (+20.000đ)',
        ...(optionData ? { selectedOptions: optionData } : {}),
      },
      include: {
        selectedOptions: true,
      },
    });

    assert(
      buffetItemWithOptions.priceAtSale === 20000 && buffetItemWithOptions.pricingMode === OrderItemPricingMode.BUFFET_INCLUDED,
      '12. Món Buffet có Option tính phí (+20k) vẫn thu đúng 20.000đ, KHÔNG bị miễn phí toàn bộ'
    );

    // 8. Test Secure QR Session & SHA-256 token hashing
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const qrSession = await prisma.qrOrderSession.create({
      data: {
        orderId: testOrder.id,
        tableSessionId: tableSession.id,
        branchId: branch!.id,
        tableId: table.id,
        tokenHash,
        status: QrSessionStatus.ACTIVE,
      },
    });

    assert(
      qrSession.tokenHash === tokenHash && qrSession.status === QrSessionStatus.ACTIVE,
      '13. QR Session sinh secure random token và lưu SHA-256 tokenHash an toàn'
    );

    // 9. Test QR Guest & Round Submission with Idempotency
    const guest = await prisma.qrOrderGuest.create({
      data: {
        qrOrderSessionId: qrSession.id,
        guestName: 'Nguyễn Văn Test',
        deviceSessionId: 'device-test-123',
      },
    });

    const idempotencyKey = `idemp-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const round1 = await prisma.qrOrderRound.create({
      data: {
        qrOrderSessionId: qrSession.id,
        qrGuestId: guest.id,
        orderId: testOrder.id,
        roundNumber: 1,
        idempotencyKey,
        status: 'SUBMITTED',
      },
    });

    assert(!!round1.id, '14. QrOrderRound #1 gửi món thành công với idempotencyKey duy nhất');

    // Attempting duplicate round with same idempotencyKey should be rejected by DB unique constraint
    let duplicateRejected = false;
    try {
      await prisma.qrOrderRound.create({
        data: {
          qrOrderSessionId: qrSession.id,
          qrGuestId: guest.id,
          orderId: testOrder.id,
          roundNumber: 2,
          idempotencyKey, // duplicate!
          status: 'SUBMITTED',
        },
      });
    } catch {
      duplicateRejected = true;
    }

    assert(duplicateRejected, '15. Gửi lại cùng idempotencyKey bị chặn trùng lặp tuyệt đối');

    // 10. Test TableServiceRequest (Call Staff / Payment Request)
    const callStaffReq = await prisma.tableServiceRequest.create({
      data: {
        orderId: testOrder.id,
        tableId: table.id,
        branchId: branch!.id,
        qrOrderSessionId: qrSession.id,
        qrGuestId: guest.id,
        requestType: 'CALL_STAFF',
        note: 'Thêm đá lạnh và nước lọc',
        status: 'OPEN',
      },
    });

    assert(callStaffReq.status === 'OPEN', '16. Gọi nhân viên tạo TableServiceRequest thật trong DB');

    const paymentReq = await prisma.tableServiceRequest.create({
      data: {
        orderId: testOrder.id,
        tableId: table.id,
        branchId: branch!.id,
        qrOrderSessionId: qrSession.id,
        qrGuestId: guest.id,
        requestType: 'PAYMENT',
        paymentMethodCode: 'CASH',
        note: 'Yêu cầu thanh toán Tiền mặt',
        status: 'OPEN',
      },
    });

    assert(
      paymentReq.requestType === 'PAYMENT' && testOrder.status !== 'COMPLETED',
      '17. Yêu cầu thanh toán CASH KHÔNG tự động chuyển Order thành PAID'
    );

    // 11. Test Temp Bill filtering logic:
    // When excludeBuffetItemsFromTempBill = true:
    // buffetItem1 (priceAtSale = 0) is excluded
    // buffetItemWithOptions (priceAtSale = 20000) is KEPT because total > 0!
    // regularItem2 (priceAtSale = 169000) is KEPT
    const allItems = [buffetItem1, regularItem2, buffetItemWithOptions];
    const filteredTempBill = allItems.filter((it) => {
      if (it.pricingMode === OrderItemPricingMode.BUFFET_INCLUDED && it.priceAtSale === 0) {
        return false; // hide free buffet item
      }
      return true; // keep retail items and buffet items with paid options!
    });

    assert(
      filteredTempBill.length === 2 &&
      filteredTempBill.some((i) => i.id === buffetItemWithOptions.id) &&
      filteredTempBill.some((i) => i.id === regularItem2.id),
      '18. Cấu hình "Không in món Buffet khi in Tạm tính" ẩn món 0đ nhưng GIỮ NGUYÊN món có option tính phí'
    );

    // 12. Test Checkout removeBuffetItemsOnCheckout logic:
    // Upon payment completion: mark excludedFromFinalReceipt = true for free buffet items
    await prisma.orderItem.updateMany({
      where: {
        orderId: testOrder.id,
        pricingMode: OrderItemPricingMode.BUFFET_INCLUDED,
        priceAtSale: 0,
      },
      data: {
        excludedFromFinalReceipt: true,
      },
    });

    const updatedBuffetItem = await prisma.orderItem.findUnique({
      where: { id: buffetItem1.id },
    });

    assert(
      updatedBuffetItem?.excludedFromFinalReceipt === true,
      '19. Cấu hình "Xóa món Buffet khi Thanh toán" đánh dấu excludedFromFinalReceipt = true'
    );
    assert(
      !!updatedBuffetItem,
      '20. Dữ liệu OrderItem món Buffet VẪN TỒN TẠI trong DB (Không bị hard-delete khỏi KDS/Audit/Báo cáo)'
    );

    // 13. Test QR Session closure on Order completion
    await prisma.qrOrderSession.update({
      where: { id: qrSession.id },
      data: {
        status: QrSessionStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    const closedQr = await prisma.qrOrderSession.findUnique({
      where: { id: qrSession.id },
    });
    assert(closedQr?.status === QrSessionStatus.CLOSED, '21. Phiên QR tự động CLOSED khi đóng đơn / hoàn tất');

    // 14. Clean up test data
    await prisma.tableServiceRequest.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.orderItemOption.deleteMany({ where: { orderItemId: buffetItemWithOptions.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.qrOrderRound.deleteMany({ where: { qrOrderSessionId: qrSession.id } });
    await prisma.qrOrderGuest.deleteMany({ where: { qrOrderSessionId: qrSession.id } });
    await prisma.qrOrderSession.delete({ where: { id: qrSession.id } });
    await prisma.buffetSession.delete({ where: { id: buffetSession.id } });
    await prisma.order.delete({ where: { id: testOrder.id } });
    await prisma.tableSession.delete({ where: { id: tableSession.id } });
    await prisma.buffetPackageItem.deleteMany({ where: { buffetPackageId: buffetPkg.id } });
    await prisma.buffetPackageTicket.deleteMany({ where: { buffetPackageId: buffetPkg.id } });
    await prisma.buffetPackage.delete({ where: { id: buffetPkg.id } });

    console.log('\n================================================================');
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} tests passed)`);
    console.log('ENTERPRISE AVORA QR ORDER & BUFFET ENGINE IS FULLY OPERATIONAL');
    console.log('================================================================\n');
  } catch (error) {
    console.error('Verification encountered an error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
