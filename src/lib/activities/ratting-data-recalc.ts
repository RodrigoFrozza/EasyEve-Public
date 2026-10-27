import { getMarketAppraisal } from '@/lib/market'
import {
  recalcRattingLootTotals,
  type RattingLogEntry,
} from '@/lib/activities/ratting-manual-entries'

export function hasLegacyRattingLootStringShape(data: Record<string, unknown>): boolean {
  const mtu = data.mtuContents
  const salvage = data.salvageContents

  const hasLegacyMtu =
    Array.isArray(mtu) &&
    mtu.some(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        'loot' in (entry as Record<string, unknown>) &&
        typeof (entry as { loot?: unknown }).loot === 'string'
    )

  const hasLegacySalvage =
    Array.isArray(salvage) &&
    salvage.some(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        'loot' in (entry as Record<string, unknown>) &&
        typeof (entry as { loot?: unknown }).loot === 'string'
    )

  return hasLegacyMtu || hasLegacySalvage
}

export function recalcRattingWalletTotalsFromLogs(
  logs: RattingLogEntry[],
  additionalBounties = 0
): {
  automatedBounties: number
  automatedEss: number
  automatedTaxes: number
  grossBounties: number
  participantEarnings: Record<number, number>
  estimatedLootValue: number
  estimatedSalvageValue: number
} {
  let automatedBounties = 0
  let automatedEss = 0
  let automatedTaxes = 0
  const participantEarnings: Record<number, number> = {}

  for (const log of logs) {
    const amount = Number(log.amount) || 0
    if (log.type === 'bounty') {
      automatedBounties += amount
      if (log.charId) {
        participantEarnings[log.charId] = (participantEarnings[log.charId] || 0) + amount
      }
    } else if (log.type === 'ess') {
      automatedEss += amount
      if (log.charId) {
        participantEarnings[log.charId] = (participantEarnings[log.charId] || 0) + amount
      }
    } else if (log.type === 'tax') {
      automatedTaxes += Math.abs(amount)
    }
  }

  const lootTotals = recalcRattingLootTotals(logs)

  return {
    automatedBounties,
    automatedEss,
    automatedTaxes,
    grossBounties: automatedBounties + automatedEss + additionalBounties,
    participantEarnings,
    ...lootTotals,
  }
}

/** @deprecated Legacy string-blob MTU/salvage shape only. Do not extend — new write paths use appendMtuEntry/appendSalvageEntry. */
export async function applyLegacyRattingLootAppraisal(
  updatedData: Record<string, unknown>,
  patchData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const allLootLines: {
    name: string
    quantity: number
    category: 'mtu' | 'salvage'
    mtuIndex?: number
  }[] = []
  const mtuItems: { [index: number]: { name: string; quantity: number }[] } = {}

  if (patchData.mtuContents && Array.isArray(patchData.mtuContents)) {
    patchData.mtuContents.forEach((mtu: { loot?: string }, mtuIdx: number) => {
      const items: Array<{ name: string; quantity: number }> = []
      const lootLines = (mtu.loot || '').split('\n')
      lootLines.forEach((line: string) => {
        const parts = line.split('\t')
        const name = parts[0]?.trim()
        const quantity = parseInt(parts[1]?.replace(/,/g, '') || '1', 10)
        if (name && name.length > 1 && !Number.isNaN(quantity)) {
          allLootLines.push({ name, quantity, category: 'mtu', mtuIndex: mtuIdx })
          items.push({ name, quantity })
        }
      })
      mtuItems[mtuIdx] = items
    })
  }

  const salvageItems: { name: string; quantity: number }[] = []
  if (patchData.salvageContents && Array.isArray(patchData.salvageContents)) {
    patchData.salvageContents.forEach((salvage: { loot?: string }) => {
      ;(salvage.loot || '').split('\n').forEach((line: string) => {
        const parts = line.split('\t')
        const name = parts[0]?.trim()
        const quantity = parseInt(parts[1]?.replace(/,/g, '') || '1', 10)
        if (name && name.length > 1 && !Number.isNaN(quantity)) {
          allLootLines.push({ name, quantity, category: 'salvage' })
          salvageItems.push({ name, quantity })
        }
      })
    })
  }

  if (allLootLines.length === 0) {
    return {
      ...updatedData,
      estimatedLootValue: 0,
      estimatedSalvageValue: 0,
      mtuValues: [],
      lootAppraisedAt: new Date().toISOString(),
      totalItemCount: 0,
      lastDataAt: new Date().toISOString(),
    }
  }

  const uniqueNames = Array.from(new Set(allLootLines.map((line) => line.name)))
  const prices = await getMarketAppraisal(uniqueNames)

  let mtuTotal = 0
  let salvageTotal = 0
  const mtuValues: number[] = []

  if (patchData.mtuContents && Array.isArray(patchData.mtuContents)) {
    patchData.mtuContents.forEach((_: unknown, mtuIdx: number) => {
      let mtuValue = 0
      const items = mtuItems[mtuIdx] || []
      items.forEach((item) => {
        const price = prices[item.name.toLowerCase()] || 0
        mtuValue += price * item.quantity
      })
      mtuValues.push(mtuValue)
      mtuTotal += mtuValue
    })
  }

  salvageItems.forEach((item) => {
    const price = prices[item.name.toLowerCase()] || 0
    salvageTotal += price * item.quantity
  })

  return {
    ...updatedData,
    estimatedLootValue: mtuTotal,
    estimatedSalvageValue: salvageTotal,
    mtuValues,
    lootAppraisedAt: new Date().toISOString(),
    totalItemCount: allLootLines.length,
    lastDataAt: new Date().toISOString(),
  }
}

/** @deprecated Only reachable for legacy string-blob mtuContents/salvageContents. New write paths (appendMtuEntry/appendSalvageEntry) don't need this — they already write logs in the canonical shape. */
export async function applyRattingLootPatch(
  updatedData: Record<string, unknown>,
  patchData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!patchData.mtuContents && !patchData.salvageContents) {
    return updatedData
  }

  if (!hasLegacyRattingLootStringShape(patchData)) {
    const logs = (updatedData.logs as RattingLogEntry[]) || []
    const additionalBounties = Number(updatedData.additionalBounties) || 0
    return {
      ...updatedData,
      ...recalcRattingWalletTotalsFromLogs(logs, additionalBounties),
      lastDataAt: new Date().toISOString(),
    }
  }

  return applyLegacyRattingLootAppraisal(updatedData, patchData)
}

export function rattingLootFingerprint(data: Record<string, unknown> | null | undefined): string {
  const logs = ((data?.logs as Array<Record<string, unknown>>) || [])
    .filter((log) => ['loot', 'mtu', 'salvage', 'loot-auto', 'bounty', 'ess'].includes(String(log.type)))
    .map((log) => ({
      refId: log.refId,
      type: log.type,
      amount: log.amount,
      date: log.date,
    }))

  return JSON.stringify({
    logs,
    estimatedLootValue: data?.estimatedLootValue,
    estimatedSalvageValue: data?.estimatedSalvageValue,
    automatedBounties: data?.automatedBounties,
    automatedEss: data?.automatedEss,
    additionalBounties: data?.additionalBounties,
  })
}

export function rattingLootDataChanged(
  previousData: unknown,
  nextData: Record<string, unknown>
): boolean {
  return (
    rattingLootFingerprint(previousData as Record<string, unknown>) !==
    rattingLootFingerprint(nextData)
  )
}
