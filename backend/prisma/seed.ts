import { PrismaClient, RoleType, ReservationStatus, OrderStatus, ServingType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu dọn dẹp Database cũ...');
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.optionItem.deleteMany();
  await prisma.optionGroup.deleteMany();
  await prisma.address.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.user.deleteMany();

  console.log('1. Đang tạo 5 Chi nhánh (Branches)...');
  const branches = await Promise.all([
    prisma.branch.create({ data: { name: 'Avora Signature Quận 1', branchCode: 'AVO-Q1', street: '123 Lê Lợi', district: 'Quận 1', province: 'TP.HCM', openTime: '10:00', closeTime: '23:00' } }),
    prisma.branch.create({ data: { name: 'Avora Premium Thảo Điền', branchCode: 'AVO-Q2', street: '45 Xuân Thủy', district: 'Quận 2', province: 'TP.HCM', openTime: '10:00', closeTime: '22:30' } }),
    prisma.branch.create({ data: { name: 'Avora Landmark 81', branchCode: 'AVO-L81', street: '720A Điện Biên Phủ', district: 'Bình Thạnh', province: 'TP.HCM', openTime: '09:00', closeTime: '22:00' } }),
    prisma.branch.create({ data: { name: 'Avora Hoàn Kiếm', branchCode: 'AVO-HN1', street: '15 Lý Thái Tổ', district: 'Hoàn Kiếm', province: 'Hà Nội', openTime: '10:00', closeTime: '23:00' } }),
    prisma.branch.create({ data: { name: 'Avora West Lake', branchCode: 'AVO-HN2', street: '88 Xuân Diệu', district: 'Tây Hồ', province: 'Hà Nội', openTime: '11:00', closeTime: '23:30' } }),
  ]);

  console.log('2. Đang tạo 5 Danh mục (Categories)...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Sushi & Maki', slug: 'sushi-maki', displayOrder: 1, image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400', branches: { connect: [{ id: branches[0].id }, { id: branches[1].id }] } } }),
    prisma.category.create({ data: { name: 'Sashimi Tươi Sống', slug: 'sashimi', displayOrder: 2, image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400', branches: { connect: [{ id: branches[0].id }, { id: branches[1].id }] } } }),
    prisma.category.create({ data: { name: 'Món Nóng (Hot Dish)', slug: 'mon-nong', displayOrder: 3, image: 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=400', branches: { connect: [{ id: branches[0].id }, { id: branches[1].id }] } } }),
    prisma.category.create({ data: { name: 'Set Omakase', slug: 'omakase-set', displayOrder: 4, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400', branches: { connect: [{ id: branches[0].id }, { id: branches[1].id }] } } }),
    prisma.category.create({ data: { name: 'Sake & Đồ Uống', slug: 'do-uong', displayOrder: 5, image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400', branches: { connect: [{ id: branches[0].id }, { id: branches[1].id }] } } }),
  ]);

  console.log('3. Đang tạo 5 Sản phẩm & Tùy chọn đi kèm...');
  const products = await Promise.all([
    prisma.product.create({
      data: {
        itemCode: 'SP01', name: 'Combo Sushi Thượng Hạng', slug: 'combo-sushi-thuong-hang', price: 899000, oldPrice: 1200000, isBestSeller: true,
        imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800', description: 'Gồm 20 miếng Nigiri và Maki tổng hợp từ bếp trưởng.',
        categoryId: categories[0].id, branches: { connect: [{ id: branches[0].id }, { id: branches[1].id }] },
        optionGroups: {
          create: [{
            name: 'Kích cỡ Set', isRequired: true,
            optionItems: { create: [{ name: 'Set Tiêu chuẩn', priceAdjustment: 0, isDefault: true }, { name: 'Set Lớn (Thêm 10 miếng)', priceAdjustment: 350000 }] }
          }]
        }
      }
    }),
    prisma.product.create({
      data: {
        itemCode: 'SP02', name: 'Sashimi Cá Hồi Na Uy Bụng', slug: 'sashimi-ca-hoi-bung', price: 350000, isAiRecommended: true,
        imageUrl: 'https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=800', description: 'Phần thịt bụng béo ngậy, nhập khẩu trực tiếp.',
        categoryId: categories[1].id, branches: { connect: [{ id: branches[0].id }] }
      }
    }),
    prisma.product.create({
      data: {
        itemCode: 'SP03', name: 'Bò Wagyu A5 Nướng Đá', slug: 'bo-wagyu-a5-nuong-da', price: 1500000, oldPrice: 1800000, isBestSeller: true,
        imageUrl: 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=800', description: 'Thịt bò Wagyu A5 vân mỡ cẩm thạch hoàn hảo.',
        categoryId: categories[2].id, branches: { connect: [{ id: branches[0].id }, { id: branches[2].id }] },
        optionGroups: {
          create: [{
            name: 'Độ chín', isRequired: true,
            optionItems: { create: [{ name: 'Medium Rare', priceAdjustment: 0, isDefault: true }, { name: 'Medium', priceAdjustment: 0 }, { name: 'Well Done', priceAdjustment: 0 }] }
          }]
        }
      }
    }),
    prisma.product.create({
      data: {
        itemCode: 'SP04', name: 'Omakase Trải Nghiệm Mùa Thu', slug: 'omakase-mua-thu', price: 2500000, isAiRecommended: true,
        imageUrl: 'https://images.unsplash.com/photo-1581781870027-04212e231e96?w=800', description: 'Hành trình vị giác với 12 món do Bếp trưởng thiết kế riêng.',
        categoryId: categories[3].id, branches: { connect: [{ id: branches[0].id }] }
      }
    }),
    prisma.product.create({
      data: {
        itemCode: 'SP05', name: 'Rượu Sake Dassai 23', slug: 'sake-dassai-23', price: 3200000,
        imageUrl: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=800', description: 'Dòng Sake cao cấp nhất với tỷ lệ chà xát gạo 23%.',
        categoryId: categories[4].id, branches: { connect: [{ id: branches[0].id }, { id: branches[3].id }] }
      }
    }),
  ]);

  console.log('4. Đang tạo 5 Banners...');
  await prisma.banner.createMany({
    data: [
      { imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1920', linkUrl: '/omakase', bannerOrder: 1, altText: 'Omakase Nghệ Thuật' },
      { imageUrl: 'https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=1920', linkUrl: '/menu/sashimi', bannerOrder: 2, altText: 'Hải Sản Nhập Khẩu' },
      { imageUrl: 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=1920', linkUrl: '/menu/mon-nong', bannerOrder: 3, altText: 'Bò Wagyu Thượng Hạng' },
      { imageUrl: 'https://images.unsplash.com/photo-1581781870027-04212e231e96?w=1920', linkUrl: '/rewards', bannerOrder: 4, altText: 'Ưu đãi Thành viên' },
      { imageUrl: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=1920', linkUrl: '/menu', bannerOrder: 5, altText: 'Giờ Vàng Sake' },
    ]
  });

  console.log('5. Đang tạo 5 Người dùng (Users)...');
  const users = await Promise.all([
    prisma.user.create({ data: { email: 'admin@avora.vn', fullName: 'Quản trị viên', passwordHash: 'hashed_123', role: RoleType.ADMIN } }),
    prisma.user.create({ data: { email: 'manager@avora.vn', fullName: 'Quản lý Nhà hàng', passwordHash: 'hashed_123', role: RoleType.MANAGER } }),
    prisma.user.create({
      data: {
        email: 'khachhang1@gmail.com', fullName: 'Trần Đại Phát', phone: '0901234567', passwordHash: 'hashed_123', points: 1500, branchId: branches[0].id,
        addresses: {
          create: [{
            recipientName: 'Trần Đại Phát', // Thêm tên người nhận
            phone: '0901234567',          // Thêm SĐT
            streetDetail: '123 Nguyễn Huệ', // ĐÃ ĐỔI TỪ street -> streetDetail
            ward: 'Bến Nghé',
            district: 'Quận 1',
            province: 'TP.HCM',
            isDefault: true
          }]
        }
      }
    }),
    prisma.user.create({ data: { email: 'khachhang2@gmail.com', fullName: 'Lê Minh Tâm', phone: '0912345678', passwordHash: 'hashed_123', points: 500 } }),
    prisma.user.create({ data: { email: 'khachhang3@gmail.com', fullName: 'Nguyễn Bích Ngọc', phone: '0923456789', passwordHash: 'hashed_123', points: 0 } }),
  ]);

  console.log('6. Đang tạo 5 Đặt bàn (Reservations)...');
  await prisma.reservation.createMany({
    data: [
      { userId: users[2].id, branchId: branches[0].id, reservationDate: new Date('2026-08-20'), reservationTime: '19:00', partySize: 2, tablePreference: 'VIP', status: ReservationStatus.CONFIRMED },
      { userId: users[3].id, branchId: branches[1].id, reservationDate: new Date('2026-08-21'), reservationTime: '18:30', partySize: 4, specialRequests: 'Ghi chú sinh nhật', status: ReservationStatus.PENDING },
      { userId: users[4].id, branchId: branches[2].id, reservationDate: new Date('2026-08-22'), reservationTime: '20:00', partySize: 2, tablePreference: 'Cạnh cửa sổ', status: ReservationStatus.CONFIRMED },
      { userId: users[2].id, branchId: branches[3].id, reservationDate: new Date('2026-08-15'), reservationTime: '12:00', partySize: 6, status: ReservationStatus.COMPLETED },
      { userId: users[3].id, branchId: branches[0].id, reservationDate: new Date('2026-08-10'), reservationTime: '19:30', partySize: 2, status: ReservationStatus.CANCELLED },
    ]
  });

  console.log('7. Đang tạo 5 Đơn hàng (Orders)...');
  await prisma.order.createMany({
    data: [
      { userId: users[2].id, branchId: branches[0].id, orderCode: 'ORD-001', customerName: 'Trần Đại Phát', customerPhone: '0901234567', deliveryAddress: '123 Nguyễn Huệ, Quận 1', subTotal: 1249000, totalAmount: 1249000, status: OrderStatus.COMPLETED },
      { userId: users[3].id, branchId: branches[1].id, orderCode: 'ORD-002', customerName: 'Lê Minh Tâm', customerPhone: '0912345678', deliveryAddress: '45 Lê Duẩn, Quận 1', subTotal: 350000, totalAmount: 350000, status: OrderStatus.PREPARING },
      { userId: users[4].id, branchId: branches[0].id, orderCode: 'ORD-003', customerName: 'Nguyễn Bích Ngọc', customerPhone: '0923456789', deliveryAddress: '88 Nguyễn Đình Chiểu, Quận 3', subTotal: 1500000, totalAmount: 1500000, status: OrderStatus.PENDING },
      { userId: users[2].id, branchId: branches[1].id, orderCode: 'ORD-004', customerName: 'Trần Đại Phát', customerPhone: '0901234567', deliveryAddress: '123 Nguyễn Huệ, Quận 1', subTotal: 5500000, totalAmount: 5500000, status: OrderStatus.DELIVERING },
      { userId: users[3].id, branchId: branches[0].id, orderCode: 'ORD-005', customerName: 'Lê Minh Tâm', customerPhone: '0912345678', deliveryAddress: '45 Lê Duẩn, Quận 1', subTotal: 899000, totalAmount: 899000, status: OrderStatus.CANCELLED },
    ]
  });

  console.log('🎉 Seeding hoàn tất! Database đã sẵn sàng.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });