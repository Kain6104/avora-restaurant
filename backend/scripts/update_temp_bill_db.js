const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tmps = await prisma.printTemplate.findMany({
    where: { type: 'TEMP_BILL' },
    select: { id: true, content: true },
  });

  let updated = 0;
  for (const t of tmps) {
    let content = t.content;

    // 1. Fix "Tiền hàng trước VAT" -> "TT trước VAT"
    content = content.replace(/Ti\u1ec1n h\u00e0ng tr\u01b0\u1edbc VAT/g, 'TT tr\u01b0\u1edbc VAT');

    // 2. Fix old currency symbol: "\u00A0đ" or " đ" -> "₫" (attached, no space)
    // Replace non-breaking space + đ
    content = content.replace(/\u00A0\u0111/g, '\u20ab');
    // Replace space + đ at end of currency strings (e.g. "100.000 đ")
    content = content.replace(/ \u0111([^a-z\u0103\u0111\u0129\u1ebb\u1ebd\u1eaf\u1eb1\u1eb3\u1eb5\u1eb7\u1ea7\u1ea9\u1eab\u1ead\u1eaf\u1eb1\u1eb3\u1eb5\u1eb7\u1ea1\u1ea3\u1ea5\u1ea7\u1ea9\u1eab\u1ead\u1eaf\u1eb1\u0103\u00e2\u00ea\u00f4\u01a1\u01b0\u1ecd\u0101])/g, '\u20ab$1');

    // 3. Fix item table: font-size 11px -> 10.5px, column widths
    content = content.replace(
      /<table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 3px 0;">/g,
      '<table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin: 3px 0;">'
    );

    // 4. Fix column widths: width: 44% -> 46%, width: 10% -> 9%
    content = content.replace(
      /padding: 2\.5px 0; width: 44%;/g,
      'padding: 2px 0; width: 46%;'
    );
    content = content.replace(
      /padding: 2\.5px 0; width: 10%; white-space: nowrap;/g,
      'padding: 2px 0; width: 9%; white-space: nowrap;'
    );
    content = content.replace(
      /(padding: 2\.5px 0; width: 23%; white-space: nowrap;">Đ\.Giá<\/th>)/g,
      'padding: 2px 0; width: 22%; white-space: nowrap;">Đ.Giá</th>'
    );
    content = content.replace(
      /(padding: 2\.5px 0; width: 23%; white-space: nowrap;">T\.Tiền<\/th>)/g,
      'padding: 2px 0; width: 23%; white-space: nowrap;">T.Tiền</th>'
    );

    // 5. Fix item row: padding 2.5px -> 2px
    content = content.replace(/padding: 2\.5px 0; word-break: break-word;/g,
      'padding: 2px 0; word-break: break-word; overflow-wrap: break-word;');
    content = content.replace(/padding: 2\.5px 0; white-space: nowrap;">\[So_Luong\]/g,
      'padding: 2px 0; white-space: nowrap; font-weight: bold;">[So_Luong]');
    content = content.replace(
      /padding: 2\.5px 0; white-space: nowrap;">\[Don_Gia\]/g,
      'padding: 2px 0; white-space: nowrap;">[Don_Gia]'
    );
    content = content.replace(
      /padding: 2\.5px 0; font-weight: bold; white-space: nowrap;">\[Thanh_Tien\]/g,
      'padding: 2px 0; font-weight: bold; white-space: nowrap;">[Thanh_Tien]'
    );

    if (content !== t.content) {
      await prisma.printTemplate.update({
        where: { id: t.id },
        data: { content },
      });
      console.log('Updated:', t.id);
      updated++;
    } else {
      console.log('No change needed:', t.id);
    }
  }

  console.log(`Done. Updated ${updated} templates.`);
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
