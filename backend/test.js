const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER' },
    select: { id: true, fullName: true, branchId: true }
  });
  console.log('Managers:', managers);

  const branches = await prisma.branch.findMany({
    select: { id: true, name: true }
  });
  console.log('Branches:', branches);
}

main().catch(console.error).finally(() => prisma.$disconnect());
