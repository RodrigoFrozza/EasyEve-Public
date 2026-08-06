import type { ExplorationLogLike } from '@/lib/activities/exploration-logs-merge'

const INCOME_LOG_TYPES = new Set(['site', 'loot'])

function logIncomeValue(log: ExplorationLogLike): number {
  return Number(log.amount) || Number(log.value) || 0
}

export function recalcExplorationLootTotalsFromLogs(logs: ExplorationLogLike[]): {
  totalLootValue: number
  currentCargoValue: number
} {
  const incomeLogs = logs.filter((log) => INCOME_LOG_TYPES.has(String(log.type)))
  const totalLootValue = incomeLogs.reduce((sum, log) => sum + logIncomeValue(log), 0)
  return {
    totalLootValue,
    currentCargoValue: totalLootValue,
  }
}

export function explorationLootDataChanged(
  previousData: Record<string, unknown> | null | undefined,
  nextData: Record<string, unknown>
): boolean {
  const fingerprint = (data: Record<string, unknown> | null | undefined) =>
    JSON.stringify({
      totalLootValue: data?.totalLootValue,
      currentCargoValue: data?.currentCargoValue,
      logs: ((data?.logs as ExplorationLogLike[]) || []).map((log) => ({
        refId: log.refId,
        type: log.type,
        value: log.value,
        amount: log.amount,
        date: log.date,
      })),
    })

  return fingerprint(previousData) !== fingerprint(nextData)
}
