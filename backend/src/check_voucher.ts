import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const voucher = await prisma.voucher.findUnique({
    where: { code: 'VIPGOLD' },
  });
  console.log('Voucher:', voucher);
  
  const user = await prisma.user.findUnique({
    where: { email: 'phatmydang@gmail.com' },
  });
  console.log('User membershipTierId:', user?.membershipTierId);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
