
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.eveType.count();
    console.log('EveType count:', count);
    
    if (count > 0) {
      const sample = await prisma.eveType.findFirst({
        where: { name: { contains: 'Veldspar' } }
      });
      console.log('Sample Veldspar:', sample);

      const groups = await prisma.eveGroup.findMany({
        take: 5
      });
      console.log('Sample groups:', groups);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
