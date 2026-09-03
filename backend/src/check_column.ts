import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`SHOW TABLES`;
    console.log('Tables:', result);
    
    const cols = await prisma.$queryRaw`SHOW COLUMNS FROM User`;
    console.log('User columns:', (cols as any[]).map((c:any) => c.Field));
  } catch (error) {
    console.error('Error querying columns:', error);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
