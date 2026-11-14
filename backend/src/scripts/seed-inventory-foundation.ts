import { PrismaClient, StorageCondition } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Bắt đầu khởi tạo dữ liệu nền tảng Kho & Nguyên liệu (Phase 3)...');

  // 1. Danh mục nguyên liệu
  const categories = [
    { code: 'SEAFOOD', name: 'Hải sản', color: '#0284c7', displayOrder: 1 },
    { code: 'SASHIMI', name: 'Cá và Sashimi', color: '#e11d48', displayOrder: 2 },
    { code: 'MEAT', name: 'Thịt bò & Thịt heo', color: '#b91c1c', displayOrder: 3 },
    { code: 'VEGETABLES', name: 'Rau củ & Nấm', color: '#16a34a', displayOrder: 4 },
    { code: 'FRUITS', name: 'Trái cây', color: '#ea580c', displayOrder: 5 },
    { code: 'SPICES', name: 'Gia vị & Bột', color: '#d97706', displayOrder: 6 },
    { code: 'SAUCES', name: 'Nước sốt & Dầu giấm', color: '#854d0e', displayOrder: 7 },
    { code: 'DRY_GOODS', name: 'Đồ khô & Rong biển', color: '#475569', displayOrder: 8 },
    { code: 'BEVERAGES', name: 'Đồ uống & Rượu Sake', color: '#7c3aed', displayOrder: 9 },
    { code: 'PACKAGING', name: 'Bao bì & Hộp mang về', color: '#64748b', displayOrder: 10 },
    { code: 'CONSUMABLES', name: 'Vật tư tiêu hao quầy bếp', color: '#94a3b8', displayOrder: 11 },
  ];

  console.log('📦 1. Upsert 11 danh mục nguyên liệu...');
  const catMap = new Map<string, string>();
  for (const c of categories) {
    const record = await prisma.ingredientCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, color: c.color, displayOrder: c.displayOrder },
      create: { code: c.code, name: c.name, color: c.color, displayOrder: c.displayOrder },
    });
    catMap.set(c.code, record.id);
  }

  // 2. Đơn vị đo lường (Units of Measurement)
  const units = [
    { symbol: 'g', name: 'Gram', isBaseUnit: true, description: 'Đơn vị khối lượng cơ sở cho công thức' },
    { symbol: 'kg', name: 'Kilogram', isBaseUnit: false, description: '1 kg = 1.000 g' },
    { symbol: 'ml', name: 'Milliliter', isBaseUnit: true, description: 'Đơn vị thể tích cơ sở cho chất lỏng' },
    { symbol: 'lít', name: 'Lít', isBaseUnit: false, description: '1 Lít = 1.000 ml' },
    { symbol: 'chai', name: 'Chai', isBaseUnit: false, description: 'Đơn vị đóng gói chai' },
    { symbol: 'lon', name: 'Lon', isBaseUnit: false, description: 'Đơn vị lon kim loại' },
    { symbol: 'hộp', name: 'Hộp', isBaseUnit: false, description: 'Đơn vị hộp' },
    { symbol: 'túi', name: 'Túi', isBaseUnit: false, description: 'Đơn vị túi hút chân không / đóng gói' },
    { symbol: 'thùng', name: 'Thùng', isBaseUnit: false, description: 'Đơn vị kiện / thùng mua sỉ' },
    { symbol: 'phần', name: 'Phần', isBaseUnit: false, description: 'Đơn vị chia khẩu phần' },
    { symbol: 'cái', name: 'Cái / Miếng / Lá', isBaseUnit: false, description: 'Đơn vị đếm chiếc, lá rong biển' },
  ];

  console.log('⚖️ 2. Upsert 11 đơn vị đo lường chuẩn...');
  const unitMap = new Map<string, string>();
  for (const u of units) {
    const record = await prisma.ingredientUnit.upsert({
      where: { symbol: u.symbol },
      update: { name: u.name, isBaseUnit: u.isBaseUnit, description: u.description },
      create: { symbol: u.symbol, name: u.name, isBaseUnit: u.isBaseUnit, description: u.description },
    });
    unitMap.set(u.symbol, record.id);
  }

  // 3. Khởi tạo Nhà cung cấp mẫu (Suppliers)
  const suppliers = [
    {
      code: 'SUP-SEAFOOD-01',
      name: 'Công ty TNHH Hải Sản Hoàng Gia (Royal Seafood)',
      contactPerson: 'Nguyễn Văn Hải',
      phone: '0901234567',
      email: 'sales@royalseafood.vn',
      address: '123 Cảng Cá, Phường 2, TP. Vũng Tàu',
      paymentTerms: 'NET30',
      bankName: 'Vietcombank',
      bankAccountNumber: '0071001234567',
      bankAccountHolder: 'CTY TNHH HAI SAN HOANG GIA',
    },
    {
      code: 'SUP-JAPAN-FOODS',
      name: 'Công ty CP Thực Phẩm Nhật Bản Tokyo Star',
      contactPerson: 'Trần Thị Mai',
      phone: '0988776655',
      email: 'order@tokyostar.com.vn',
      address: '45 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM',
      paymentTerms: 'COD',
      bankName: 'Techcombank',
      bankAccountNumber: '19034567891011',
      bankAccountHolder: 'CTY CP THUC PHAM TOKYO STAR',
    },
    {
      code: 'SUP-VEG-DALAT',
      name: 'Nông trại Rau sạch Đà Lạt Farm Direct',
      contactPerson: 'Lê Hoàng Nam',
      phone: '0912345678',
      email: 'dalatfarm@agri.vn',
      address: 'Km 15, QL20, Đức Trọng, Lâm Đồng',
      paymentTerms: 'NET15',
      bankName: 'MB Bank',
      bankAccountNumber: '8888001239999',
      bankAccountHolder: 'LE HOANG NAM',
    },
  ];

  console.log('🏢 3. Upsert 3 nhà cung cấp đối tác chiến lược...');
  const supplierMap = new Map<string, string>();
  for (const s of suppliers) {
    const record = await prisma.supplier.upsert({
      where: { code: s.code },
      update: s,
      create: s,
    });
    supplierMap.set(s.code, record.id);
  }

  // 4. Khởi tạo Kho hàng (Warehouses)
  console.log('🏭 4. Cấu hình hệ thống kho trung tâm và kho chi nhánh...');
  // 4.1 Kho tổng trung tâm
  const centralWarehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-CENTRAL' },
    update: { name: 'Tổng kho Trung tâm AVORA (Central Hub)', isCentral: true, storageZone: 'CENTRAL_HUB' },
    create: {
      code: 'WH-CENTRAL',
      name: 'Tổng kho Trung tâm AVORA (Central Hub)',
      description: 'Trung tâm phân phối và lưu kho nhập khẩu sỉ cho toàn chuỗi nhà hàng AVORA',
      isCentral: true,
      storageZone: 'CENTRAL_HUB',
      managerName: 'Trưởng kho Tổng',
    },
  });

  // 4.2 Kho các chi nhánh đang hoạt động
  const branches = await prisma.branch.findMany({ select: { id: true, name: true, branchCode: true } });
  const branchKitchenWarehouses: { branchId: string; warehouseId: string }[] = [];

  for (const b of branches) {
    const kitchenWhCode = `WH-${b.branchCode}-KITCHEN`;
    const kitchenWh = await prisma.warehouse.upsert({
      where: { code: kitchenWhCode },
      update: { name: `Kho Bếp - ${b.name}`, branchId: b.id, storageZone: 'KITCHEN_STORAGE' },
      create: {
        code: kitchenWhCode,
        name: `Kho Bếp - ${b.name}`,
        description: `Kho bảo quản nguyên liệu chế biến tại ${b.name}`,
        branchId: b.id,
        storageZone: 'KITCHEN_STORAGE',
        managerName: `Bếp trưởng ${b.name}`,
      },
    });
    branchKitchenWarehouses.push({ branchId: b.id, warehouseId: kitchenWh.id });

    const barWhCode = `WH-${b.branchCode}-BAR`;
    await prisma.warehouse.upsert({
      where: { code: barWhCode },
      update: { name: `Kho Bar & Nước - ${b.name}`, branchId: b.id, storageZone: 'BAR_STORAGE' },
      create: {
        code: barWhCode,
        name: `Kho Bar & Nước - ${b.name}`,
        description: `Kho bảo quản đồ uống, rượu sake và vật tư quầy bar tại ${b.name}`,
        branchId: b.id,
        storageZone: 'BAR_STORAGE',
        managerName: `Trưởng Bar ${b.name}`,
      },
    });
  }

  // 5. Khởi tạo Danh mục Nguyên liệu cốt lõi (Core Ingredients)
  console.log('🍣 5. Upsert danh mục nguyên vật liệu nhà hàng F&B...');
  const unitG = unitMap.get('g')!;
  const unitKg = unitMap.get('kg')!;
  const unitMl = unitMap.get('ml')!;
  const unitLit = unitMap.get('lít')!;
  const unitCai = unitMap.get('cái')!;
  const unitHop = unitMap.get('hộp')!;

  const coreIngredients = [
    {
      code: 'ING-SALMON-NORWAY',
      name: 'Cá hồi tươi Na Uy phi lê (Salmon Fillet)',
      categoryCode: 'SASHIMI',
      primaryUnitId: unitG,
      purchaseUnitId: unitKg,
      storageUnitId: unitKg,
      purchaseToPrimaryFactor: 1000.0, // 1 kg = 1000 g
      storageToPrimaryFactor: 1000.0,
      minimumStock: 2000, // 2kg
      maximumStock: 25000, // 25kg
      reorderThreshold: 5000, // 5kg
      averagePurchaseCost: 480000, // 480k / kg
      latestPurchaseCost: 490000,
      costPerPrimaryUnit: 490, // 490đ / g
      supplierCode: 'SUP-SEAFOOD-01',
      storageCondition: StorageCondition.CHILLED,
      shelfLifeDays: 3,
    },
    {
      code: 'ING-TUNA-AKAMI',
      name: 'Cá ngừ đại dương Akami (Tuna Akami)',
      categoryCode: 'SASHIMI',
      primaryUnitId: unitG,
      purchaseUnitId: unitKg,
      storageUnitId: unitKg,
      purchaseToPrimaryFactor: 1000.0,
      storageToPrimaryFactor: 1000.0,
      minimumStock: 1500,
      maximumStock: 15000,
      reorderThreshold: 3000,
      averagePurchaseCost: 550000,
      latestPurchaseCost: 560000,
      costPerPrimaryUnit: 560, // 560đ / g
      supplierCode: 'SUP-SEAFOOD-01',
      storageCondition: StorageCondition.FROZEN,
      shelfLifeDays: 30,
    },
    {
      code: 'ING-RICE-KOSHI',
      name: 'Gạo Nhật Koshihikari thượng hạng',
      categoryCode: 'DRY_GOODS',
      primaryUnitId: unitG,
      purchaseUnitId: unitKg,
      storageUnitId: unitKg,
      purchaseToPrimaryFactor: 1000.0,
      storageToPrimaryFactor: 1000.0,
      minimumStock: 10000,
      maximumStock: 100000,
      reorderThreshold: 20000,
      averagePurchaseCost: 65000, // 65k / kg
      latestPurchaseCost: 65000,
      costPerPrimaryUnit: 65, // 65đ / g
      supplierCode: 'SUP-JAPAN-FOODS',
      storageCondition: StorageCondition.DRY,
      shelfLifeDays: 180,
    },
    {
      code: 'ING-NORI-SHEET',
      name: 'Lá rong biển Yaki Nori cao cấp',
      categoryCode: 'DRY_GOODS',
      primaryUnitId: unitCai,
      purchaseUnitId: unitHop,
      storageUnitId: unitHop,
      purchaseToPrimaryFactor: 50.0, // 1 hộp = 50 lá
      storageToPrimaryFactor: 50.0,
      minimumStock: 100,
      maximumStock: 1000,
      reorderThreshold: 200,
      averagePurchaseCost: 180000, // 180k / hộp 50 lá
      latestPurchaseCost: 180000,
      costPerPrimaryUnit: 3600, // 3.600đ / lá
      supplierCode: 'SUP-JAPAN-FOODS',
      storageCondition: StorageCondition.DRY,
      shelfLifeDays: 365,
    },
    {
      code: 'ING-CREAM-CHEESE',
      name: 'Phô mai tươi Cream Cheese Anchor',
      categoryCode: 'SPICES',
      primaryUnitId: unitG,
      purchaseUnitId: unitKg,
      storageUnitId: unitKg,
      purchaseToPrimaryFactor: 1000.0,
      storageToPrimaryFactor: 1000.0,
      minimumStock: 1000,
      maximumStock: 10000,
      reorderThreshold: 2000,
      averagePurchaseCost: 220000, // 220k / kg
      latestPurchaseCost: 220000,
      costPerPrimaryUnit: 220, // 220đ / g
      supplierCode: 'SUP-JAPAN-FOODS',
      storageCondition: StorageCondition.CHILLED,
      shelfLifeDays: 60,
    },
    {
      code: 'ING-SHOYU-KIKKO',
      name: 'Nước tương Nhật Kikkoman truyền thống',
      categoryCode: 'SAUCES',
      primaryUnitId: unitMl,
      purchaseUnitId: unitLit,
      storageUnitId: unitLit,
      purchaseToPrimaryFactor: 1000.0, // 1 L = 1000 ml
      storageToPrimaryFactor: 1000.0,
      minimumStock: 5000,
      maximumStock: 40000,
      reorderThreshold: 10000,
      averagePurchaseCost: 160000, // 160k / lít
      latestPurchaseCost: 160000,
      costPerPrimaryUnit: 160, // 160đ / ml
      supplierCode: 'SUP-JAPAN-FOODS',
      storageCondition: StorageCondition.COOL_DARK,
      shelfLifeDays: 730,
    },
    {
      code: 'ING-IKURA-CAVIAR',
      name: 'Trứng cá hồi muối Ikura Nhật Bản',
      categoryCode: 'SASHIMI',
      primaryUnitId: unitG,
      purchaseUnitId: unitKg,
      storageUnitId: unitKg,
      purchaseToPrimaryFactor: 1000.0,
      storageToPrimaryFactor: 1000.0,
      minimumStock: 500,
      maximumStock: 5000,
      reorderThreshold: 1000,
      averagePurchaseCost: 2400000, // 2.4tr / kg
      latestPurchaseCost: 2400000,
      costPerPrimaryUnit: 2400, // 2.400đ / g
      supplierCode: 'SUP-SEAFOOD-01',
      storageCondition: StorageCondition.FROZEN,
      shelfLifeDays: 90,
    },
    {
      code: 'ING-WAGYU-A5',
      name: 'Thịt bò Wagyu Nhật A5 Ribeye',
      categoryCode: 'MEAT',
      primaryUnitId: unitG,
      purchaseUnitId: unitKg,
      storageUnitId: unitKg,
      purchaseToPrimaryFactor: 1000.0,
      storageToPrimaryFactor: 1000.0,
      minimumStock: 1000,
      maximumStock: 10000,
      reorderThreshold: 2000,
      averagePurchaseCost: 3200000, // 3.2tr / kg
      latestPurchaseCost: 3200000,
      costPerPrimaryUnit: 3200, // 3.200đ / g
      supplierCode: 'SUP-JAPAN-FOODS',
      storageCondition: StorageCondition.FROZEN,
      shelfLifeDays: 180,
    },
  ];

  const ingredientMap = new Map<string, string>();
  for (const ing of coreIngredients) {
    const catId = catMap.get(ing.categoryCode)!;
    const supId = ing.supplierCode ? supplierMap.get(ing.supplierCode) : null;

    const record = await prisma.ingredient.upsert({
      where: { code: ing.code },
      update: {
        name: ing.name,
        categoryId: catId,
        primaryUnitId: ing.primaryUnitId,
        purchaseUnitId: ing.purchaseUnitId,
        storageUnitId: ing.storageUnitId,
        purchaseToPrimaryFactor: ing.purchaseToPrimaryFactor,
        storageToPrimaryFactor: ing.storageToPrimaryFactor,
        minimumStock: ing.minimumStock,
        maximumStock: ing.maximumStock,
        reorderThreshold: ing.reorderThreshold,
        averagePurchaseCost: ing.averagePurchaseCost,
        latestPurchaseCost: ing.latestPurchaseCost,
        costPerPrimaryUnit: ing.costPerPrimaryUnit,
        defaultSupplierId: supId,
        storageCondition: ing.storageCondition,
        shelfLifeDays: ing.shelfLifeDays,
      },
      create: {
        code: ing.code,
        name: ing.name,
        categoryId: catId,
        primaryUnitId: ing.primaryUnitId,
        purchaseUnitId: ing.purchaseUnitId,
        storageUnitId: ing.storageUnitId,
        purchaseToPrimaryFactor: ing.purchaseToPrimaryFactor,
        storageToPrimaryFactor: ing.storageToPrimaryFactor,
        minimumStock: ing.minimumStock,
        maximumStock: ing.maximumStock,
        reorderThreshold: ing.reorderThreshold,
        averagePurchaseCost: ing.averagePurchaseCost,
        latestPurchaseCost: ing.latestPurchaseCost,
        costPerPrimaryUnit: ing.costPerPrimaryUnit,
        defaultSupplierId: supId,
        storageCondition: ing.storageCondition,
        shelfLifeDays: ing.shelfLifeDays,
      },
    });
    ingredientMap.set(ing.code, record.id);

    // Cập nhật số dư kho ban đầu (Opening Balance) cho các kho bếp chi nhánh
    for (const bWh of branchKitchenWarehouses) {
      const initialStock = ing.code.includes('RICE') ? 25000 : ing.code.includes('SALMON') ? 8000 : 3000;
      await prisma.inventoryBalance.upsert({
        where: {
          ingredientId_warehouseId: {
            ingredientId: record.id,
            warehouseId: bWh.warehouseId,
          },
        },
        update: {
          currentStock: initialStock,
          availableStock: initialStock,
          valuation: initialStock * ing.costPerPrimaryUnit,
        },
        create: {
          ingredientId: record.id,
          warehouseId: bWh.warehouseId,
          currentStock: initialStock,
          reservedStock: 0,
          availableStock: initialStock,
          valuation: initialStock * ing.costPerPrimaryUnit,
          lastReceivedAt: new Date(),
        },
      });
    }
  }

  console.log('✅ Khởi tạo nền tảng Kho & Nguyên liệu (Phase 3) thành công rực rỡ!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi khởi tạo inventory foundation:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

