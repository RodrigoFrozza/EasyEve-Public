import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Fits Cleanup Script ---')
  console.log('Starting removal of all fit records...')
  
  try {
    const result = await prisma.fit.deleteMany({})
    console.log(`✅ Success! Removed ${result.count} fits from the database.`)
  } catch (error) {
    console.error('❌ Error clearing fits:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
