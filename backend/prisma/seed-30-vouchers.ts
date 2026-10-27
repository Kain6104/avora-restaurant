import { PrismaClient, DiscountType } from '@prisma/client';

const prisma = new PrismaClient();

const newYearVouchers = [
  {
    code: 'NEWYEAR27_10K',
    title: 'Khai Xuân Như Ý - Giảm 10%',
    description: 'Ưu đãi đón xuân 2027, giảm 10% tối đa 50.000đ cho đơn từ 200.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    maxDiscount: 50000,
    minOrderValue: 200000,
  },
  {
    code: 'NEWYEAR27_15K',
    title: 'Tết Sum Vầy - Giảm 15%',
    description: 'Đón mừng năm mới 2027, giảm 15% tối đa 80.000đ cho đơn từ 300.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 15,
    maxDiscount: 80000,
    minOrderValue: 300000,
  },
  {
    code: 'NEWYEAR27_20K',
    title: 'Lộc Xuân Phát Tài - Giảm 20%',
    description: 'Giảm ngay 20% tối đa 120.000đ cho đơn từ 450.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 20,
    maxDiscount: 120000,
    minOrderValue: 450000,
  },
  {
    code: 'NEWYEAR27_25K',
    title: 'Khang Thịnh Vượng - Giảm 25%',
    description: 'Ưu đãi mừng năm mới, giảm 25% tối đa 150.000đ cho đơn từ 600.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 25,
    maxDiscount: 150000,
    minOrderValue: 600000,
  },
  {
    code: 'NEWYEAR27_30K',
    title: 'Đại Hỷ Đầu Xuân - Giảm 30%',
    description: 'Giảm đậm 30% tối đa 200.000đ cho đơn đại tiệc từ 800.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 30,
    maxDiscount: 200000,
    minOrderValue: 800000,
  },
  {
    code: 'NEWYEAR27_FIX30',
    title: 'Lì Xì Đầu Năm - Giảm 30.000đ',
    description: 'Lì xì trực tiếp 30.000đ cho đơn đặt món từ 250.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 30000,
    maxDiscount: null,
    minOrderValue: 250000,
  },
  {
    code: 'NEWYEAR27_FIX50',
    title: 'Khai Tiệc Tân Xuân - Giảm 50.000đ',
    description: 'Giảm thẳng 50.000đ cho đơn hàng từ 350.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 50000,
    maxDiscount: null,
    minOrderValue: 350000,
  },
  {
    code: 'NEWYEAR27_FIX70',
    title: 'Tài Lộc Dồi Dào - Giảm 70.000đ',
    description: 'Giảm ngay 70.000đ cho bữa tiệc gia đình từ 500.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 70000,
    maxDiscount: null,
    minOrderValue: 500000,
  },
  {
    code: 'NEWYEAR27_FIX100',
    title: 'Phú Quý An Khang - Giảm 100.000đ',
    description: 'Ưu đãi 100.000đ cho đơn tiệc năm mới từ 700.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 100000,
    maxDiscount: null,
    minOrderValue: 700000,
  },
  {
    code: 'NEWYEAR27_FIX150',
    title: 'Vạn Sự Như Ý - Giảm 150.000đ',
    description: 'Giảm ngay 150.000đ cho đơn tiệc đông người từ 1.000.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 150000,
    maxDiscount: null,
    minOrderValue: 1000000,
  },
  {
    code: 'NEWYEAR27_SHIP20',
    title: 'Freeship Năm Mới - Giảm 20.000đ',
    description: 'Miễn phí giao hàng đón Tết tới 20.000đ cho đơn từ 200.000đ',
    discountType: DiscountType.FREE_SHIP,
    discountValue: 20000,
    maxDiscount: 20000,
    minOrderValue: 200000,
  },
  {
    code: 'NEWYEAR27_SHIP35',
    title: 'Freeship Du Xuân - Giảm 35.000đ',
    description: 'Miễn phí giao hàng tân niên tới 35.000đ cho đơn từ 300.000đ',
    discountType: DiscountType.FREE_SHIP,
    discountValue: 35000,
    maxDiscount: 35000,
    minOrderValue: 300000,
  },
  {
    code: 'NEWYEAR27_SHIP50',
    title: 'Freeship Đoàn Viên - Giảm 50.000đ',
    description: 'Miễn phí giao hàng tận cửa tới 50.000đ cho đơn từ 500.000đ',
    discountType: DiscountType.FREE_SHIP,
    discountValue: 50000,
    maxDiscount: 50000,
    minOrderValue: 500000,
  },
  {
    code: 'NEWYEAR27_PARTY12',
    title: 'Tiệc Xuân Hội Ngộ - Giảm 12%',
    description: 'Giảm 12% tối đa 90.000đ mừng năm mới cho đơn từ 400.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 12,
    maxDiscount: 90000,
    minOrderValue: 400000,
  },
  {
    code: 'NEWYEAR27_PARTY18',
    title: 'Tân Niên Rực Rỡ - Giảm 18%',
    description: 'Giảm 18% tối đa 140.000đ cho đơn hàng từ 550.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 18,
    maxDiscount: 140000,
    minOrderValue: 550000,
  },
];

