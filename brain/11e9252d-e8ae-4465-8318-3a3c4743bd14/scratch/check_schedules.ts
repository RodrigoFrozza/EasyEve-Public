import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgres://postgres:wU0hW7GQ3mcm4EeL3IRuyz2GKAiFrD4QeYY53hzbc3kxKzW9TtO88syMpkeCmUYc@localhost:5432/postgres'
    }
  }
})

async function main() {
  console.log('--- Script Schedules ---')
  const schedules = await prisma.scriptSchedule.findMany()
  console.table(schedules.map(s => ({
    id: s.id,
    scriptId: s.scriptId,
    name: s.name,
    interval: s.interval,
    lastRunAt: s.lastRunAt,
    nextRunAt: s.nextRunAt,
    active: s.active
  })))

  console.log('\n--- Recent Executions (Last 10) ---')
  const executions = await prisma.scriptExecution.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  })
  console.table(executions.map(e => ({
    id: e.id,
    scriptId: e.scriptId,
    status: e.status,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    progress: JSON.stringify(e.progress)
  })))
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
