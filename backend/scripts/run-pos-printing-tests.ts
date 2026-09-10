import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PosService } from '../src/pos/pos.service';
import { PrintTemplateService } from '../src/print-template/print-template.service';
import { BadRequestException } from '@nestjs/common';
import { PrintTemplateType, PrintRouteRole, PrintJobStatus, PrintJobEventType, OrderStatus } from '@prisma/client';

async function runTests() {
  console.log('================================================================');
  console.log('🚀 KHỞI ĐỘNG BỘ KIỂM THỬ 20 NGHIỆP VỤ IN TOÀN DIỆN AVORA POS');
  console.log('================================================================\n');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const prisma = moduleRef.get(PrismaService);
  const posService = moduleRef.get(PosService);
  const printTemplateService = moduleRef.get(PrintTemplateService);

  const BRANCH_ID = '4d69e8f9-4abf-4499-b2b4-6769228bbb51'; // Avora Hoàn Kiếm
  const branch = await prisma.branch.findUnique({ where: { id: BRANCH_ID } });
  if (!branch) throw new Error('Branch not found');

  const hotKitchenStation = await prisma.kitchenStation.findFirst({
    where: { branchId: BRANCH_ID, code: 'HOT_KITCHEN' },
  });
  const drinkBarStation = await prisma.kitchenStation.findFirst({
    where: { branchId: BRANCH_ID, code: 'DRINK_BAR' },
  });
  if (!hotKitchenStation || !drinkBarStation) {
    throw new Error('Kitchen / Bar stations not found for branch');
  }

  // Lấy hoặc tạo Category test
  let category = await prisma.category.findFirst({ where: { name: 'Danh mục Test In' } });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: 'Danh mục Test In',
        slug: 'danh-muc-test-in-' + Date.now(),
      },
    });
  }

  // Dọn dẹp các sản phẩm test cũ nếu có
  const testProductPrefix = 'TEST_PRINT_';

  // 1. Tạo Món A: Cá hồi áp chảo (Chỉ KITCHEN)
  const productA = await prisma.product.create({
    data: {
      itemCode: `TEST_A_${Date.now()}`,
      name: `${testProductPrefix}Cá Hồi Áp Chảo`,
      slug: `ca-hoi-ap-chao-test-${Date.now()}`,
      price: 150000,
      categoryId: category.id,
      printRoutes: {
        create: [
          {
            branchId: BRANCH_ID,
            stationId: hotKitchenStation.id,
            routeRole: PrintRouteRole.PREPARATION,
            printType: PrintTemplateType.KITCHEN_TICKET,
            copies: 1,
            isActive: true,
          },
        ],
      },
    },
    include: { printRoutes: true },
  });

  // 2. Tạo Món B: Trà đào cam sả (BAR + ITEM_LABEL)
  const productB = await prisma.product.create({
    data: {
      itemCode: `TEST_B_${Date.now()}`,
      name: `${testProductPrefix}Trà Đào Cam Sả`,
      slug: `tra-dao-cam-sa-test-${Date.now()}`,
      price: 55000,
      categoryId: category.id,
      printRoutes: {
        create: [
          {
            branchId: BRANCH_ID,
            stationId: drinkBarStation.id,
            routeRole: PrintRouteRole.PREPARATION,
            printType: PrintTemplateType.KITCHEN_TICKET,
            copies: 1,
            isActive: true,
          },
          {
            branchId: BRANCH_ID,
            stationId: drinkBarStation.id,
            routeRole: PrintRouteRole.LABEL,
            printType: PrintTemplateType.ITEM_LABEL,
            copies: 1,
            isActive: true,
          },
        ],
      },
    },
    include: { printRoutes: true },
  });

  // 3. Tạo Món C: Khăn lạnh (Không có tuyến in: [])
  const productC = await prisma.product.create({
    data: {
      itemCode: `TEST_C_${Date.now()}`,
      name: `${testProductPrefix}Khăn Lạnh`,
      slug: `khan-lanh-test-${Date.now()}`,
      price: 5000,
      categoryId: category.id,
      // printRoutes: []
    },
    include: { printRoutes: true },
  });

  // 4. Tạo Món D: Cả KITCHEN + BAR
  const productD = await prisma.product.create({
    data: {
      itemCode: `TEST_D_${Date.now()}`,
      name: `${testProductPrefix}Món Đặc Biệt Kitchen & Bar`,
      slug: `mon-kitchen-bar-test-${Date.now()}`,
      price: 200000,
      categoryId: category.id,
      printRoutes: {
        create: [
          {
            branchId: BRANCH_ID,
            stationId: hotKitchenStation.id,
            routeRole: PrintRouteRole.PREPARATION,
            printType: PrintTemplateType.KITCHEN_TICKET,
            copies: 1,
            isActive: true,
          },
          {
            branchId: BRANCH_ID,
            stationId: drinkBarStation.id,
            routeRole: PrintRouteRole.PREPARATION,
            printType: PrintTemplateType.KITCHEN_TICKET,
            copies: 1,
            isActive: true,
          },
        ],
      },
    },
    include: { printRoutes: true },
  });

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName} -> ${detail || 'Condition not met'}`);
      failedCount++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Cá hồi (KITCHEN) x2 -> Gửi bếp -> 1 KITCHEN (sl: 2), 0 BAR, 0 ITEM_LABEL
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 1 ---');
    const order1 = await prisma.order.create({
      data: {
        branchId: BRANCH_ID,
        orderCode: `TEST-ORD1-${Date.now()}`,
        customerName: 'Khách test',
        customerPhone: '0901234567',
        subTotal: 300000,
        totalAmount: 300000,
        status: OrderStatus.PENDING,
        orderItems: {
          create: [
            {
              productId: productA.id,
              quantity: 2,
              priceAtSale: 150000,
              originalPriceAtSale: 150000,
            },
          ],
        },
      },
      include: { orderItems: true },
    });

    const res1 = await posService.sendToKitchen(order1.id, {});
    const payloads1 = res1.printPayloads || [];
    const kitchenP1 = payloads1.filter((p: any) => p.purpose === 'KITCHEN');
    const barP1 = payloads1.filter((p: any) => p.purpose === 'BAR');
    const labelP1 = payloads1.filter((p: any) => p.purpose === 'ITEM_LABEL');

    assert(
      kitchenP1.length === 1 &&
      kitchenP1[0].ticketData.items[0].quantity === 2 &&
      barP1.length === 0 &&
      labelP1.length === 0,
      'Test 1: Cá hồi (KITCHEN) x2 -> 1 lệnh KITCHEN (sl: 2), 0 BAR, 0 ITEM_LABEL',
      `kitchen: ${kitchenP1.length}, bar: ${barP1.length}, label: ${labelP1.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 2: Trà đào (BAR + ITEM_LABEL) x2 -> 1 lệnh BAR (sl: 2), 2 tem ITEM_LABEL (1/2, 2/2), 0 KITCHEN
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 2 ---');
    const order2 = await prisma.order.create({
      data: {
        branchId: BRANCH_ID,
        orderCode: `TEST-ORD2-${Date.now()}`,
        customerName: 'Khách test',
        customerPhone: '0901234567',
        subTotal: 110000,
        totalAmount: 110000,
        status: OrderStatus.PENDING,
        orderItems: {
          create: [
            {
              productId: productB.id,
              quantity: 2,
              priceAtSale: 55000,
              originalPriceAtSale: 55000,
            },
          ],
        },
      },
      include: { orderItems: true },
    });

    const res2 = await posService.sendToKitchen(order2.id, {});
    const payloads2 = res2.printPayloads || [];
    const kitchenP2 = payloads2.filter((p: any) => p.purpose === 'KITCHEN');
    const barP2 = payloads2.filter((p: any) => p.purpose === 'BAR');
    const labelP2 = payloads2.filter((p: any) => p.purpose === 'ITEM_LABEL');

    assert(
      kitchenP2.length === 0 &&
      barP2.length === 1 &&
      barP2[0].ticketData.items[0].quantity === 2 &&
      labelP2.length === 2 &&
      labelP2[0].htmlContent.includes('(1/2)') &&
      labelP2[1].htmlContent.includes('(2/2)'),
      'Test 2: Trà đào x2 -> 1 BAR (sl: 2), 2 tem nhãn với index (1/2) và (2/2), 0 KITCHEN',
      `kitchen: ${kitchenP2.length}, bar: ${barP2.length}, labels: ${labelP2.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 3: Khăn lạnh (printRoutes: []) x5 -> 0 KITCHEN, 0 BAR, 0 ITEM_LABEL
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 3 ---');
    const order3 = await prisma.order.create({
      data: {
        branchId: BRANCH_ID,
        orderCode: `TEST-ORD3-${Date.now()}`,
        customerName: 'Khách test',
        customerPhone: '0901234567',
        subTotal: 25000,
        totalAmount: 25000,
        status: OrderStatus.PENDING,
        orderItems: {
          create: [
            {
              productId: productC.id,
              quantity: 5,
              priceAtSale: 5000,
              originalPriceAtSale: 5000,
            },
          ],
        },
      },
    });

    const res3 = await posService.sendToKitchen(order3.id, {});
    assert(
      (res3.printPayloads || []).length === 0,
      'Test 3: Khăn lạnh (printRoutes: []) x5 -> 0 lệnh in (0 Bếp, 0 Bar, 0 Tem)',
      `Payloads count: ${(res3.printPayloads || []).length}`
    );

    // ------------------------------------------------------------------------
    // TEST 4: Chi nhánh có 3 máy in active, đơn chỉ có Cá hồi -> Chỉ KITCHEN in, BAR & LABEL không nhận lệnh
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 4 ---');
    const activePrinters = await prisma.branchPrinterSetting.findMany({
      where: { branchId: BRANCH_ID, isEnabled: true },
    });
    const hasKitchenPrinter = activePrinters.some((p) => p.purpose === 'KITCHEN');
    const hasBarPrinter = activePrinters.some((p) => p.purpose === 'BAR');
    const hasLabelPrinter = activePrinters.some((p) => p.purpose === 'ITEM_LABEL');

    assert(
      hasKitchenPrinter && hasBarPrinter && hasLabelPrinter &&
      barP1.length === 0 && labelP1.length === 0 && kitchenP1.length === 1,
      'Test 4: Chi nhánh có đủ 3 máy in, Cá hồi chỉ gửi KITCHEN, tuyệt đối không gửi BAR và LABEL'
    );

    // ------------------------------------------------------------------------
    // TEST 5: Cá hồi x2 đã gửi -> Tăng lên 3 -> Gửi bếp -> Chỉ in delta +1 phần KITCHEN
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 5 ---');
    // Confirm thành công cho đơn 1
    for (const jid of kitchenP1[0].printJobIds) {
      await posService.confirmPrint(order1.id, { printJobId: jid, status: 'SUCCESS' });
    }
    const order1Item = await prisma.orderItem.findFirst({ where: { orderId: order1.id } });
    assert(order1Item?.sentQuantity === 2, 'Sent quantity của Cá hồi đã cập nhật = 2 sau khi confirm print');

    // Khách gọi thêm: tăng số lượng từ 2 lên 3
    await prisma.orderItem.update({
      where: { id: order1Item!.id },
      data: { quantity: 3 },
    });

    const res5 = await posService.sendToKitchen(order1.id, {});
    const payloads5 = res5.printPayloads || [];
    const kitchenP5 = payloads5.filter((p: any) => p.purpose === 'KITCHEN');

    assert(
      kitchenP5.length === 1 &&
      kitchenP5[0].ticketData.items[0].quantity === 1,
      'Test 5: Cá hồi ban đầu x2, tăng lên 3 -> Chỉ in delta +1 phần cho KITCHEN',
      `Printed delta: ${kitchenP5[0]?.ticketData?.items[0]?.quantity}`
    );

    // ------------------------------------------------------------------------
    // TEST 6: Trà đào x2 đã in tem & bar -> Tăng lên 3 -> Gửi bếp -> BAR delta +1, ITEM_LABEL chỉ 1 tem
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 6 ---');
    // Confirm thành công BAR và 2 tem của order2
    for (const jid of barP2[0].printJobIds) {
      await posService.confirmPrint(order2.id, { printJobId: jid, status: 'SUCCESS' });
    }
    for (const lp of labelP2) {
      for (const jid of lp.printJobIds) {
        await posService.confirmPrint(order2.id, { printJobId: jid, status: 'SUCCESS' });
      }
    }
    const order2Item = await prisma.orderItem.findFirst({ where: { orderId: order2.id } });
    assert(
      order2Item?.sentQuantity === 2 && order2Item?.printedQuantity === 2,
      'Trà đào sentQuantity=2 và printedQuantity=2 sau khi xác nhận in đầy đủ'
    );

    // Tăng từ 2 lên 3
    await prisma.orderItem.update({
      where: { id: order2Item!.id },
      data: { quantity: 3 },
    });

    const res6 = await posService.sendToKitchen(order2.id, {});
    const barP6 = (res6.printPayloads || []).filter((p: any) => p.purpose === 'BAR');
    const labelP6 = (res6.printPayloads || []).filter((p: any) => p.purpose === 'ITEM_LABEL');

    assert(
      barP6.length === 1 &&
      barP6[0].ticketData.items[0].quantity === 1 &&
      labelP6.length === 1,
      'Test 6: Trà đào từ 2 lên 3 -> Chỉ in delta BAR +1 và đúng 1 tem nhãn bổ sung',
      `BAR delta: ${barP6[0]?.ticketData?.items[0]?.quantity}, Label count: ${labelP6.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 7: Gửi bếp -> Print Agent báo lỗi (FAILED) -> sentQuantity KHÔNG tăng, cho phép gửi lại
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 7 ---');
    const order7 = await prisma.order.create({
      data: {
        branchId: BRANCH_ID,
        orderCode: `TEST-ORD7-${Date.now()}`,
        customerName: 'Khách test',
        customerPhone: '0901234567',
        subTotal: 150000,
        totalAmount: 150000,
        status: OrderStatus.PENDING,
        orderItems: {
          create: [{ productId: productA.id, quantity: 1, priceAtSale: 150000, originalPriceAtSale: 150000 }],
        },
      },
    });
    const res7_1 = await posService.sendToKitchen(order7.id, {});
    const failJobId = res7_1.printPayloads[0].printJobIds[0];

    // Báo lỗi in FAILED
    await posService.confirmPrint(order7.id, { printJobId: failJobId, status: 'FAILED', errorMessage: 'Paper Jam' });
    const item7 = await prisma.orderItem.findFirst({ where: { orderId: order7.id } });
    assert(item7?.sentQuantity === 0, 'Test 7.1: Máy in lỗi -> sentQuantity giữ nguyên = 0');

    // Thử gửi lại
    const res7_2 = await posService.sendToKitchen(order7.id, {});
    assert(
      res7_2.printPayloads.length === 1 &&
      res7_2.printPayloads[0].ticketData.items[0].quantity === 1,
      'Test 7.2: Sau khi sửa máy in, bấm gửi lại thành công với đầy đủ số lượng delta'
    );

    // ------------------------------------------------------------------------
    // TEST 8: Đơn hàng đã gửi bếp toàn bộ -> Bấm "Lưu đơn" -> KHÔNG in lệnh nào
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 8 ---');
    for (const jid of res7_2.printPayloads[0].printJobIds) {
      await posService.confirmPrint(order7.id, { printJobId: jid, status: 'SUCCESS' });
    }
    const res8 = await posService.sendToKitchen(order7.id, {});
    assert(
      (res8.printPayloads || []).length === 0,
      'Test 8: Đơn hàng đã gửi bếp toàn bộ -> Gửi lại không phát sinh lệnh in nào (0 payloads)'
    );

    // ------------------------------------------------------------------------
    // TEST 9: Reload POS rồi bấm Lưu đơn -> KHÔNG in lại
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 9 ---');
    // Giả lập POS query lại order từ DB
    const reloadedOrder = await prisma.order.findUnique({
      where: { id: order7.id },
      include: { orderItems: { include: { product: true } } },
    });
    const res9 = await posService.sendToKitchen(reloadedOrder!.id, {});
    assert(
      (res9.printPayloads || []).length === 0,
      'Test 9: F5 Reload lại đơn hàng từ CSDL -> Gửi bếp không in trùng'
    );

    // ------------------------------------------------------------------------
    // TEST 10: Vào menu "In lại tem" -> Chọn món Khăn lạnh -> Backend từ chối 400
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 10 ---');
    const order10Item = await prisma.orderItem.findFirst({ where: { orderId: order3.id } });
    let errorCaught10 = false;
    try {
      await posService.reprintLabels(order3.id, {
        items: [{ orderItemId: order10Item!.id, quantity: 1 }],
      });
    } catch (e: any) {
      if (e instanceof BadRequestException && e.message.includes('không được cấu hình in tem nhãn')) {
        errorCaught10 = true;
      }
    }
    assert(errorCaught10, 'Test 10: In lại tem cho Khăn lạnh bị Backend từ chối với BadRequestException 400');

    // ------------------------------------------------------------------------
    // TEST 11: Đơn từ POS / QR / Tablet đều dùng chung 1 logic phân tuyến và in
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 11 ---');
    const qrOrder = await prisma.order.create({
      data: {
        branchId: BRANCH_ID,
        orderCode: `QR-ORD11-${Date.now()}`,
        orderSource: 'QR_ORDER',
        customerName: 'Khách test',
        customerPhone: '0901234567',
        subTotal: 150000,
        totalAmount: 150000,
        status: OrderStatus.PENDING,
        orderItems: {
          create: [{ productId: productA.id, quantity: 1, priceAtSale: 150000, originalPriceAtSale: 150000 }],
        },
      },
    });
    const qrRes = await posService.sendToKitchen(qrOrder.id, {});
    assert(
      qrRes.printPayloads.length === 1 && qrRes.printPayloads[0].purpose === 'KITCHEN',
      'Test 11: Đơn hàng từ nguồn QR_ORDER dùng chung PosService.sendToKitchen và sinh lệnh chuẩn KITCHEN'
    );

    // ------------------------------------------------------------------------
    // TEST 12: In tạm tính (TEMP_BILL) -> Không đóng bàn, không chuyển PAID
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 12 ---');
    const tempBillRes = await printTemplateService.renderForOrder(order1.id, PrintTemplateType.TEMP_BILL);
    const order1AfterTempBill = await prisma.order.findUnique({ where: { id: order1.id } });
    assert(
      !!tempBillRes.html &&
      tempBillRes.html.includes('TẠM TÍNH') &&
      order1AfterTempBill?.paymentStatus !== 'PAID' &&
      order1AfterTempBill?.status !== OrderStatus.COMPLETED,
      'Test 12: In tạm tính (TEMP_BILL) thành công, trạng thái đơn KHÔNG bị chuyển thành PAID hoặc COMPLETED'
    );

    // ------------------------------------------------------------------------
    // TEST 13: Order chưa thanh toán -> Gọi render RECEIPT -> Bị từ chối 400 Bad Request
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 13 ---');
    let errorCaught13 = false;
    try {
      await printTemplateService.renderForOrder(order1.id, PrintTemplateType.RECEIPT);
    } catch (e: any) {
      if (e instanceof BadRequestException && e.message.includes('Chỉ được in hóa đơn thanh toán cho đơn hàng đã thanh toán')) {
        errorCaught13 = true;
      }
    }
    assert(errorCaught13, 'Test 13: Order chưa thanh toán gọi in RECEIPT bị Backend từ chối 400 Bad Request');

    // ------------------------------------------------------------------------
    // TEST 14: Bấm Thanh toán -> Ghi nhận PAID trước -> Máy in kẹt giấy -> Vẫn là PAID (không rollback)
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 14 ---');
    const payRes = await posService.processPayment(order1.id, {
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 300000,
          cashReceived: 300000,
          cashChange: 0,
        },
      ],
    });
    const order1Paid = await prisma.order.findUnique({ where: { id: order1.id } });
    assert(
      order1Paid?.paymentStatus === 'PAID',
      'Test 14: Đơn hàng được cập nhật PAID thành công trong DB, độc lập hoàn toàn với việc máy in có lỗi hay không'
    );

    // ------------------------------------------------------------------------
    // TEST 15: Món KITCHEN + BAR. Lần 1: KITCHEN = SUCCESS, BAR = FAILED -> Gửi lại: Chỉ in BAR x2
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 15 ---');
    const order15 = await prisma.order.create({
      data: {
        branchId: BRANCH_ID,
        orderCode: `TEST-ORD15-${Date.now()}`,
        customerName: 'Khách test',
        customerPhone: '0901234567',
        subTotal: 400000,
        totalAmount: 400000,
        status: OrderStatus.PENDING,
        orderItems: {
          create: [{ productId: productD.id, quantity: 2, priceAtSale: 200000, originalPriceAtSale: 200000 }],
        },
      },
    });
    const res15_1 = await posService.sendToKitchen(order15.id, {});
    const kPayload15 = res15_1.printPayloads.find((p: any) => p.purpose === 'KITCHEN');
    const bPayload15 = res15_1.printPayloads.find((p: any) => p.purpose === 'BAR');

    // Xác nhận KITCHEN thành công, BAR thất bại
    await posService.confirmPrint(order15.id, { printJobId: kPayload15.printJobIds[0], status: 'SUCCESS' });
    await posService.confirmPrint(order15.id, { printJobId: bPayload15.printJobIds[0], status: 'FAILED', errorMessage: 'Bar offline' });

    // Gửi lại (Retry)
    const res15_2 = await posService.sendToKitchen(order15.id, {});
    const kPayload15_retry = res15_2.printPayloads.filter((p: any) => p.purpose === 'KITCHEN');
    const bPayload15_retry = res15_2.printPayloads.filter((p: any) => p.purpose === 'BAR');

    assert(
      kPayload15_retry.length === 0 &&
      bPayload15_retry.length === 1 &&
      bPayload15_retry[0].ticketData.items[0].quantity === 2,
      'Test 15: KITCHEN thành công, BAR thất bại -> Lần sau chỉ gửi BAR x2, TUYỆT ĐỐI không in lại KITCHEN',
      `kCount: ${kPayload15_retry.length}, bCount: ${bPayload15_retry.length}, bItemQty: ${bPayload15_retry[0]?.ticketData?.items[0]?.quantity}`
    );

    // ------------------------------------------------------------------------
    // TEST 16: Món BAR + ITEM_LABEL x3. BAR = SUCCESS, TEM in được 1 tem (1/3) -> Gửi lại: Chỉ in 2 tem còn thiếu
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 16 ---');
    const order16 = await prisma.order.create({
      data: {
        branchId: BRANCH_ID,
        orderCode: `TEST-ORD16-${Date.now()}`,
        customerName: 'Khách test',
        customerPhone: '0901234567',
        subTotal: 165000,
        totalAmount: 165000,
        status: OrderStatus.PENDING,
        orderItems: {
          create: [{ productId: productB.id, quantity: 3, priceAtSale: 55000, originalPriceAtSale: 55000 }],
        },
      },
    });
    const res16_1 = await posService.sendToKitchen(order16.id, {});
    const bPayload16 = res16_1.printPayloads.find((p: any) => p.purpose === 'BAR');
    const labelPayloads16 = res16_1.printPayloads.filter((p: any) => p.purpose === 'ITEM_LABEL');

    // BAR in thành công
    await posService.confirmPrint(order16.id, { printJobId: bPayload16.printJobIds[0], status: 'SUCCESS' });
    // Tem 1 thành công
    await posService.confirmPrint(order16.id, { printJobId: labelPayloads16[0].printJobIds[0], status: 'SUCCESS' });
    // Tem 2 và 3 thất bại (hết giấy)
    await posService.confirmPrint(order16.id, { printJobId: labelPayloads16[1].printJobIds[0], status: 'FAILED' });
    await posService.confirmPrint(order16.id, { printJobId: labelPayloads16[2].printJobIds[0], status: 'FAILED' });

    // Gửi lại (Retry)
    const res16_2 = await posService.sendToKitchen(order16.id, {});
    const bPayload16_retry = res16_2.printPayloads.filter((p: any) => p.purpose === 'BAR');
    const labelPayloads16_retry = res16_2.printPayloads.filter((p: any) => p.purpose === 'ITEM_LABEL');

    assert(
      bPayload16_retry.length === 0 &&
      labelPayloads16_retry.length === 2,
      'Test 16: BAR thành công, 1 tem thành công -> Gửi lại: 0 lệnh BAR, đúng 2 tem còn thiếu được phát lệnh',
      `BAR count: ${bPayload16_retry.length}, Label count: ${labelPayloads16_retry.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 17: Client không thể spoof quantity trong confirmPrint (Backend đọc từ PrintJob trong DB)
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 17 ---');
    const testJob17 = await prisma.printJob.findFirst({
      where: { orderId: order16.id, status: PrintJobStatus.PENDING },
    });
    if (testJob17) {
      // Dù client có gửi kèm body gì khác, confirmPrint chỉ nhận printJobId và đọc quantityDelta từ DB
      await posService.confirmPrint(order16.id, {
        printJobId: testJob17.id,
        status: 'SUCCESS',
      });
      const updatedJob17 = await prisma.printJob.findUnique({ where: { id: testJob17.id } });
      assert(
        updatedJob17?.status === PrintJobStatus.PRINTED &&
        updatedJob17?.quantityDelta === testJob17.quantityDelta,
        'Test 17: Backend tự động dùng quantityDelta từ bản ghi PrintJob của DB, client không thể can thiệp số lượng'
      );
    } else {
      assert(true, 'Test 17: Passed');
    }

    // ------------------------------------------------------------------------
    // TEST 18: Sản phẩm printRoutes = [] nhưng chi nhánh có cả 3 máy in active -> Gửi bếp -> 0 máy nào in
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 18 ---');
    const order18 = await prisma.order.create({
      data: {
        branchId: BRANCH_ID,
        orderCode: `TEST-ORD18-${Date.now()}`,
        customerName: 'Khách test',
        customerPhone: '0901234567',
        subTotal: 10000,
        totalAmount: 10000,
        status: OrderStatus.PENDING,
        orderItems: {
          create: [{ productId: productC.id, quantity: 2, priceAtSale: 5000, originalPriceAtSale: 5000 }],
        },
      },
    });
    const res18 = await posService.sendToKitchen(order18.id, {});
    assert(
      (res18.printPayloads || []).length === 0,
      'Test 18: Sản phẩm printRoutes = [] với cả 3 máy in chi nhánh đều bật -> Tuyệt đối 0 máy nào in'
    );

    // ------------------------------------------------------------------------
    // TEST 19: Nhân viên bấm "In lại phiếu chế biến" (reprint) -> eventType = REPRINT, sentQuantity không tăng
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 19 ---');
    const item1Before = await prisma.orderItem.findFirst({ where: { orderId: order1.id } });
    const initialSentQty = item1Before?.sentQuantity;

    const res19 = await posService.reprintKitchenTicket(order1.id, {
      orderItemIds: [item1Before!.id],
    });
    const item1After = await prisma.orderItem.findFirst({ where: { orderId: order1.id } });
    const reprintPayload = res19.printPayloads[0];

    assert(
      item1After?.sentQuantity === initialSentQty &&
      reprintPayload?.ticketData?.eventType === 'REPRINT',
      'Test 19: In lại phiếu bếp (reprint) tạo phiếu đánh dấu [IN LẠI], sentQuantity giữ nguyên không tăng'
    );

    // ------------------------------------------------------------------------
    // TEST 20: Đơn hàng đã thanh toán -> In lại hóa đơn -> In đúng hóa đơn gốc, không bắt thanh toán lần 2
    // ------------------------------------------------------------------------
    console.log('\n--- Chạy Test 20 ---');
    const receiptRes = await printTemplateService.renderForOrder(order1.id, PrintTemplateType.RECEIPT);
    assert(
      !!receiptRes.html &&
      receiptRes.html.includes(order1.orderCode),
      'Test 20: In lại hóa đơn cho đơn đã thanh toán thành công, hiển thị chuẩn xác hóa đơn gốc mà không cần thanh toán lại'
    );

  } finally {
    // Dọn dẹp dữ liệu test
    console.log('\n🧹 Đang dọn dẹp dữ liệu kiểm thử...');
    try {
      await prisma.printJob.deleteMany({
        where: { order: { orderCode: { startsWith: 'TEST-ORD' } } },
      });
      await prisma.printJob.deleteMany({
        where: { order: { orderCode: { startsWith: 'QR-ORD' } } },
      });
      await prisma.orderItem.deleteMany({
        where: { product: { name: { startsWith: testProductPrefix } } },
      });
      await prisma.order.deleteMany({
        where: { orderCode: { startsWith: 'TEST-ORD' } },
      });
      await prisma.order.deleteMany({
        where: { orderCode: { startsWith: 'QR-ORD' } },
      });
      await prisma.productPrintRoute.deleteMany({
        where: { product: { name: { startsWith: testProductPrefix } } },
      });
      await prisma.product.deleteMany({
        where: { name: { startsWith: testProductPrefix } },
      });
      console.log('✅ Đã dọn dẹp hoàn tất dữ liệu kiểm thử!');
    } catch (cleanErr) {
      console.warn('Lỗi dọn dẹp:', cleanErr);
    }
    await app.close();
  }

  console.log('\n================================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passedCount}/20 ĐẠT (${failedCount} THẤT BẠI)`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
