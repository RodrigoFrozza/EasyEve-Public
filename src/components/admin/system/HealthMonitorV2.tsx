'use client'

import { useAdminHealth } from '@/lib/admin/hooks/useAdminHealth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Activity, Cpu, MemoryStick, Clock } from 'lucide-react'

export function HealthMonitorV2() {
  const { data: health, isLoading } = useAdminHealth()

  if (isLoading || !health) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-32 bg-eve-panel/60 animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  const cpuUsage = health.cpu.usage || 0
  const memPct = health.memory.percentage || 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-eve-panel/60 border-eve-border/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-eve-text/60">CPU Usage</CardTitle>
          <Cpu className="h-4 w-4 text-eve-text/40" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-eve-text">{cpuUsage.toFixed(1)}%</div>
          <Progress value={cpuUsage} className="mt-2" />
          <p className="text-xs text-eve-text/40 mt-2">{health.cpu.cores} cores</p>
        </CardContent>
      </Card>

      <Card className="bg-eve-panel/60 border-eve-border/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-eve-text/60">Memory</CardTitle>
          <MemoryStick className="h-4 w-4 text-eve-text/40" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-eve-text">
            {((health.memory.used / 1024 / 1024 / 1024)).toFixed(1)} GB
          </div>
          <Progress value={memPct} className="mt-2" />
          <p className="text-xs text-eve-text/40 mt-2">
            of {(health.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB
          </p>
        </CardContent>
      </Card>

      <Card className="bg-eve-panel/60 border-eve-border/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-eve-text/60">Uptime</CardTitle>
          <Clock className="h-4 w-4 text-eve-text/40" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-eve-text">
            {Math.floor(health.uptime / 3600)}h
          </div>
          <p className="text-xs text-eve-text/40 mt-2">
            {Math.floor((health.uptime % 3600) / 60)}m running
          </p>
        </CardContent>
      </Card>

      <Card className="bg-eve-panel/60 border-eve-border/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-eve-text/60">Status</CardTitle>
          <Activity className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-400">Online</div>
          <p className="text-xs text-eve-text/40 mt-2">
            Last check: {new Date(health.timestamp).toLocaleTimeString()}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
