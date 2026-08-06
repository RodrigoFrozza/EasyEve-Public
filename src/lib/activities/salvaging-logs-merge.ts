export type SalvagingLogLike = {
  refId?: string | number
  type?: string
  date?: string
  value?: number
  [key: string]: unknown
}

export function mergeSalvagingLogs<T extends SalvagingLogLike>(
  serverLogs: T[],
  clientLogs: T[],
  deletedRefIds?: Iterable<string>,
): T[] {
  const clientRefIds = new Set(
    clientLogs
      .map((log) => (log.refId != null && log.refId !== '' ? String(log.refId) : null))
      .filter((id): id is string => Boolean(id)),
  )
  const deletedSet = new Set(deletedRefIds ?? [])

  const preserved = serverLogs.filter((log) => {
    const refId = log.refId != null && log.refId !== '' ? String(log.refId) : null
    if (!refId || deletedSet.has(refId)) return false
    return !clientRefIds.has(refId)
  })

  return [...preserved, ...clientLogs]
}
