import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const types = await prisma.eveType.findMany({
      where: {
        OR: [
          { name: { contains: 'Fullerite', mode: 'insensitive' } },
          { name: { contains: 'Cytoserocin', mode: 'insensitive' } },
          { name: { contains: 'Mykoserocin', mode: 'insensitive' } }
        ]
      },
      include: {
        group: {
          include: { category: true }
        }
      },
      take: 20
    })
    console.log('Found types:', JSON.stringify(types.map(t => ({
      id: t.id,
      name: t.name,
      groupId: t.groupId,
      groupName: t.group?.name,
      categoryId: t.group?.categoryId,
      categoryName: t.group?.category?.name
    })), null, 2))
  } catch (error) {
    console.error('Error querying EveType:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
