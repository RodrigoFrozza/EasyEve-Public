import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

// Load .env manually for Windows/PowerShell compatibility
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const match = envContent.match(/DATABASE_URL=(.*)/)
  if (match) {
    process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, '')
  }
}

const prisma = new PrismaClient()

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false'
const MAX_SUSPICIOUS_VALUE = 1000000000 // 1B ISK

async function main() {
  console.log(`--- RECALCULATING MINING ACTIVITIES (DRY_RUN: ${DRY_RUN}) ---`)
  
  const activities = await prisma.activity.findMany({
    where: {
      type: 'MINING'
    }
  })

  console.log(`Found ${activities.length} mining activities.`)

  for (const activity of activities) {
    const data = activity.data as any
    if (!data || !data.logs || !data.totalEstimatedValue) continue

    // Only process if the value seems inflated or if it's forced
    if (data.totalEstimatedValue < MAX_SUSPICIOUS_VALUE && !process.env.FORCE_ALL) continue

    console.log(`\nProcessing Activity ${activity.id} (${activity.startTime})`)
    console.log(`  Original Value: ${data.totalEstimatedValue.toLocaleString()} ISK`)

    const newLogs = []
    let newTotalValue = 0
    const newOreBreakdown: any = JSON.parse(JSON.stringify(data.oreBreakdown || {}))
    const newParticipantBreakdown: any = JSON.parse(JSON.stringify(data.participantBreakdown || {}))
    
    // Resetting values for recalculation
    Object.keys(newOreBreakdown).forEach(k => newOreBreakdown[k].estimatedValue = 0)
    Object.keys(newParticipantBreakdown).forEach(k => newParticipantBreakdown[k].estimatedValue = 0)

    for (const log of data.logs) {
      const isIce = log.oreName.toLowerCase().includes('ice') || log.oreName.toLowerCase().includes('glacial')
      const ratio = isIce ? 1 : 100
      
      const oldVal = log.estimatedValue || 0
      const newVal = oldVal / ratio
      
      const updatedLog = { ...log, estimatedValue: newVal }
      newLogs.push(updatedLog)
      newTotalValue += newVal

      // Update Ore Breakdown
      const typeId = log.typeId
      if (typeId && newOreBreakdown[typeId]) {
        newOreBreakdown[typeId].estimatedValue += newVal
      }

      // Update Participant Breakdown
      const charId = log.characterId
      if (charId && newParticipantBreakdown[charId]) {
        newParticipantBreakdown[charId].estimatedValue += newVal
      }
    }

    const participantEarnings: any = {}
    Object.keys(newParticipantBreakdown).forEach(charId => {
      participantEarnings[charId] = newParticipantBreakdown[charId].estimatedValue
    })

    const updatedData = {
      ...data,
      logs: newLogs,
      totalEstimatedValue: newTotalValue,
      miningValue: newTotalValue,
      oreBreakdown: newOreBreakdown,
      participantBreakdown: newParticipantBreakdown,
      participantEarnings: participantEarnings,
      recalculatedAt: new Date().toISOString(),
      wasInflated: true
    }

    console.log(`  New Calculated Value: ${newTotalValue.toLocaleString()} ISK`)

    if (!DRY_RUN) {
      await prisma.activity.update({
        where: { id: activity.id },
        data: { data: updatedData }
      })
      console.log(`  ✅ Activity updated in the database.`)
    } else {
      console.log(`  [DRY RUN] No changes made to the database.`)
    }
  }

  console.log('\n--- END OF PROCESSING ---')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
