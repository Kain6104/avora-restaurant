import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findUnique({
    where: { orderCode: 'ORD-1787827711119' }, // The user said order code is ORD-1787827711119
    include: { user: true, PointTransaction: true },
  });
  console.log(JSON.stringify(order, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
