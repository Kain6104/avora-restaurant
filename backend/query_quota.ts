import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const flashSale = await prisma.flashSale.findFirst({ where: { isActive: true }, include: { items: true } });
  if (!flashSale) return console.log('No active flash sale');
  const pastOrders = await prisma.orderItem.aggregate({
    where: {
      flashSaleId: flashSale.id,
      order: { userId: '9c00c7ca-e2d5-4ced-a12b-9c0f7b212a45', status: { not: 'CANCELLED' } }
    },
    _sum: { quantity: true }
  });
  console.log('Bought:', pastOrders._sum.quantity);
}
main().finally(() => prisma.$disconnect());
