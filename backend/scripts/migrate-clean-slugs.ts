import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function toCleanSlug(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function migrateSlugs() {
  console.log('--- STARTING SLUG MIGRATION ---');

  // 1. Categories
  const categories = await prisma.category.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${categories.length} categories.`);

  const usedCategorySlugs = new Set<string>();

  for (const cat of categories) {
    let base = toCleanSlug(cat.name) || 'danh-muc';
    let targetSlug = base;
    let counter = 2;

    while (usedCategorySlugs.has(targetSlug)) {
      targetSlug = `${base}-dm${counter}`;
      counter++;
    }

    usedCategorySlugs.add(targetSlug);

    if (cat.slug !== targetSlug) {
      console.log(`[Category] "${cat.name}": "${cat.slug}" -> "${targetSlug}"`);
      await prisma.category.update({
        where: { id: cat.id },
        data: { slug: targetSlug },
      });
    } else {
      console.log(`[Category] "${cat.name}": already "${cat.slug}"`);
    }
  }

  // 2. Products
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`\nFound ${products.length} products.`);

  const usedProductSlugs = new Set<string>();

  for (const prod of products) {
    let base = toCleanSlug(prod.name) || 'san-pham';
    let targetSlug = base;
    let counter = 2;

    while (usedProductSlugs.has(targetSlug)) {
      targetSlug = `${base}-sp${counter}`;
      counter++;
    }

    usedProductSlugs.add(targetSlug);

    if (prod.slug !== targetSlug) {
      console.log(`[Product] "${prod.name}": "${prod.slug}" -> "${targetSlug}"`);
      await prisma.product.update({
        where: { id: prod.id },
        data: { slug: targetSlug },
      });
    } else {
      console.log(`[Product] "${prod.name}": already "${prod.slug}"`);
    }
  }

  console.log('\n--- SLUG MIGRATION COMPLETE ---');
}

migrateSlugs()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
