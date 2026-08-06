export interface AbyssalRunLike {
  id?: string
  status?: string
  startTime?: string
  endTime?: string
  lootValue?: number
  registrationStatus?: string
}

export interface AbyssalSessionMetrics {
  completedRuns: AbyssalRunLike[]
  deathCount: number
  pendingCount: number
  totalFilaments: number
  totalIsk: number
  bestRunValue: number
  iskPerHour: number
}

const MIN_SESSION_HOURS = 0.01

export function isAbyssalRunCompleted(run: AbyssalRunLike): boolean {
  return run.status === 'completed' || run.status === 'success'
}

export function findTargetPendingRun<T extends AbyssalRunLike>(
  runs: T[],
  preferredRunId?: string | null
): T | undefined {
  if (preferredRunId) {
    const preferred = runs.find((run) => run.id === preferredRunId)
    if (preferred) return preferred
  }

  return runs
    .filter((run) => run.status === 'completed' && run.registrationStatus === 'pending')
    .sort(
      (a, b) =>
        new Date(b.endTime || b.startTime || 0).getTime() -
        new Date(a.endTime || a.startTime || 0).getTime()
    )[0]
}

export function getAbyssalSessionMetrics(
  runs: AbyssalRunLike[],
  sessionHours?: number
): AbyssalSessionMetrics {
  const completedRuns = runs.filter(isAbyssalRunCompleted)
  const deathCount = runs.filter((r) => r.status === 'death').length
  const pendingCount = completedRuns.filter((r) => r.registrationStatus === 'pending').length

  const totalFilaments = completedRuns.length
  const totalIsk = completedRuns.reduce((sum, run) => sum + (run.lootValue || 0), 0)
  const bestRunValue = completedRuns.reduce(
    (best, run) => Math.max(best, run.lootValue || 0),
    0
  )

  let iskPerHour = 0
  if (sessionHours !== undefined && sessionHours > 0) {
    iskPerHour = totalIsk / Math.max(MIN_SESSION_HOURS, sessionHours)
  } else {
    const totalDurationMs = completedRuns.reduce((sum, run) => {
      const start = run.startTime ? new Date(run.startTime).getTime() : 0
      const end = run.endTime
        ? new Date(run.endTime).getTime()
        : start + 20 * 60 * 1000
      return sum + Math.max(0, end - start)
    }, 0)
    iskPerHour =
      totalDurationMs > 0
        ? totalIsk / Math.max(MIN_SESSION_HOURS, totalDurationMs / 3_600_000)
        : 0
  }

  return {
    completedRuns,
    deathCount,
    pendingCount,
    totalFilaments,
    totalIsk,
    bestRunValue,
    iskPerHour,
  }
}
