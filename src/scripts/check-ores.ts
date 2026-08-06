import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const ores = await prisma.eveType.findMany({
    where: {
      OR: [
        { name: { contains: 'Xenotime' } },
        { name: { contains: 'Ytterbite' } }
      ]
    }
  })
  console.log(JSON.stringify(ores, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
