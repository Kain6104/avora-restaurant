import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { HarvestService } from '../farm/harvest.service';
import { PlotService } from '../farm/plot.service';
import { PrismaService } from '../prisma/prisma.service';
import { FarmPlotStatus } from '@prisma/client';

async function runConcurrencyTest() {
  console.log('🚀 [TEST] Initializing Nest application context for concurrency audit...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const harvestService = app.get(HarvestService);
  const plotService = app.get(PlotService);
  const prisma = app.get(PrismaService);

  // 1. Tìm user farm để test
  const farm = await prisma.userFarm.findFirst({
    include: { user: true, plots: true },
  });

  if (!farm) {
    console.error('❌ Không tìm thấy userFarm để test!');
    await app.close();
    return;
  }

  const userId = farm.userId;
  const testPlotIndex = 0;
  console.log(`👤 Testing with user: ${farm.user.fullName || farm.user.email} (${userId}), plotIndex: ${testPlotIndex}`);

  // Dọn dẹp ô đất testPlotIndex trước
  await prisma.farmPlot.updateMany({
    where: { farmId: farm.id, plotIndex: testPlotIndex },
    data: {
      status: FarmPlotStatus.EMPTY,
      cropInstanceId: null,
      waterLevel: 80,
      fertilizerBonus: 0,
      fertilizerItemId: null,
    },
  });

  // Tìm 1 loại crop có sẵn (RICE)
  const crop = await prisma.farmCrop.findFirst({
    where: { code: { contains: 'RICE' } },
  });
  if (!crop) {
    console.error('❌ Không tìm thấy crop RICE!');
    await app.close();
    return;
  }

  // Đảm bảo user có ít nhất 10 hạt giống trong kho
  const existingSeed = await prisma.farmInventoryItem.findFirst({
    where: { farmId: farm.id, itemType: 'SEED', referenceId: crop.id },
  });
  if (!existingSeed) {
    await prisma.farmInventoryItem.create({
      data: {
        farmId: farm.id,
        itemType: 'SEED',
        referenceId: crop.id,
        itemName: crop.name,
        itemCode: crop.code,
        quantity: 20,
      },
    });
  } else {
    await prisma.farmInventoryItem.update({
      where: { id: existingSeed.id },
      data: { quantity: { increment: 10 } },
    });
  }

  // Ensure user has energy
  await prisma.userFarm.update({
    where: { id: farm.id },
    data: { energy: 100 },
  });

  console.log('🌱 Planting crop for Test A (Double Harvest Concurrency)...');
  await plotService.plant(userId, testPlotIndex, crop.code);

  // Ép trạng thái cây sang READY ngay lập tức (readyAt = now - 5000ms)
  const plotAfterPlant = await prisma.farmPlot.findFirst({
    where: { farmId: farm.id, plotIndex: testPlotIndex },
    include: { cropInstance: true },
  });

  if (!plotAfterPlant?.cropInstanceId) {
    console.error('❌ Cây trồng chưa được gieo thành công!');
    await app.close();
    return;
  }

  await prisma.farmCropInstance.update({
    where: { id: plotAfterPlant.cropInstanceId },
    data: {
      readyAt: new Date(Date.now() - 5000),
    },
  });

  await prisma.farmPlot.update({
    where: { id: plotAfterPlant.id },
    data: { status: FarmPlotStatus.READY },
  });

  console.log('⚡ GỬI ĐỒNG THỜI 2 REQUEST HARVEST VÀO CÙNG 1 Ô ĐẤT...');
  const farmBefore = await prisma.userFarm.findUnique({ where: { id: farm.id } });
  const logsCountBefore = await prisma.farmActivityLog.count({
    where: { farmId: farm.id, action: 'HARVEST' },
  });

  const [reqA, reqB] = await Promise.allSettled([
    harvestService.harvestPlot(userId, testPlotIndex),
    harvestService.harvestPlot(userId, testPlotIndex),
  ]);

  console.log('\n--- KẾT QUẢ TEST A: CONCURRENT HARVEST ---');
  console.log('Request A status:', reqA.status, reqA.status === 'fulfilled' ? '✅ SUCCESS' : `❌ REJECTED: ${(reqA as any).reason?.message}`);
  console.log('Request B status:', reqB.status, reqB.status === 'fulfilled' ? '✅ SUCCESS' : `❌ REJECTED: ${(reqB as any).reason?.message}`);

  const fulfilledCount = [reqA, reqB].filter((r) => r.status === 'fulfilled').length;
  const rejectedCount = [reqA, reqB].filter((r) => r.status === 'rejected').length;

  console.log(`Fulfilled: ${fulfilledCount} (Expected: 1)`);
  console.log(`Rejected: ${rejectedCount} (Expected: 1 with ALREADY_HARVESTED)`);

  const farmAfter = await prisma.userFarm.findUnique({ where: { id: farm.id } });
  const logsCountAfter = await prisma.farmActivityLog.count({
    where: { farmId: farm.id, action: 'HARVEST' },
  });

  console.log(`Activity Logs created: ${logsCountAfter - logsCountBefore} (Expected: 1)`);
  console.log(`Coin gained: ${farmAfter!.farmCoin - farmBefore!.farmCoin} (Expected: exactly 1 harvest reward)`);

  if (fulfilledCount === 1 && rejectedCount === 1 && logsCountAfter - logsCountBefore === 1) {
    console.log('🎉 [PASS] DOUBLE HARVEST ATOMIC LOCK HOẠT ĐỘNG HOÀN HẢO! KHÔNG CÓ DUPLICATE REWARD!');
  } else {
    console.error('❌ [FAIL] DOUBLE HARVEST ATOMIC LOCK THẤT BẠI!');
  }

  // ==========================================
  // TEST B: UPROOT (ĐÀO CÂY) TEST
  // ==========================================
  console.log('\n--- BẮT ĐẦU TEST B: UPROOT (ĐÀO CÂY / NHỔ CÂY) ---');
  console.log('🌱 Gieo hạt cây mới để test đào...');
  await plotService.plant(userId, testPlotIndex, crop.code);

  const farmBeforeUproot = await prisma.userFarm.findUnique({ where: { id: farm.id } });
  console.log('🚜 Gọi hàm uproot trên plot 0...');
  const uprootResult = await plotService.uproot(userId, testPlotIndex);
  console.log('Uproot result:', uprootResult.message, 'success:', uprootResult.success);

  const plotAfterUproot = await prisma.farmPlot.findFirst({
    where: { farmId: farm.id, plotIndex: testPlotIndex },
  });
  console.log('Plot status after uproot:', plotAfterUproot?.status, '(Expected: EMPTY)');
  console.log('CropInstanceId after uproot:', plotAfterUproot?.cropInstanceId, '(Expected: null)');

  const farmAfterUproot = await prisma.userFarm.findUnique({ where: { id: farm.id } });
  const expDiff = farmAfterUproot!.totalExp - farmBeforeUproot!.totalExp;
  const coinDiff = farmAfterUproot!.farmCoin - farmBeforeUproot!.farmCoin;

  console.log(`EXP thay đổi: ${expDiff} (Expected: 0 - Đào cây không thưởng EXP)`);
  console.log(`Coin thay đổi: ${coinDiff} (Expected: 0 - Đào cây không thưởng Coin)`);

  // Test double uproot
  console.log('🚜 Test gọi uproot lần 2 trên cùng ô đất trống...');
  try {
    await plotService.uproot(userId, testPlotIndex);
    console.error('❌ [FAIL] Lẽ ra phải throw BadRequestException/ConflictException khi đào ô đất trống!');
  } catch (err: any) {
    console.log(`✅ Chặn đào cây trùng lặp thành công: ${err.message}`);
  }

  if (plotAfterUproot?.status === FarmPlotStatus.EMPTY && plotAfterUproot?.cropInstanceId === null && expDiff === 0 && coinDiff === 0) {
    console.log('🎉 [PASS] UPROOT HOẠT ĐỘNG HOÀN HẢO! AN TOÀN VÀ ĐÚNG QUY TẮC KINH TẾ!');
  } else {
    console.error('❌ [FAIL] UPROOT TEST THẤT BẠI!');
  }

  await app.close();
  console.log('\n🏁 Concurrency & Uproot audit completed successfully.');
}

runConcurrencyTest().catch((e) => {
  console.error('Unhandled error in concurrency test:', e);
  process.exit(1);
});
