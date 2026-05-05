import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Script {
  id: string
  name: string
  description: string
  category: string
  dangerLevel: string
  deprecated: boolean
  deprecatedReason?: string | null
  paramsSchema: Array<{
    key: string
    label: string
    type: string
    required?: boolean
    defaultValue?: unknown
    placeholder?: string
    description?: string
  }>
  supportsDryRun: boolean
  executionPolicy: string
  lastSync: string | null
  lastRunAt: string | null
  lastExecutionStatus: string | null
  status: 'idle' | 'running' | 'completed' | 'failed'
  schedule: string | null
}

export interface ScriptExecution {
  id: string
  scriptId: string
  scheduleId?: string | null
  status: string
  params: unknown
  dryRun: boolean
  logs: Array<{ level: string; message: string; timestamp: string }>
  progress: { processed?: number; total?: number }
  error: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt?: string
}

export function useAdminScripts() {
  return useQuery<Script[]>({
    queryKey: ['admin', 'scripts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/scripts')
      if (!res.ok) throw new Error('Failed to fetch scripts')
      const data = await res.json()
      return data.scripts || []
    },
    refetchInterval: 10 * 1000,
    staleTime: 8 * 1000,
  })
}

export function useScriptExecutions(limit = 10) {
  return useQuery<ScriptExecution[]>({
    queryKey: ['admin', 'script-executions', limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/scripts/execute?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch executions')
      const data = await res.json()
      return data.executions || []
    },
    staleTime: 5 * 1000,
  })
}

export function useScriptExecution(executionId: string | null) {
  return useQuery<ScriptExecution | null>({
    queryKey: ['admin', 'script-execution', executionId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/scripts/execute?executionId=${executionId}`)
      if (!res.ok) throw new Error('Failed to fetch execution')
      const data = await res.json()
      return data.execution || null
    },
    enabled: !!executionId,
    refetchInterval: (query) => {
      const data = query.state.data as ScriptExecution | null | undefined
      return data?.status === 'running' || data?.status === 'pending' ? 2000 : false
    },
    staleTime: 1 * 1000,
  })
}

export function useExecuteScript() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      scriptId,
      params = {},
      dryRun = false,
    }: {
      scriptId: string
      params?: Record<string, unknown>
      dryRun?: boolean
    }) => {
      const res = await fetch(
        `/api/admin/scripts/execute?scriptId=${encodeURIComponent(scriptId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params, dryRun }),
        }
      )
      if (!res.ok) throw new Error('Failed to execute script')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scripts'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'script-executions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'script-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler-health'] })
    },
  })
}

export function useCancelScript() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (executionId: string) => {
      const res = await fetch('/api/admin/scripts/execute', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, action: 'cancel' }),
      })
      if (!res.ok) throw new Error('Failed to cancel script')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scripts'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'script-executions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'script-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler-health'] })
    },
  })
}

export interface ScriptSchedule {
  id: string
  scriptId: string
  name: string
  interval: string
  cron: string | null
  params: unknown
  dryRun: boolean
  active: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  createdAt: string
}

export interface ScheduleLastExecution {
  id: string
  status: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  error: string | null
  progress: unknown
}

export interface ScheduleStats {
  runs24h: number
  failures24h: number
  avgDurationMs: number | null
}

export interface EnrichedScriptSchedule extends ScriptSchedule {
  scriptName: string
  scriptCategory: string
  dangerLevel: string
  lastExecution: ScheduleLastExecution | null
  stats: ScheduleStats
  overdue: boolean
}

export interface SchedulerHealthDto {
  lastTickAt: string | null
  lastSource: string | null
  ticksLast24h: number
  lastDueCount: number | null
  overdueSchedules: number
  status: 'healthy' | 'stale' | 'never'
}

export interface ScriptSchedulesQueryData {
  schedules: EnrichedScriptSchedule[]
  meta: { health: SchedulerHealthDto }
}

export function useScriptSchedules(options?: { refetchInterval?: number | false }) {
  return useQuery<ScriptSchedulesQueryData>({
    queryKey: ['admin', 'script-schedules'],
    queryFn: async () => {
      const res = await fetch('/api/admin/scripts/schedules')
      if (!res.ok) throw new Error('Failed to fetch schedules')
      const data = await res.json()
      return {
        schedules: (data.schedules || []) as EnrichedScriptSchedule[],
        meta: {
          health: (data.meta?.health || {
            lastTickAt: null,
            lastSource: null,
            ticksLast24h: 0,
            lastDueCount: null,
            overdueSchedules: 0,
            status: 'never',
          }) as SchedulerHealthDto,
        },
      }
    },
    staleTime: 10 * 1000,
    refetchInterval: options?.refetchInterval ?? 15_000,
  })
}

export function useSchedulerHealth() {
  return useQuery<SchedulerHealthDto>({
    queryKey: ['admin', 'scheduler-health'],
    queryFn: async () => {
      const res = await fetch('/api/admin/scripts/scheduler/health')
      if (!res.ok) throw new Error('Failed to fetch scheduler health')
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
}

export interface ScheduleExecutionRow {
  id: string
  scriptId: string
  scheduleId: string | null
  status: string
  params?: unknown
  dryRun: boolean
  error: string | null
  progress: unknown
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  logs?: Array<{ level: string; message: string; timestamp: string }>
}

export function useScheduleExecutions(
  scheduleId: string | null,
  opts?: { limit?: number; includeLogs?: boolean; enabled?: boolean; refetchInterval?: number | false }
) {
  const limit = opts?.limit ?? 20
  const includeLogs = opts?.includeLogs ?? false
  const enabled = opts?.enabled !== false && !!scheduleId

  return useQuery<ScheduleExecutionRow[]>({
    queryKey: ['admin', 'schedule-executions', scheduleId, limit, includeLogs],
    queryFn: async () => {
      const q = new URLSearchParams({
        limit: String(limit),
        includeLogs: String(includeLogs),
      })
      const res = await fetch(`/api/admin/scripts/schedules/${scheduleId}/executions?${q}`)
      if (!res.ok) throw new Error('Failed to fetch schedule executions')
      const data = await res.json()
      return data.executions || []
    },
    enabled,
    refetchInterval: opts?.refetchInterval ?? 5000,
    staleTime: 3_000,
  })
}

export function useRunScheduleNow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch(`/api/admin/scripts/schedules/${scheduleId}/run-now`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Failed to run schedule')
      }
      return res.json() as Promise<{ executionId: string; status: string }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'script-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'schedule-executions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'script-executions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scripts'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler-health'] })
    },
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      scriptId: string
      name: string
      interval: string
      cron?: string
      params?: unknown
      dryRun?: boolean
      active?: boolean
    }) => {
      const res = await fetch('/api/admin/scripts/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create schedule')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'script-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scripts'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler-health'] })
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch(`/api/admin/scripts/schedules/${scheduleId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete schedule')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'script-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scripts'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler-health'] })
    },
  })
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      scheduleId,
      ...data
    }: {
      scheduleId: string
      active?: boolean
      [key: string]: unknown
    }) => {
      const res = await fetch(`/api/admin/scripts/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update schedule')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'script-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scripts'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler-health'] })
    },
  })
}
