export interface AbyssalRunRecord {
  id: string
  [key: string]: unknown
}

/** Preserve server-only runs when the client PATCH sends a partial runs array. */
export function mergeAbyssalRuns<T extends AbyssalRunRecord>(
  serverRuns: T[],
  clientRuns: T[],
  deletedIds?: Iterable<string>
): T[] {
  const clientIds = new Set(clientRuns.map((run) => run.id))
  const deletedSet = new Set(deletedIds ?? [])
  const preserved = serverRuns.filter((run) => !deletedSet.has(run.id) && !clientIds.has(run.id))
  return [...preserved, ...clientRuns]
}
