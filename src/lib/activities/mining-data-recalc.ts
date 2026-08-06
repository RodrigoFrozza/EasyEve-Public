type MiningLogLike = {
  date?: string
  oreName?: string
  typeId?: number
  quantity?: number
  estimatedValue?: number
  value?: number
  regionId?: number
  regionName?: string
}

function miningLootFingerprint(data: Record<string, unknown> | null | undefined): string {
  const logs = ((data?.logs as MiningLogLike[]) || []).map((log) => ({
    date: log.date,
    oreName: log.oreName,
    typeId: log.typeId,
    quantity: log.quantity,
    estimatedValue: log.estimatedValue ?? log.value,
    regionId: log.regionId,
    regionName: log.regionName,
  }))

  return JSON.stringify({
    miningType: data?.miningType,
    logs,
  })
}

export function miningLootDataChanged(
  previousData: unknown,
  nextData: Record<string, unknown>
): boolean {
  return (
    miningLootFingerprint(previousData as Record<string, unknown>) !==
    miningLootFingerprint(nextData)
  )
}
