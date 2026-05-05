import { prisma } from './src/lib/prisma';

async function main() {
  const categories = await prisma.eveCategory.findMany({
    take: 50
  });
  console.log('Categories:', JSON.stringify(categories, null, 2));
  
  const asteroidCat = await prisma.eveCategory.findFirst({
    where: { name: { contains: 'Asteroid', mode: 'insensitive' } }
  });
  console.log('Asteroid Category:', JSON.stringify(asteroidCat, null, 2));
  
  if (asteroidCat) {
    const groups = await prisma.eveGroup.findMany({
      where: { categoryId: asteroidCat.id },
      take: 20
    });
    console.log('Groups in Asteroid Category:', JSON.stringify(groups, null, 2));
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