const customerAppreciationVouchers = [
  {
    code: 'TRIAN_THANK10',
    title: 'Tri Ân Khách Quý - Giảm 10%',
    description: 'Cảm ơn bạn đã luôn đồng hành cùng Avora, giảm 10% tối đa 60.000đ từ 200.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    maxDiscount: 60000,
    minOrderValue: 200000,
  },
  {
    code: 'TRIAN_THANK15',
    title: 'Gắn Kết Yêu Thương - Giảm 15%',
    description: 'Món quà tri ân đặc biệt, giảm 15% tối đa 90.000đ cho đơn từ 350.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 15,
    maxDiscount: 90000,
    minOrderValue: 350000,
  },
  {
    code: 'TRIAN_THANK20',
    title: 'Khách Hàng Thân Thiết - Giảm 20%',
    description: 'Đặc quyền thành viên gắn bó, giảm 20% tối đa 130.000đ từ 450.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 20,
    maxDiscount: 130000,
    minOrderValue: 450000,
  },
  {
    code: 'TRIAN_THANK25',
    title: 'Đồng Hành Cùng Avora - Giảm 25%',
    description: 'Ưu đãi tri ân sâu sắc, giảm 25% tối đa 160.000đ cho đơn từ 650.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 25,
    maxDiscount: 160000,
    minOrderValue: 650000,
  },
  {
    code: 'TRIAN_VIP30',
    title: 'Tri Ân Thượng Khách VIP - Giảm 30%',
    description: 'Mức giảm tối thượng 30% tối đa 250.000đ cho đơn từ 900.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 30,
    maxDiscount: 250000,
    minOrderValue: 900000,
  },
  {
    code: 'TRIAN_GIFT40',
    title: 'Quà Tặng Tri Ân - Giảm 40.000đ',
    description: 'Trừ thẳng 40.000đ vào hóa đơn đặt món từ 280.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 40000,
    maxDiscount: null,
    minOrderValue: 280000,
  },
  {
    code: 'TRIAN_GIFT60',
    title: 'Món Quà Ngọt Ngào - Giảm 60.000đ',
    description: 'Giảm ngay 60.000đ tri ân khách hàng từ 420.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 60000,
    maxDiscount: null,
    minOrderValue: 420000,
  },
  {
    code: 'TRIAN_GIFT80',
    title: 'Ẩm Thực Tinh Hoa - Giảm 80.000đ',
    description: 'Ưu đãi 80.000đ cảm ơn quý khách cho đơn từ 550.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 80000,
    maxDiscount: null,
    minOrderValue: 550000,
  },
  {
    code: 'TRIAN_GIFT120',
    title: 'Tiệc Tri Ân Đặc Biệt - Giảm 120.000đ',
    description: 'Giảm trực tiếp 120.000đ cho đơn hàng tiệc từ 800.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 120000,
    maxDiscount: null,
    minOrderValue: 800000,
  },
  {
    code: 'TRIAN_GIFT200',
    title: 'Tri Ân Vàng Avora - Giảm 200.000đ',
    description: 'Tặng ngay 200.000đ cho đơn hàng đại tiệc từ 1.200.000đ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 200000,
    maxDiscount: null,
    minOrderValue: 1200000,
  },
  {
    code: 'TRIAN_FREESHIP25',
    title: 'Freeship Tri Ân - Giảm 25.000đ',
    description: 'Miễn phí giao hàng tới 25.000đ thay lời cảm ơn từ đơn 220.000đ',
    discountType: DiscountType.FREE_SHIP,
    discountValue: 25000,
    maxDiscount: 25000,
    minOrderValue: 220000,
  },
  {
    code: 'TRIAN_FREESHIP40',
    title: 'Freeship Đồng Hành - Giảm 40.000đ',
    description: 'Freeship tận nơi tới 40.000đ cho đơn hàng từ 380.000đ',
    discountType: DiscountType.FREE_SHIP,
    discountValue: 40000,
    maxDiscount: 40000,
    minOrderValue: 380000,
  },
  {
    code: 'TRIAN_FREESHIPMAX',
    title: 'Freeship Toàn Diện - Giảm 60.000đ',
    description: 'Freeship tối đa tới 60.000đ cho đơn hàng từ 600.000đ',
    discountType: DiscountType.FREE_SHIP,
    discountValue: 60000,
    maxDiscount: 60000,
    minOrderValue: 600000,
  },
  {
    code: 'TRIAN_HAPPY14',
    title: 'Niềm Vui Bất Tận - Giảm 14%',
    description: 'Giảm 14% tối đa 95.000đ tri ân khách hàng thân thiết cho đơn từ 400.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 14,
    maxDiscount: 95000,
    minOrderValue: 400000,
  },
  {
    code: 'TRIAN_HAPPY22',
    title: 'Hương Vị Tri Ân - Giảm 22%',
    description: 'Giảm 22% tối đa 145.000đ cho đơn hàng từ 550.000đ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 22,
    maxDiscount: 145000,
    minOrderValue: 550000,
  },
];

