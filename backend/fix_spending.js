const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      orders: {
        where: { status: 'COMPLETED' }
      }
    }
  });

  for (const user of users) {
    const totalSpending = user.orders.reduce((sum, order) => sum + order.totalAmount, 0);
    if (totalSpending !== user.totalSpending) {
      await prisma.user.update({
        where: { id: user.id },
        data: { totalSpending }
      });
      console.log(`Updated user ${user.email} spending to ${totalSpending}`);
    }
  }
  console.log("Finished recalculating spending.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
