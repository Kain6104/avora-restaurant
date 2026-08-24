const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branchId = '5718802c-5e1d-4a90-b736-cc34cc05d0db'; // from earlier logs
  const products = await prisma.product.findMany({
    where: { available: true, branches: { some: { id: branchId } } },
    select: { id: true, name: true }
  });
  console.log(`Branch ${branchId} has ${products.length} products:`);
  console.log(products.map(p => p.name));
  
  const allProducts = await prisma.product.findMany({
     where: { available: true },
     select: { id: true, name: true, branches: { select: { id: true } } }
  });
  console.log(`\nTotal available products in DB: ${allProducts.length}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
