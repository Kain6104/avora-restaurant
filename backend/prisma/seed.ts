import {
  PrismaClient,
  RoleType,
  ReservationStatus,
  OrderStatus,
  ServingType,
  PointTransactionSource,
  DiscountType
} from '@prisma/client';

const prisma = new PrismaClient();

// Hàm hỗ trợ lấy ngẫu nhiên chi nhánh cho sản phẩm
function getRandomBranches(branches: any[], min = 2, max = 5) {
  const shuffled = [...branches].sort(() => 0.5 - Math.random());
  const count = Math.floor(Math.random() * (max - min + 1) + min);
  return shuffled.slice(0, count).map(b => ({ id: b.id }));
}

async function main() {
  console.log('Bắt đầu dọn dẹp Database cũ...');
  await prisma.pointTransaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.orderItemOption.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.flashSaleItem.deleteMany();
  await prisma.flashSale.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.address.deleteMany();

  // Dọn dẹp hệ thống món và options
  await prisma.optionItem.deleteMany();
  await prisma.optionGroup.deleteMany();
  await prisma.product.deleteMany();

  await prisma.banner.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.membershipTier.deleteMany();
  await prisma.branch.deleteMany();

  console.log('1. Đang tạo Membership Tiers (Hạng thành viên)...');
  const tiers = await Promise.all([
    prisma.membershipTier.create({ data: { name: 'Đồng', minSpending: 0, pointMultiplier: 1.0, discountPercent: 0 } }),
    prisma.membershipTier.create({ data: { name: 'Bạc', minSpending: 2000000, pointMultiplier: 1.2, discountPercent: 2 } }),
    prisma.membershipTier.create({ data: { name: 'Vàng', minSpending: 5000000, pointMultiplier: 1.5, discountPercent: 5 } }),
    prisma.membershipTier.create({ data: { name: 'Kim Cương', minSpending: 15000000, pointMultiplier: 2.0, discountPercent: 10 } }),
  ]);

  console.log('2. Đang tạo 5 Chi nhánh (Branches) với Tọa độ...');
  const branches = await Promise.all([
    prisma.branch.create({ data: { name: 'Avora Signature Quận 1', branchCode: 'AVO-Q1', street: '123 Lê Lợi', district: 'Quận 1', province: 'TP.HCM', latitude: 10.773234, longitude: 106.700684, openTime: '10:00', closeTime: '23:00' } }),
    prisma.branch.create({ data: { name: 'Avora Premium Thảo Điền', branchCode: 'AVO-Q2', street: '45 Xuân Thủy', district: 'Quận 2', province: 'TP.HCM', latitude: 10.803328, longitude: 106.735041, openTime: '10:00', closeTime: '22:30' } }),
    prisma.branch.create({ data: { name: 'Avora Landmark 81', branchCode: 'AVO-L81', street: '720A Điện Biên Phủ', district: 'Bình Thạnh', province: 'TP.HCM', latitude: 10.794628, longitude: 106.721832, openTime: '09:00', closeTime: '22:00' } }),
    prisma.branch.create({ data: { name: 'Avora Hoàn Kiếm', branchCode: 'AVO-HN1', street: '15 Lý Thái Tổ', district: 'Hoàn Kiếm', province: 'Hà Nội', latitude: 21.026752, longitude: 105.854431, openTime: '10:00', closeTime: '23:00' } }),
    prisma.branch.create({ data: { name: 'Avora West Lake', branchCode: 'AVO-HN2', street: '88 Xuân Diệu', district: 'Tây Hồ', province: 'Hà Nội', latitude: 21.063124, longitude: 105.823956, openTime: '11:00', closeTime: '23:30' } }),
  ]);

  console.log('3. Đang tạo 5 Danh mục (Categories)...');
  const catData = [
    { name: 'Sushi & Maki', slug: 'sushi-maki', image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400' },     // Index 0
    { name: 'Sashimi Tươi Sống', slug: 'sashimi', image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400' },  // Index 1
    { name: 'Món Nóng & Bếp', slug: 'mon-nong', image: 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=400' },     // Index 2
    { name: 'Set Omakase & Combo', slug: 'omakase-combo', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400' }, // Index 3
    { name: 'Đồ Uống & Tráng Miệng', slug: 'do-uong', image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400' }   // Index 4
  ];
  const categories = await Promise.all(
    catData.map((cat, index) => prisma.category.create({ data: { ...cat, displayOrder: index + 1, branches: { connect: branches.map(b => ({ id: b.id })) } } }))
  );

  // --- ĐỊNH NGHĨA CÁC OPTION TEMPLATES ---
  const optSushiCondiments = [
    { name: 'Gia vị kèm theo', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 2, items: [{ name: 'Thêm Wasabi', priceAdjustment: 0 }, { name: 'Thêm Gừng chua', priceAdjustment: 0 }] }
  ];
  const optMakiToppings = [
    ...optSushiCondiments,
    { name: 'Topping cuộn thêm', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 2, items: [{ name: 'Phủ Phô mai khò', priceAdjustment: 20000 }, { name: 'Phủ Trứng cá hồi', priceAdjustment: 35000 }] }
  ];
  const optSashimiSize = [
    { name: 'Độ dày lát cắt', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Cắt chuẩn (Standard)', priceAdjustment: 0, isDefault: true }, { name: 'Cắt dày (Thick cut)', priceAdjustment: 0 }] },
    ...optSushiCondiments
  ];
  const optNoodle = [
    { name: 'Kích cỡ', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Size Vừa', priceAdjustment: 0, isDefault: true }, { name: 'Size Lớn (Thêm mì)', priceAdjustment: 25000 }] },
    { name: 'Độ cay', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Không cay', priceAdjustment: 0, isDefault: true }, { name: 'Cay vừa', priceAdjustment: 0 }, { name: 'Rất cay', priceAdjustment: 0 }] },
    { name: 'Topping thêm', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 4, items: [{ name: 'Thêm Trứng lòng đào (Ajitama)', priceAdjustment: 15000 }, { name: 'Thêm Thịt Xá Xíu', priceAdjustment: 35000 }, { name: 'Thêm Rong biển', priceAdjustment: 10000 }, { name: 'Thêm Đậu hũ', priceAdjustment: 10000 }] }
  ];
  const optRice = [
    { name: 'Lượng cơm', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Cơm vừa', priceAdjustment: 0, isDefault: true }, { name: 'Ít cơm', priceAdjustment: 0 }, { name: 'Nhiều cơm', priceAdjustment: 10000 }] },
    { name: 'Món ăn kèm', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 2, items: [{ name: 'Súp Miso', priceAdjustment: 20000 }, { name: 'Salad rong biển', priceAdjustment: 35000 }] }
  ];
  const optDrinks = [
    { name: 'Lượng đá', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Đá bình thường', priceAdjustment: 0, isDefault: true }, { name: 'Ít đá', priceAdjustment: 0 }, { name: 'Không đá', priceAdjustment: 0 }] },
    { name: 'Độ ngọt', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: '100% Đường', priceAdjustment: 0, isDefault: true }, { name: '50% Đường', priceAdjustment: 0 }, { name: 'Không đường', priceAdjustment: 0 }] }
  ];

  console.log('4. Đang tạo 120 Sản phẩm với Hệ thống Option Món...');
  // Data gồm: [Tên, Giá, ID Danh mục, Là Best Seller?, Template Option]
  const rawProducts = [
    // --- 1. SUSHI & MAKI (25 Món) ---
    ['Nigiri Cá Hồi (Sake)', 45000, 0, true, optSushiCondiments],
    ['Nigiri Cá Ngừ (Maguro)', 55000, 0, false, optSushiCondiments],
    ['Nigiri Bụng Cá Hồi Béo', 65000, 0, true, optSushiCondiments],
    ['Nigiri Tôm Ngọt (Amaebi)', 65000, 0, false, optSushiCondiments],
    ['Nigiri Lươn Nướng (Unagi)', 75000, 0, true, optSushiCondiments],
    ['Nigiri Bạch Tuộc (Tako)', 40000, 0, false, optSushiCondiments],
    ['Nigiri Mực Tươi (Ika)', 45000, 0, false, optSushiCondiments],
    ['Nigiri Sò Đỏ (Hokkigai)', 55000, 0, true, optSushiCondiments],
    ['Nigiri Trứng Cuộn (Tamago)', 35000, 0, false, optSushiCondiments],
    ['Nigiri Cá Trích Ép Trứng', 50000, 0, false, optSushiCondiments],
    ['Nigiri Bò Wagyu A5 Khò', 120000, 0, true, optSushiCondiments],
    ['Gunkan Trứng Cá Hồi (Ikura)', 95000, 0, true, optSushiCondiments],
    ['Gunkan Nhím Biển (Uni)', 180000, 0, false, optSushiCondiments],
    ['Gunkan Thịt Cua', 65000, 0, false, optSushiCondiments],
    ['Gunkan Rong Biển Tươi', 35000, 0, false, optSushiCondiments],
    ['Maki California', 85000, 0, true, optMakiToppings],
    ['Maki Cá Hồi Bơ', 95000, 0, true, optMakiToppings],
    ['Maki Tôm Tempura', 110000, 0, true, optMakiToppings],
    ['Maki Lươn Dưa Leo', 120000, 0, false, optMakiToppings],
    ['Maki Bơ Dưa Leo Chay', 55000, 0, false, optMakiToppings],
    ['Cuộn Rồng Đỏ (Red Dragon Roll)', 165000, 0, true, optMakiToppings],
    ['Cuộn Núi Lửa (Volcano Roll)', 180000, 0, true, optMakiToppings],
    ['Cuộn Da Cá Hồi Chiên Giòn', 105000, 0, false, optMakiToppings],
    ['Cuộn Cầu Vồng (Rainbow Roll)', 155000, 0, false, optMakiToppings],
    ['Sushi Viên Temari Đủ Loại', 145000, 0, false, optSushiCondiments],

    // --- 2. SASHIMI TƯƠI SỐNG (25 Món) ---
    ['Sashimi Cá Hồi (3 lát)', 95000, 1, true, optSashimiSize],
    ['Sashimi Cá Hồi (5 lát)', 150000, 1, true, optSashimiSize],
    ['Sashimi Bụng Cá Hồi (Toro)', 185000, 1, true, optSashimiSize],
    ['Sashimi Cá Ngừ Đại Dương', 160000, 1, false, optSashimiSize],
    ['Sashimi Bụng Cá Ngừ (Otoro)', 450000, 1, true, optSashimiSize],
    ['Sashimi Bạch Tuộc', 120000, 1, false, optSashimiSize],
    ['Sashimi Mực Tươi Lá', 130000, 1, false, optSashimiSize],
    ['Sashimi Sò Đỏ Canada', 150000, 1, true, optSashimiSize],
    ['Sashimi Tôm Ngọt Amaebi', 180000, 1, true, optSashimiSize],
    ['Sashimi Cầu Gai Nhật', 480000, 1, false, optSashimiSize],
    ['Sashimi Cá Trích Vàng', 140000, 1, false, optSashimiSize],
    ['Sashimi Cá Trích Đỏ', 140000, 1, false, optSashimiSize],
    ['Sashimi Bào Ngư Sống', 350000, 1, false, optSashimiSize],
    ['Sashimi Cồi Sò Điệp Hokkaido', 280000, 1, true, optSashimiSize],
    ['Sashimi Tôm Hùm (Theo thời giá)', 1250000, 1, false, null],
    ['Set Sashimi Tiêu Chuẩn (3 loại)', 280000, 1, true, optSushiCondiments],
    ['Set Sashimi Mùa Xuân (5 loại)', 450000, 1, true, optSushiCondiments],
    ['Set Sashimi Đặc Biệt (7 loại)', 680000, 1, true, optSushiCondiments],
    ['Thuyền Sashimi Hoàng Gia', 1500000, 1, false, optSushiCondiments],
    ['Khay Sashimi Cá Hồi Khổng Lồ', 850000, 1, true, optSushiCondiments],
    ['Carpaccio Cá Hồi Sốt Truffle', 220000, 1, false, null],
    ['Carpaccio Bò Wagyu', 350000, 1, false, null],
    ['Hàu Sữa Nhật Bản (1 con)', 75000, 1, true, [{ name: 'Sốt ăn kèm', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Sốt Ponzu', priceAdjustment: 0, isDefault: true }, { name: 'Chanh muối', priceAdjustment: 0 }] }]],
    ['Hàu Sữa Sốt Trứng Muối', 90000, 1, false, null],
    ['Hàu Nướng Phô Mai', 85000, 1, false, null],

    // --- 3. MÓN NÓNG & BẾP (30 Món) ---
    ['Mì Ramen Tonkotsu Chashu', 165000, 2, true, optNoodle],
    ['Mì Ramen Miso', 155000, 2, false, optNoodle],
    ['Mì Ramen Shoyu Vị Tương', 145000, 2, false, optNoodle],
    ['Mì Udon Hải Sản Nóng', 140000, 2, true, optNoodle],
    ['Mì Udon Bò Nhật', 150000, 2, true, optNoodle],
    ['Mì Udon Cà Ri Gà', 135000, 2, false, optNoodle],
    ['Mì Soba Lạnh', 95000, 2, false, null],
    ['Mì Xào Yakisoba Hải Sản', 145000, 2, true, optNoodle],
    ['Mì Xào Yakisoba Bò', 155000, 2, false, optNoodle],
    ['Cơm Lươn Nướng (Unadon)', 290000, 2, true, optRice],
    ['Cơm Gà Xốt Teriyaki', 120000, 2, true, optRice],
    ['Cơm Heo Chiên Xù (Katsudon)', 135000, 2, true, optRice],
    ['Cơm Thịt Bò (Gyudon)', 145000, 2, false, optRice],
    ['Cơm Cà Ri Heo Chiên', 150000, 2, false, optRice],
    ['Cơm Chiên Tỏi Đập Thịt Bò', 165000, 2, true, optRice],
    ['Cơm Chiên Cá Hồi', 145000, 2, false, optRice],
    ['Bánh Xèo Nhật Okonomiyaki', 125000, 2, false, [{ name: 'Topping', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 2, items: [{ name: 'Thêm Cá bào', priceAdjustment: 15000 }, { name: 'Thêm Mayo', priceAdjustment: 5000 }] }]],
    ['Bánh Bạch Tuộc Takoyaki (6 viên)', 85000, 2, true, null],
    ['Trứng Hấp Hải Sản Chawanmushi', 65000, 2, true, null],
    ['Súp Miso Truyền Thống', 35000, 2, false, null],
    ['Súp Nghêu Trong Suốt', 55000, 2, false, null],
    ['Cá Tuyết Nướng Xốt Miso', 380000, 2, true, null],
    ['Cá Hồi Nướng Muối', 180000, 2, false, null],
    ['Đầu Cá Hồi Nướng Teriyaki', 140000, 2, true, null],
    ['Bò Wagyu A5 Nướng Đá Muối', 1500000, 2, true, [{ name: 'Độ chín', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Rare', priceAdjustment: 0 }, { name: 'Medium Rare', priceAdjustment: 0, isDefault: true }, { name: 'Medium', priceAdjustment: 0 }] }]],
    ['Gà Xiên Nướng Yakitori (2 Xiên)', 55000, 2, true, null],
    ['Lõi Thăn Bò Xiên Nướng', 95000, 2, false, null],
    ['Tempura Tôm Phủ Cốm (3 con)', 125000, 2, true, null],
    ['Tempura Rau Củ Thập Cẩm', 85000, 2, false, null],
    ['Đậu Nành Nhật Edamame', 45000, 2, false, null],

    // --- 4. SET OMAKASE & COMBO (20 Món) ---
    ['Bento Trưa Văn Phòng - Gà Teriyaki', 150000, 3, true, optRice],
    ['Bento Trưa - Cá Hồi Nướng', 180000, 3, false, optRice],
    ['Bento Trưa - Lươn Nhật', 250000, 3, true, optRice],
    ['Bento Trưa - Heo Chiên Katsu', 165000, 3, false, optRice],
    ['Combo Lẩu Shabu Bò Mỹ (2-3 người)', 550000, 3, true, [{ name: 'Nước lẩu', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Nước lẩu Thái Tôm Yum', priceAdjustment: 0 }, { name: 'Nước lẩu Nấm thanh ngọt', priceAdjustment: 0, isDefault: true }, { name: 'Nước lẩu Miso', priceAdjustment: 0 }] }]],
    ['Combo Lẩu Shabu Bò Wagyu', 1250000, 3, false, [{ name: 'Nước lẩu', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Nước lẩu Cà Chua Miso', priceAdjustment: 0 }, { name: 'Nước lẩu Nấm', priceAdjustment: 0, isDefault: true }] }]],
    ['Combo Lẩu Sukiyaki', 650000, 3, true, null],
    ['Combo Lẩu Đầu Cá Hồi', 450000, 3, false, null],
    ['Set Sushi Mini Cho Trẻ Em', 120000, 3, false, null],
    ['Set Omakase Khai Vị (7 Món)', 850000, 3, false, null],
    ['Set Omakase Bếp Trưởng (12 Món)', 1500000, 3, true, null],
    ['Set Omakase VIP Kèm Rượu', 2500000, 3, false, null],
    ['Party Sushi Khay Gỗ (Size M)', 650000, 3, true, null],
    ['Party Sushi Khay Gỗ (Size L)', 1100000, 3, true, null],
    ['Combo Salmon Lover (Toàn Cá Hồi)', 580000, 3, true, null],
    ['Combo Maguro Lover (Toàn Cá Ngừ)', 620000, 3, false, null],
    ['Set Đồ Nướng Yakiniku Tổng Hợp', 950000, 3, false, null],
    ['Set Chay Thiền Phái Zen', 350000, 3, false, null],
    ['Mẹt Ăn Vặt Izakaya (Cho bia)', 450000, 3, true, null],
    ['Combo Date Night (Cho 2 người)', 1800000, 3, true, null],

    // --- 5. ĐỒ UỐNG & TRÁNG MIỆNG (20 Món) ---
    ['Trà Xanh Mộc Nhật Bản (Đá/Nóng)', 25000, 4, true, optDrinks],
    ['Trà Olong Rang Houjicha', 35000, 4, false, optDrinks],
    ['Trà Trái Cây Yuzu Thanh Yên', 55000, 4, true, optDrinks],
    ['Matcha Latte Mát Lạnh', 65000, 4, true, optDrinks],
    ['Matcha Đá Xay Kem Tươi', 85000, 4, false, optDrinks],
    ['Nước Ép Tươi Dưa Hấu', 50000, 4, false, optDrinks],
    ['Nước Ép Tươi Thơm', 50000, 4, false, optDrinks],
    ['Nước Ngọt Coca Cola', 25000, 4, false, optDrinks],
    ['Sake Junmai Khô (Bình 150ml)', 180000, 4, true, [{ name: 'Cách dùng', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Hâm Nóng', priceAdjustment: 0, isDefault: true }, { name: 'Ướp Lạnh', priceAdjustment: 0 }] }]],
    ['Sake Daiginjo Cao Cấp (Bình 300ml)', 450000, 4, false, null],
    ['Chai Sake Hakutsuru 720ml', 1200000, 4, false, null],
    ['Rượu Mơ Choya (Ly 50ml)', 85000, 4, true, [{ name: 'Uống kèm', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Thêm đá viên to', priceAdjustment: 0, isDefault: true }, { name: 'Pha Soda', priceAdjustment: 15000 }] }]],
    ['Rượu Mơ Vảy Vàng Kikkoman', 950000, 4, false, null],
    ['Bia Tươi Sapporo Khổng Lồ', 75000, 4, true, null],
    ['Bia Tiger Bạc', 45000, 4, false, null],
    ['Bánh Mochi Trà Xanh Ngân Lạnh', 45000, 4, true, null],
    ['Bánh Mochi Dâu Tây Tươi', 55000, 4, true, null],
    ['Bánh Mochi Đậu Đỏ Dẻo', 45000, 4, false, null],
    ['Kem Cây Matcha Thượng Hạng', 65000, 4, true, null],
    ['Kem Yuzu Sorbet Giải Nhiệt', 75000, 4, false, null]
  ];

  let prodCount = 1;
  // SỬA LỖI 1: Khai báo rõ kiểu dữ liệu là any[] cho mảng createdProducts
  const createdProducts: any[] = [];

  for (const p of rawProducts) {
    const [name, price, catIdx, isBest, options] = p;

    const product = await prisma.product.create({
      data: {
        itemCode: `PRD-${prodCount.toString().padStart(3, '0')}`,
        name: name as string,
        slug: `san-pham-${prodCount}-${Math.random().toString(36).substring(7)}`,
        price: price as number,
        isBestSeller: isBest as boolean,
        isAiRecommended: Math.random() > 0.8,
        imageUrl: categories[catIdx as number].image,
        categoryId: categories[catIdx as number].id,
        branches: { connect: getRandomBranches(branches, 2, 5) },
      }
    });

    createdProducts.push(product);

    // SỬA LỖI 2: Ép kiểu options về any[] để tránh lỗi isDefault
    const opts = options as any[];
    if (opts && Array.isArray(opts)) {
      for (let gIndex = 0; gIndex < opts.length; gIndex++) {
        const groupDef = opts[gIndex];
        const group = await prisma.optionGroup.create({
          data: {
            productId: product.id,
            name: groupDef.name,
            isRequired: groupDef.isRequired,
            multipleChoice: groupDef.multipleChoice,
            minSelect: groupDef.minSelect,
            maxSelect: groupDef.maxSelect,
            displayOrder: gIndex
          }
        });

        // Khai báo item: any trong hàm map
        const itemsToCreate = groupDef.items.map((item: any, iIndex: number) => ({
          optionGroupId: group.id,
          name: item.name,
          priceAdjustment: item.priceAdjustment,
          isDefault: item.isDefault || false,
          displayOrder: iIndex
        }));

        await prisma.optionItem.createMany({ data: itemsToCreate });
      }
    }
    prodCount++;
  }

  console.log(`Đã tạo thành công ${createdProducts.length} món ăn kèm các Tùy chọn (Options)!`);

  console.log('5. Đang tạo Vouchers (Khuyến mãi)...');
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const vouchers = await Promise.all([
    prisma.voucher.create({ data: { code: 'WELCOME50', title: 'Giảm 50K cho bạn mới', discountType: DiscountType.FIXED_AMOUNT, discountValue: 50000, minOrderValue: 200000, startDate: now, endDate: nextMonth, usageLimit: 1000 } }),
    prisma.voucher.create({ data: { code: 'FREESHIP', title: 'Miễn phí giao hàng (Tối đa 30K)', discountType: DiscountType.FREE_SHIP, discountValue: 30000, minOrderValue: 300000, startDate: now, endDate: nextMonth } }),
    prisma.voucher.create({ data: { code: 'VIPGOLD', title: 'Giảm 10% Hạng Vàng', discountType: DiscountType.PERCENTAGE, discountValue: 10, maxDiscount: 200000, minOrderValue: 500000, startDate: now, endDate: nextMonth, membershipTierId: tiers[2].id } }),
  ]);

  console.log('6. Đang tạo Flash Sale...');
  const flashSale = await prisma.flashSale.create({
    data: {
      name: 'Giờ Vàng Sushi - Nửa Giá',
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
      isActive: true,
      items: {
        create: [
          { productId: createdProducts[0].id, flashSalePrice: createdProducts[0].price * 0.5, stock: 50, maxQuantityPerUser: 2 },
          { productId: createdProducts[15].id, flashSalePrice: createdProducts[15].price * 0.7, stock: 100, maxQuantityPerUser: 5 }
        ]
      }
    }
  });

  console.log('7. Đang tạo Banners & Users...');
  await prisma.banner.createMany({
    data: [
      { imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1920', linkUrl: '/flash-sale', bannerOrder: 1, altText: 'Flash Sale Đang Diễn Ra' },
      { imageUrl: 'https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=1920', linkUrl: '/menu/sashimi', bannerOrder: 2, altText: 'Hải Sản Nhập Khẩu' },
    ]
  });

  const users = await Promise.all([
    prisma.user.create({ data: { email: 'admin@avora.vn', fullName: 'Quản trị viên', passwordHash: 'hashed_123', role: RoleType.ADMIN } }),
    prisma.user.create({
      data: {
        email: 'khachhang1@gmail.com', fullName: 'Trần Đại Phát', phone: '0901234567', passwordHash: 'hashed_123',
        points: 1500, branchId: branches[0].id, membershipTierId: tiers[2].id,
        addresses: {
          create: [{ recipientName: 'Trần Đại Phát', phone: '0901234567', streetDetail: '123 Nguyễn Huệ', ward: 'Bến Nghé', district: 'Quận 1', province: 'TP.HCM', isDefault: true, latitude: 10.774, longitude: 106.703 }]
        }
      }
    })
  ]);

  console.log('8. Đang tạo Lịch sử Đơn hàng kèm Option (OrderItemOption)...');

  const ramenProduct = createdProducts[25];
  const optionGroups = await prisma.optionGroup.findMany({ where: { productId: ramenProduct.id }, include: { optionItems: true } });

  const selectedSize = optionGroups[0]?.optionItems[1];
  const selectedTopping = optionGroups[2]?.optionItems[0];

  const itemPriceAtSale = ramenProduct.price + (selectedSize?.priceAdjustment || 0) + (selectedTopping?.priceAdjustment || 0);

  const subTotal1 = itemPriceAtSale * 1;
  const discount1 = 0;
  const totalAmount1 = subTotal1 - discount1 + 15000;

  const order1 = await prisma.order.create({
    data: {
      userId: users[1].id, branchId: branches[0].id, orderCode: 'ORD-RAMEN-01', customerName: 'Trần Đại Phát', customerPhone: '0901234567', deliveryAddress: '123 Nguyễn Huệ, Quận 1',
      subTotal: subTotal1, shippingFee: 15000, discountAmount: discount1, totalAmount: totalAmount1,
      status: OrderStatus.COMPLETED, paymentMethod: 'VN_PAY', paymentStatus: 'PAID'
    }
  });

  const orderItem = await prisma.orderItem.create({
    data: {
      orderId: order1.id, productId: ramenProduct.id, quantity: 1,
      priceAtSale: itemPriceAtSale, originalPriceAtSale: ramenProduct.price,
      optionsTextSnapshot: 'Size Lớn (Thêm mì), Thêm Trứng lòng đào (Ajitama)'
    }
  });

  if (selectedSize && selectedTopping) {
    await prisma.orderItemOption.createMany({
      data: [
        { orderItemId: orderItem.id, optionItemId: selectedSize.id, nameAtSale: selectedSize.name, priceAdjustmentAtSale: selectedSize.priceAdjustment },
        { orderItemId: orderItem.id, optionItemId: selectedTopping.id, nameAtSale: selectedTopping.name, priceAdjustmentAtSale: selectedTopping.priceAdjustment }
      ]
    });
  }

  console.log('🎉 Seeding hoàn tất! Dữ liệu của 120 món ăn kèm Option Topping đầy đủ.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });