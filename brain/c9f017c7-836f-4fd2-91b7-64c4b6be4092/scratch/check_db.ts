import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const count = await prisma.debugLog.count()
    console.log(`DebugLog count: ${count}`)
    const recent = await prisma.debugLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    })
    console.log('Recent logs:', JSON.stringify(recent, null, 2))
  } catch (error) {
    console.error('Error querying DebugLog:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
