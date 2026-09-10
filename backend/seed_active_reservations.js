const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({ take: 2 });
  if (branches.length === 0) return;

  const branch1 = branches[0];
  const branch2 = branches[1];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const bookings = [
    {
      reservationCode: 'AVR-260904-L01',
      branchId: branch1.id,
      customerName: 'Trần Đại Phát',
      customerPhone: '0901234567',
      customerEmail: 'phat@gmail.com',
      partySize: 4,
      reservationDate: today,
      reservationTime: '18:30',
      tablePreference: 'Bàn cạnh cửa kính view đẹp',
      occasion: 'Sinh nhật bạn bè',
      specialRequests: 'Chuẩn bị nến sinh nhật và bánh kem',
      status: 'CONFIRMED',
      source: 'WEB',
    },
    {
      reservationCode: 'AVR-260904-L02',
      branchId: branch1.id,
      customerName: 'Chị Hoàng Thùy Linh',
      customerPhone: '0988776655',
      customerEmail: 'thuylinh@gmail.com',
      partySize: 2,
      reservationDate: today,
      reservationTime: '19:00',
      tablePreference: 'Khu vực VIP yên tĩnh',
      occasion: 'Hẹn hò lãng mạn',
      specialRequests: 'Dùng set Steak bò Wagyu và rượu vang đỏ',
      status: 'CONFIRMED',
      source: 'CHATBOT',
    },
    {
      reservationCode: 'AVR-260904-L03',
      branchId: branch1.id,
      customerName: 'Tập đoàn VietTech Corp',
      customerPhone: '0912345678',
      customerEmail: 'contact@viettech.vn',
      partySize: 10,
      reservationDate: today,
      reservationTime: '20:00',
      tablePreference: 'Phòng VIP lớn',
      occasion: 'Tiệc liên hoan công ty',
      specialRequests: 'Xuất hóa đơn VAT công ty',
      status: 'PENDING',
      source: 'ADMIN',
    },
    {
      reservationCode: 'AVR-260905-M01',
      branchId: branch1.id,
      customerName: 'Anh Vũ Minh Trí',
      customerPhone: '0977112233',
      partySize: 6,
      reservationDate: tomorrow,
      reservationTime: '12:00',
      tablePreference: 'Bàn tròn gia đình',
      occasion: 'Gặp gỡ gia đình cuối tuần',
      specialRequests: 'Có 2 ghế trẻ em',
      status: 'CONFIRMED',
      source: 'WEB',
    }
  ];

  for (const b of bookings) {
    const existing = await prisma.reservation.findUnique({ where: { reservationCode: b.reservationCode } });
    if (!existing) {
      await prisma.reservation.create({ data: b });
      console.log('Created booking:', b.reservationCode, b.customerName);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(console.error);
