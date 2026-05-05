import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const types = await prisma.eveType.findMany({
    where: {
      name: { contains: 'Booster' },
      published: true
    },
    include: {
      group: {
        include: {
          category: true
        }
      }
    },
    take: 20
  })

  console.log(JSON.stringify(types, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
