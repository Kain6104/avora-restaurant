import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tiers = await prisma.membershipTier.findMany({
    orderBy: { minSpending: 'desc' },
  });
  console.log('Tiers:', tiers);
  
  const user = await prisma.user.findUnique({
    where: { email: 'phatmydang@gmail.com' },
    include: { membershipTier: true },
  });
  console.log('User spending:', user?.totalSpending, 'Tier:', user?.membershipTier?.name);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
