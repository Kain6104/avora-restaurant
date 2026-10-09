const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('===============================================================');
  console.log('🚀 BẮT ĐẦU MIGRATION CHUẨN HÓA KHO NÔNG TRẠI (FarmInventoryItem)');
  console.log('===============================================================\n');

  const [crops, mutations, inventoryItems] = await Promise.all([
    prisma.farmCrop.findMany({ select: { id: true, code: true, name: true } }),
    prisma.farmCropMutation.findMany({ select: { id: true, code: true, name: true } }),
    prisma.farmInventoryItem.findMany({
      where: { itemType: { in: ['CROP', 'MUTATION_CROP'] } },
    }),
  ]);

  const cropIdMap = new Map();
  const cropCodeMap = new Map();
  crops.forEach((c) => {
    cropIdMap.set(c.id, c);
    cropCodeMap.set(c.code, c);
  });

  const mutationIdMap = new Map();
  const mutationCodeMap = new Map();
  mutations.forEach((m) => {
    mutationIdMap.set(m.id, m);
    mutationCodeMap.set(m.code, m);
  });

  const totalBefore = inventoryItems.length;
  console.log(`📊 Tổng số bản ghi CROP & MUTATION_CROP trước migration: ${totalBefore}`);

  // Nhóm theo farmId + itemType chuẩn + normalizedCode
  const groups = new Map();

  for (const item of inventoryItems) {
    let normalizedType = item.itemType;
    let normalizedCode = item.itemCode;
    let normalizedName = item.itemName;

    // Kiểm tra xem là biến thể đột biến
    const mut =
      mutationCodeMap.get(item.itemCode) ||
      mutationIdMap.get(item.referenceId) ||
      mutationCodeMap.get(item.referenceId) ||
      mutationIdMap.get(item.itemCode);

    if (mut) {
      normalizedType = 'MUTATION_CROP';
      normalizedCode = mut.code;
      normalizedName = mut.name;
    } else {
      // Kiểm tra xem là cây thường
      const cr =
        cropCodeMap.get(item.itemCode) ||
        cropIdMap.get(item.referenceId) ||
        cropCodeMap.get(item.referenceId) ||
        cropIdMap.get(item.itemCode);

      if (cr) {
        normalizedType = 'CROP';
        normalizedCode = cr.code;
        normalizedName = cr.name;
      }
    }

    const groupKey = `${item.farmId}__${normalizedType}__${normalizedCode}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        farmId: item.farmId,
        itemType: normalizedType,
        code: normalizedCode,
        name: normalizedName,
        items: [],
      });
    }
    groups.get(groupKey).items.push(item);
  }

  const totalAfter = groups.size;
  console.log(`🎯 Số bản ghi sau khi gom nhóm duy nhất: ${totalAfter}`);
  console.log(`🔻 Số bản ghi trùng lặp cần gộp: ${totalBefore - totalAfter}\n`);

  // Thực thi trong Prisma Transaction
  await prisma.$transaction(async (tx) => {
    let mergedGroupCount = 0;
    let normalizedSingleCount = 0;

    for (const [key, g] of groups) {
      const totalQty = g.items.reduce((sum, it) => sum + it.quantity, 0);

      if (g.items.length > 1) {
        mergedGroupCount++;
        // Giữ lại 1 bản ghi chính (ưu tiên bản ghi có referenceId = code hoặc bản ghi đầu tiên)
        const primary =
          g.items.find((it) => it.referenceId === g.code) || g.items[0];
        const secondaryItems = g.items.filter((it) => it.id !== primary.id);

        console.log(`[GỘP BẢN GHI TRÙNG] Key: ${key}`);
        console.log(
          `  -> Giữ ID: ${primary.id} | Type: ${g.itemType} | Code: ${g.code} | Tên: ${g.name} | Tổng SL: ${totalQty}`,
        );

        // Xóa các bản ghi phụ trước để tránh xung đột unique constraint
        for (const sec of secondaryItems) {
          console.log(`     - Xóa ID phụ: ${sec.id} (SL: ${sec.quantity})`);
          await tx.farmInventoryItem.delete({ where: { id: sec.id } });
        }

        // Cập nhật bản ghi chính với tổng quantity
        await tx.farmInventoryItem.update({
          where: { id: primary.id },
          data: {
            itemType: g.itemType,
            referenceId: g.code,
            itemCode: g.code,
            itemName: g.name,
            quantity: totalQty,
          },
        });
      } else {
        // Chỉ có 1 bản ghi: chuẩn hóa nếu chưa đúng
        const single = g.items[0];
        if (
          single.referenceId !== g.code ||
          single.itemCode !== g.code ||
          single.itemType !== g.itemType ||
          single.itemName !== g.name
        ) {
          normalizedSingleCount++;
          console.log(
            `[CHUẨN HÓA] ID: ${single.id} -> ${g.itemType} | Ref: ${g.code} | Code: ${g.code} (trước đó: ${single.itemType} | Ref: ${single.referenceId})`,
          );
          await tx.farmInventoryItem.update({
            where: { id: single.id },
            data: {
              itemType: g.itemType,
              referenceId: g.code,
              itemCode: g.code,
              itemName: g.name,
            },
          });
        }
      }
    }

    console.log('\n---------------------------------------------------------------');
    console.log(`✅ Hoàn tất transaction:`);
    console.log(`   - Số nhóm trùng lặp đã gộp: ${mergedGroupCount}`);
    console.log(`   - Số bản ghi đơn lẻ đã chuẩn hóa: ${normalizedSingleCount}`);
  });

  // Đối soát sau migration
  const verifyItems = await prisma.farmInventoryItem.findMany({
    where: { itemType: { in: ['CROP', 'MUTATION_CROP'] } },
  });

  console.log('\n===============================================================');
  console.log('📋 BÁO CÁO KẾT QUẢ MIGRATION:');
  console.log(`   - Tổng bản ghi trước: ${totalBefore}`);
  console.log(`   - Tổng bản ghi sau:   ${verifyItems.length}`);
  console.log(`   - Số bản ghi hợp nhất thành công: ${totalBefore - verifyItems.length}`);

  // Kiểm tra tính toàn vẹn: Tất cả referenceId và itemCode phải bằng code (không chứa UUID)
  const invalidItems = verifyItems.filter(
    (i) => i.referenceId !== i.itemCode || i.referenceId.includes('-'),
  );
  if (invalidItems.length > 0) {
    console.error(`⚠️ Cảnh báo: Vẫn còn ${invalidItems.length} bản ghi chưa đúng chuẩn!`);
  } else {
    console.log('🌟 100% bản ghi đã đạt chuẩn chính xác: referenceId === itemCode (không có UUID)');
  }
  console.log('===============================================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi thực hiện migration:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
