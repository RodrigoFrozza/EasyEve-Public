export type ExplorationLogLike = {
  refId?: string | number
  type?: string
  date?: string
  amount?: number
  value?: number
  [key: string]: unknown
}

export function mergeExplorationLogs<T extends ExplorationLogLike>(
  serverLogs: T[],
  clientLogs: T[],
  deletedRefIds?: Iterable<string>
): T[] {
  const clientRefIds = new Set(
    clientLogs
      .map((log) => (log.refId != null && log.refId !== '' ? String(log.refId) : null))
      .filter((id): id is string => Boolean(id))
  )
  const deletedSet = new Set(deletedRefIds ?? [])

  const preserved = serverLogs.filter((log) => {
    const refId = log.refId != null && log.refId !== '' ? String(log.refId) : null
    if (!refId || deletedSet.has(refId)) return false
    return !clientRefIds.has(refId)
  })

  return [...preserved, ...clientLogs]
}
