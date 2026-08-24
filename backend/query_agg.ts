import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const items = await prisma.orderItem.aggregate({
    where: { order: { userId: '7f837d48-20be-4d86-befa-114193b10bc5' } },
    _sum: { quantity: true }
  });
  console.log(items);
}
main().finally(() => prisma.$disconnect());
