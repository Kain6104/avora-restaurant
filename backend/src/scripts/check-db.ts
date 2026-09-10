import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const roles = await prisma.accessRole.findMany({
    include: {
      _count: { select: { permissions: true, assignments: true } },
    },
  });
  console.log('Roles in DB count:', roles.length);
  console.log('Roles:', roles);
  const permsCount = await prisma.permission.count();
  console.log('Permissions count:', permsCount);
  await prisma.$disconnect();
}

main().catch(console.error);
