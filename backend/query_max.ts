import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const flashSale = await prisma.flashSale.findFirst({ where: { isActive: true }, include: { items: { include: { product: true } } } });
  if (!flashSale) return;
  for (const item of flashSale.items) {
    console.log(item.product.name, 'Max:', item.maxQuantityPerUser);
  }
}
main().finally(() => prisma.$disconnect());
