import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.order.update({
    where: { orderCode: 'ORD-1787827711119' },
    data: {
      status: 'PENDING',
      cancelReason: null,
      canceledBy: null,
      canceledAt: null,
    },
  });
  console.log('Order ORD-1787827711119 reset to PENDING');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
