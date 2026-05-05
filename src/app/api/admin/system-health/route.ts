import { NextResponse } from 'next/server'
import os from 'os'
import { withAuth } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request: Request) => {
  try {
    const uptime = os.uptime()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const memUsage = (usedMem / totalMem) * 100

    const cpus = os.cpus()
    const loadAvg = os.loadavg() // [1, 5, 15] minute load averages

    // Calculate CPU usage percentage from load average for 1 min
    // os.loadavg() is only useful on Linux/Mac, on Windows it returns [0, 0, 0] usually
    // But for a VPS (likely Linux) it's perfect.
    const cpuUsage = (loadAvg[0] / cpus.length) * 100

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptime: {
        seconds: uptime,
        formatted: formatUptime(uptime)
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        percentage: memUsage.toFixed(2)
      },
      cpu: {
        model: cpus[0].model,
        cores: cpus.length,
        loadAvg,
        usage: Math.min(100, cpuUsage).toFixed(2)
      },
      process: {
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    })
  } catch (error) {
    console.error('System health check failed:', error)
    return NextResponse.json({ error: 'Failed to fetch system metrics' }, { status: 500 })
  }
}, { requiredRole: 'master' })

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)

  return parts.join(' ')
}
