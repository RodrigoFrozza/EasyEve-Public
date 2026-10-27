import type { PiColonyAnalysis, PiPinView, PiRoutingView } from '@/lib/pi/types'
import { getPinStructureName } from '@/lib/pi/pi-static-data'
import { prisma } from '@/lib/prisma'

export function formatPinDisplayLabel(structureName: string, pinId: number): string {
  return `${structureName} (#${pinId})`
}

export function groupedPinDisplayLabel(pins: PiPinView[]): string {
  if (pins.length === 0) return ''
  if (pins.length === 1) return pins[0].label

  const sorted = [...pins].sort((a, b) => a.pinId - b.pinId)
  const name = sorted[0].structureName
  const first = sorted[0].pinId
  const last = sorted[sorted.length - 1].pinId

  if (first === last) return formatPinDisplayLabel(name, first)
  return `${name} (#${first}–${last})`
}

export async function resolvePinStructureNames(typeIds: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(typeIds.filter((id) => id > 0))]
  const map = new Map<number, string>()
  if (unique.length === 0) return map

  try {
    const rows = await prisma.eveType.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    })
    for (const row of rows) {
      map.set(row.id, row.name)
    }
  } catch {
    // DB unavailable — fall back to static names in enrichRoutingPinLabels
  }

  for (const typeId of unique) {
    if (!map.has(typeId)) {
      map.set(typeId, getPinStructureName(typeId))
    }
  }

  return map
}

export function enrichRoutingPinLabels(
  routing: PiRoutingView,
  structureNames: Map<number, string>
): void {
  for (const pin of routing.pins) {
    const name = structureNames.get(pin.typeId) ?? pin.structureName ?? getPinStructureName(pin.typeId)
    pin.structureName = name
    pin.label = formatPinDisplayLabel(name, pin.pinId)
  }
}

export function enrichColonyRoutingLabels(
  colony: PiColonyAnalysis,
  structureNames: Map<number, string>
): void {
  if (!colony.routing?.pins?.length) return
  enrichRoutingPinLabels(colony.routing, structureNames)
}
