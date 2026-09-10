import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Backfilling Flash Sale Slots for Existing Campaigns ---');
  const flashSales = await prisma.flashSale.findMany({
    include: {
      slots: true,
      items: true,
    },
  });

  console.log(`Found ${flashSales.length} Flash Sale campaigns in database.`);

  for (const fs of flashSales) {
    if (!fs.code) {
      const generatedCode = `FS-${fs.createdAt.getFullYear()}${String(fs.createdAt.getMonth() + 1).padStart(2, '0')}-${fs.id.slice(0, 6).toUpperCase()}`;
      await prisma.flashSale.update({
        where: { id: fs.id },
        data: { code: generatedCode },
      });
      console.log(`Updated campaign ${fs.name} with code: ${generatedCode}`);
    }

    if (fs.slots.length === 0) {
      console.log(`Campaign "${fs.name}" has 0 slots. Creating default slot...`);
      const defaultSlot = await prisma.flashSaleSlot.create({
        data: {
          flashSaleId: fs.id,
          name: 'Khung giờ chính',
          startTime: fs.startTime,
          endTime: fs.endTime,
          teaserStartAt: fs.teaserStartAt,
          sortOrder: 0,
          isActive: fs.isActive,
        },
      });

      if (fs.items.length > 0) {
        await prisma.flashSaleItem.updateMany({
          where: {
            flashSaleId: fs.id,
            flashSaleSlotId: null,
          },
          data: {
            flashSaleSlotId: defaultSlot.id,
          },
        });
        console.log(`Linked ${fs.items.length} items of "${fs.name}" to default slot ${defaultSlot.id}`);
      }
    } else {
      // Ensure any unlinked items are linked to the first slot
      const firstSlot = fs.slots[0];
      const unlinkedItems = fs.items.filter((it) => !it.flashSaleSlotId);
      if (unlinkedItems.length > 0) {
        await prisma.flashSaleItem.updateMany({
          where: {
            flashSaleId: fs.id,
            flashSaleSlotId: null,
          },
          data: {
            flashSaleSlotId: firstSlot.id,
          },
        });
        console.log(`Linked ${unlinkedItems.length} orphaned items of "${fs.name}" to slot ${firstSlot.name}`);
      }
    }
  }

  console.log('--- Backfill Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
