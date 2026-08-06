import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const count = await prisma.eveType.count()
  console.log(`TOTAL_ITEMS_IN_DB: ${count}`)
  process.exit(0)
}

main()
