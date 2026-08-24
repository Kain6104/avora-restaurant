import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.orderItem.findMany({
    select: {
      id: true,
      isFlashSaleItem: true,
      flashSaleId: true,
      quantity: true,
      order: {
        select: { userId: true, status: true }
      }
    }
  });
  console.log(JSON.stringify(items, null, 2));
}

main().finally(() => prisma.$disconnect());
