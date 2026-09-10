import { PrismaClient, DayOfWeek, SlotOrderType, SlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Payment Methods
  const count = await prisma.paymentMethod.count();
  if (count === 0) {
    await prisma.paymentMethod.createMany({
      data: [
        {
          methodCode: 'CASH',
          gatewayType: 'CASH',
          name: 'Tiền mặt tại quầy (POS)',
          description: 'Thanh toán tiền mặt trực tiếp tại quầy thu ngân',
          isActive: true,
          isActiveForPos: true,
          displayOrder: 1,
          minOrderValue: 0,
        },
        {
          methodCode: 'CARD',
          gatewayType: 'CARD',
          name: 'Quẹt thẻ ngân hàng (POS)',
          description: 'Thanh toán quẹt thẻ qua máy POS ngân hàng tại quầy',
          isActive: true,
          isActiveForPos: true,
          displayOrder: 2,
          minOrderValue: 0,
        },
        {
          methodCode: 'COD',
          gatewayType: 'COD',
          name: 'Thanh toán tiền mặt khi nhận hàng (COD)',
          description: 'Thanh toán tiền mặt trực tiếp cho nhân viên giao hàng',
          isActive: true,
          isActiveForPos: false,
          displayOrder: 3,
          minOrderValue: 0,
        },
        {
          methodCode: 'TRANSFER',
          gatewayType: 'TRANSFER',
          name: 'Chuyển khoản VietQR (Napas 247)',
          description: 'Quét mã VietQR chuyển khoản nhanh 24/7 từ mọi ứng dụng ngân hàng',
          bankCode: 'MB',
          accountNumber: '0988888888',
          accountName: 'AVORA RESTAURANT',
          isActive: true,
          isActiveForPos: true,
          displayOrder: 2,
          minOrderValue: 0,
        },
        {
          methodCode: 'PAYOS',
          gatewayType: 'PAYOS',
          name: 'Cổng thanh toán PayOS',
          description: 'Thanh toán an toàn bảo mật qua cổng PayOS',
          isActive: false,
          isActiveForPos: false,
          displayOrder: 3,
          minOrderValue: 0,
        },
        {
          methodCode: 'MOMO',
          gatewayType: 'MOMO',
          name: 'Ví điện tử MoMo',
          description: 'Thanh toán tức thì qua ứng dụng ví MoMo',
          isActive: false,
          isActiveForPos: false,
          displayOrder: 4,
          minOrderValue: 0,
        },
        {
          methodCode: 'VNPAY',
          gatewayType: 'VNPAY',
          name: 'Cổng thanh toán VNPAY-QR',
          description: 'Thanh toán qua cổng điện tử VNPAY-QR',
          isActive: false,
          isActiveForPos: false,
          displayOrder: 5,
          minOrderValue: 0,
        },
      ],
    });
    console.log('Successfully seeded default payment methods');
  }

  // 2. Operating Slots for Branches
  const branches = await prisma.branch.findMany();
  for (const branch of branches) {
    const slotCount = await prisma.operatingSlot.count({ where: { branchId: branch.id } });
    if (slotCount === 0) {
      const days = [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
        DayOfWeek.SATURDAY,
        DayOfWeek.SUNDAY,
      ];
      for (const day of days) {
        await prisma.operatingSlot.createMany({
          data: [
            {
              branchId: branch.id,
              dayOfWeek: day,
              startTime: '11:00',
              endTime: '12:30',
              maxOrders: 20,
              leadTimeMinutes: 30,
              orderType: SlotOrderType.DELIVERY,
              isActive: true,
              status: SlotStatus.OPEN,
            },
            {
              branchId: branch.id,
              dayOfWeek: day,
              startTime: '12:30',
              endTime: '14:00',
              maxOrders: 25,
              leadTimeMinutes: 30,
              orderType: SlotOrderType.DELIVERY,
              isActive: true,
              status: SlotStatus.OPEN,
            },
            {
              branchId: branch.id,
              dayOfWeek: day,
              startTime: '17:30',
              endTime: '19:00',
              maxOrders: 30,
              leadTimeMinutes: 30,
              orderType: SlotOrderType.DELIVERY,
              isActive: true,
              status: SlotStatus.OPEN,
            },
            {
              branchId: branch.id,
              dayOfWeek: day,
              startTime: '19:00',
              endTime: '20:30',
              maxOrders: 30,
              leadTimeMinutes: 30,
              orderType: SlotOrderType.DELIVERY,
              isActive: true,
              status: SlotStatus.OPEN,
            },
          ],
        });
      }
      console.log(`Seeded standard slots for branch ${branch.name}`);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
