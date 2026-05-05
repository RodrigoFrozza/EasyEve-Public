import { prisma } from './src/lib/prisma';

async function main() {
  const typeCount = await prisma.eveType.count();
  const groupCount = await prisma.eveGroup.count();
  const categoryCount = await prisma.eveCategory.count();
  
  console.log('Counts:');
  console.log('Types:', typeCount);
  console.log('Groups:', groupCount);
  console.log('Categories:', categoryCount);
  
  const oreGroups = await prisma.eveGroup.findMany({
    where: { categoryId: 25 },
    select: { id: true, name: true }
  });
  console.log('Ore Groups (Cat 25):', JSON.stringify(oreGroups, null, 2));

  const sampleOres = await prisma.eveType.findMany({
    where: { group: { categoryId: 25 } },
    take: 5,
    select: { id: true, name: true }
  });
  console.log('Sample Ores:', JSON.stringify(sampleOres, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
