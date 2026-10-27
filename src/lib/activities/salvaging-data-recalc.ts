import type { SalvagingLogLike } from '@/lib/activities/salvaging-logs-merge'

const INCOME_LOG_TYPES = new Set(['salvage', 'loot-auto'])

export function isSalvagingIncomeLog(log: SalvagingLogLike): boolean {
  return INCOME_LOG_TYPES.has(String(log.type))
}

function logIncomeValue(log: SalvagingLogLike): number {
  return Number(log.value) || 0
}

export function recalcSalvagingLootTotalsFromLogs(logs: SalvagingLogLike[]): {
  totalLootValue: number
  batchesCompleted: number
  totalItems: number
  currentCargoValue: number
} {
  const incomeLogs = logs.filter(isSalvagingIncomeLog)
  const totalLootValue = incomeLogs.reduce((sum, log) => sum + logIncomeValue(log), 0)
  const totalItems = incomeLogs.reduce((sum, log) => {
    const items = (log.items as Array<{ quantity?: number }> | undefined) || []
    return sum + items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0)
  }, 0)

  return {
    totalLootValue,
    batchesCompleted: incomeLogs.length,
    totalItems,
    currentCargoValue: totalLootValue,
  }
}

export function salvagingLootDataChanged(
  previousData: Record<string, unknown> | null | undefined,
  nextData: Record<string, unknown>,
): boolean {
  const fingerprint = (data: Record<string, unknown> | null | undefined) =>
    JSON.stringify({
      totalLootValue: data?.totalLootValue,
      batchesCompleted: data?.batchesCompleted,
      totalItems: data?.totalItems,
      logs: ((data?.logs as SalvagingLogLike[]) || []).map((log) => ({
        refId: log.refId,
        type: log.type,
        value: log.value,
        date: log.date,
      })),
    })

  return fingerprint(previousData) !== fingerprint(nextData)
}
