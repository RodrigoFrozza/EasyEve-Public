import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const factions = await prisma.shipStats.findMany({
    where: { factionName: { not: null } },
    distinct: ['factionName'],
    select: { factionName: true }
  })
  
  console.log('Distinct Faction Names in DB:')
  console.log(JSON.stringify(factions.map(f => f.factionName), null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
