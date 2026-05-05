import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- SEARCHING MINING ACTIVITIES IN "DATA" JSON ---')
  const activities = await prisma.activity.findMany({
    where: {
      type: 'MINING'
    },
    select: {
      id: true,
      data: true,
      startTime: true
    }
  })

  let count = 0
  activities.forEach(a => {
    const data = a.data as any
    const totalVal = data?.totalEstimatedValue || 0
    if (totalVal > 1000000000) { // > 1B
        console.log(`Activity ID: ${a.id}`)
        console.log(`  Start Time: ${a.startTime}`)
        console.log(`  Total Value: ${totalVal.toLocaleString()} ISK`)
        if (data?.logs) {
            console.log(`  Logs count: ${data.logs.length}`)
            // Checking the first few logs to see if they match the Xenotime case
            const sample = data.logs.slice(0, 3)
            sample.forEach((l: any) => console.log(`    - ${l.oreName}: ${l.quantity} units (Val: ${l.estimatedValue?.toLocaleString()})`))
        }
        count++
    }
  })

  console.log(`\nTotal activities with suspicious valuation (>1B): ${count}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
