export type AbyssalLootItemLike = {
  name: string
  quantity: number
  value?: number
  price?: number
  total?: number
  typeId?: number
  id?: number
}

export type AbyssalRunWithLootLike = {
  id?: string
  lootValue?: number
  lootItems?: AbyssalLootItemLike[]
  consumedItems?: AbyssalLootItemLike[]
}

export type AbyssalLootContentEntry = {
  name: string
  typeId: number
  quantity: number
  value: number
}

function itemGrossValue(item: AbyssalLootItemLike): number {
  return item.value ?? item.total ?? 0
}

export function buildAbyssalLootContents(runs: AbyssalRunWithLootLike[]): AbyssalLootContentEntry[] {
  const lootContentsMap = new Map<string, AbyssalLootContentEntry>()

  for (const run of runs) {
    for (const item of run.lootItems || []) {
      const typeId = item.typeId ?? item.id ?? 0
      const key = `${typeId}:${item.name}`
      const existing = lootContentsMap.get(key)
      const value = itemGrossValue(item)
      if (!existing) {
        lootContentsMap.set(key, {
          name: item.name,
          typeId,
          quantity: item.quantity,
          value,
        })
      } else {
        existing.quantity += item.quantity
        existing.value += value
      }
    }
  }

  return Array.from(lootContentsMap.values())
}

export function sumAbyssalRunsNetValue(runs: AbyssalRunWithLootLike[]): number {
  return runs.reduce((sum, run) => sum + (run.lootValue || 0), 0)
}

export function collectAbyssalItemNames(runs: AbyssalRunWithLootLike[]): string[] {
  const names = new Set<string>()
  for (const run of runs) {
    for (const item of [...(run.lootItems || []), ...(run.consumedItems || [])]) {
      if (item.name) names.add(item.name)
    }
  }
  return Array.from(names)
}

function repriceLootItem(
  item: AbyssalLootItemLike,
  prices: Record<string, number>,
): AbyssalLootItemLike {
  const price = prices[item.name?.toLowerCase()] ?? item.price ?? 0
  const total = price * item.quantity
  return { ...item, price, total, value: total }
}

export function repriceAbyssalRun(
  run: AbyssalRunWithLootLike,
  prices: Record<string, number>,
): AbyssalRunWithLootLike {
  const lootItems = (run.lootItems || []).map((item) => repriceLootItem(item, prices))
  const consumedItems = (run.consumedItems || []).map((item) => repriceLootItem(item, prices))
  const grossLoot = lootItems.reduce((sum, item) => sum + itemGrossValue(item), 0)
  const grossConsumed = consumedItems.reduce((sum, item) => sum + itemGrossValue(item), 0)

  return {
    ...run,
    lootItems,
    consumedItems,
    lootValue: grossLoot - grossConsumed,
  }
}

type AbyssalLogLike = {
  runId?: string
  amount?: number
  value?: number
  items?: AbyssalLootItemLike[]
  consumed?: AbyssalLootItemLike[]
  [key: string]: unknown
}

export function repriceAbyssalActivityRuns(
  runs: AbyssalRunWithLootLike[],
  logs: AbyssalLogLike[],
  prices: Record<string, number>,
): {
  runs: AbyssalRunWithLootLike[]
  logs: AbyssalLogLike[]
  totalLootValue: number
  lootContents: AbyssalLootContentEntry[]
} {
  const repricedRuns = runs.map((run) => repriceAbyssalRun(run, prices))
  const runById = new Map(repricedRuns.filter((r) => r.id).map((r) => [r.id!, r]))

  const repricedLogs = logs.map((log) => {
    if (!log.runId) return log
    const run = runById.get(log.runId)
    if (!run) return log
    return {
      ...log,
      amount: run.lootValue ?? 0,
      value: run.lootValue ?? 0,
      items: run.lootItems,
      consumed: run.consumedItems,
    }
  })

  const totalLootValue = sumAbyssalRunsNetValue(repricedRuns)
  const lootContents = buildAbyssalLootContents(repricedRuns)

  return { runs: repricedRuns, logs: repricedLogs, totalLootValue, lootContents }
}
