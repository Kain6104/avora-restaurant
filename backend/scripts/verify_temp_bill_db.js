const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tmps = await prisma.printTemplate.findMany({
    where: { type: 'TEMP_BILL' },
    select: { id: true, name: true, content: true },
  });

  for (const t of tmps) {
    const hasOldLabel = t.content.includes('Ti\u1ec1n h\u00e0ng tr\u01b0\u1edbc VAT');
    const hasNewLabel = t.content.includes('TT tr\u01b0\u1edbc VAT');
    const hasOldCurrency = t.content.includes('\u00A0\u0111');
    const hasNewCurrency = t.content.includes('\u20ab');
    const hasOldFontSize = t.content.includes('font-size: 11px; margin: 3px 0;');
    const hasNewFontSize = t.content.includes('font-size: 10.5px; margin: 3px 0;');
    console.log(t.id.slice(0,8), '|',
      'OldVAT:', hasOldLabel, 'NewVAT:', hasNewLabel,
      '| Old₫:', hasOldCurrency, 'New₫:', hasNewCurrency,
      '| OldFont:', hasOldFontSize, 'NewFont:', hasNewFontSize
    );
  }
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