async function main() {
  console.log('--- SEEDING 30 NEW PRODUCTION VOUCHERS ---');
  // Start date: Current time / beginning of today
  const startDate = new Date('2026-10-27T00:00:00.000Z');
  // End date: 28/02/2027 23:59:59 GMT+7 => 2027-02-28 16:59:59 UTC
  const endDate = new Date('2027-02-28T16:59:59.000Z');

  const allVouchers = [...newYearVouchers, ...customerAppreciationVouchers];
  console.log(`Total vouchers to seed: ${allVouchers.length}`);

  let createdCount = 0;
  for (const v of allVouchers) {
    const existing = await prisma.voucher.findUnique({
      where: { code: v.code },
    });
    if (!existing) {
      await prisma.voucher.create({
        data: {
          code: v.code,
          title: v.title,
          description: v.description,
          discountType: v.discountType,
          discountValue: v.discountValue,
          maxDiscount: v.maxDiscount,
          minOrderValue: v.minOrderValue,
          usageLimit: 1000,
          usageLimitPerUser: 2,
          usedCount: 0,
          isPublic: true,
          startDate,
          endDate,
          isActive: true,
          applicableScope: 'ALL',
          appliesToAllPaymentMethods: true,
          applicableProductsScope: 'ALL',
          targetCustomerScope: 'ALL',
        },
      });
      createdCount++;
      console.log(`[+] Created voucher: ${v.code} - ${v.title}`);
    } else {
      console.log(`[~] Voucher ${v.code} already exists, skipping.`);
    }
  }

  console.log(`\nSuccessfully seeded ${createdCount} new vouchers!`);
  const totalInDb = await prisma.voucher.count();
  console.log(`Total vouchers currently in database: ${totalInDb}`);
}

main()
  .catch((e) => {
    console.error('Failed to seed vouchers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
