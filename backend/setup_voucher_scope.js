const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check if applicableScope column exists
  const cols = await prisma.$queryRawUnsafe('DESCRIBE Voucher');
  const hasScope = cols.some(c => c.Field === 'applicableScope');
  
  if (!hasScope) {
    console.log('Adding applicableScope to Voucher table...');
    await prisma.$queryRawUnsafe("ALTER TABLE Voucher ADD COLUMN applicableScope VARCHAR(50) NOT NULL DEFAULT 'ALL'");
    console.log('Successfully added applicableScope column to Voucher table!');
  } else {
    console.log('applicableScope column already exists in Voucher table.');
  }

  // Update a couple sample vouchers to POS and ONLINE so both scopes exist
  await prisma.$queryRawUnsafe("UPDATE Voucher SET applicableScope = 'POS' WHERE code IN ('disc10', 'VIPGOLD')");
  await prisma.$queryRawUnsafe("UPDATE Voucher SET applicableScope = 'ONLINE' WHERE code = 'FREESHIP'");
  await prisma.$queryRawUnsafe("UPDATE Voucher SET applicableScope = 'ALL' WHERE applicableScope NOT IN ('POS', 'ONLINE')");

  const vouchers = await prisma.$queryRawUnsafe("SELECT code, title, discountType, discountValue, applicableScope FROM Voucher LIMIT 10");
  console.log('Updated Vouchers sample:', vouchers);
}

main().then(() => prisma.$disconnect()).catch(console.error);
