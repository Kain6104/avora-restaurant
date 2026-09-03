import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const diamondTier = await prisma.membershipTier.findUnique({
    where: { name: 'Kim Cương' }
  });

  if (!diamondTier) {
    console.error('Không tìm thấy hạng Kim Cương');
    return;
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const voucher = await prisma.voucher.upsert({
    where: { code: 'VIPDIAMOND' },
    update: {
      isActive: true,
      membershipTierId: diamondTier.id,
      title: 'Giảm 15% Hạng Kim Cương',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      maxDiscount: 300000,
      minOrderValue: 500000,
      startDate,
      endDate,
    },
    create: {
      code: 'VIPDIAMOND',
      title: 'Giảm 15% Hạng Kim Cương',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      maxDiscount: 300000,
      minOrderValue: 500000,
      usageLimitPerUser: 1,
      isPublic: true,
      startDate,
      endDate,
      isActive: true,
      membershipTierId: diamondTier.id,
    },
  });

  console.log('Đã bổ sung mã VIPDIAMOND thành công!', voucher);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
