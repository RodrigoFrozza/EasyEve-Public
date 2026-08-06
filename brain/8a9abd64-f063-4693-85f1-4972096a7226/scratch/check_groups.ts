
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const groups = await prisma.eveGroup.findMany({
    where: { categoryId: 25 },
    select: { id: true, name: true }
  })
  console.log('Category 25 Groups:', groups)
}

main().catch(console.error).finally(() => prisma.$disconnect())
