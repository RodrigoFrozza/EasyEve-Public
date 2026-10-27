import { prisma } from '../lib/prisma';

async function main() {
  console.log('--- Activating Fits Module ---');
  try {
    const result = await prisma.modulePrice.upsert({
      where: { module: 'fits' },
      update: { isActive: true },
      create: { 
        module: 'fits', 
        price: 0, 
        isActive: true 
      }
    });
    console.log('Success:', result);
  } catch (error) {
    console.error('Error activating fits module:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
