import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const combos = await prisma.combo.findMany({
    include: {
      branches: true,
      membershipTiers: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  console.log(`Found ${combos.length} combos:`);
  console.log(JSON.stringify(combos, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
