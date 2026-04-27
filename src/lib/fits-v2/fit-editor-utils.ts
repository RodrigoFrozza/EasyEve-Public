import type { Module } from '@/types/fit'
import type { FitsV2Response } from '@/lib/fits-v2/types-v2'

export function firstFreeSlotIndex(
  slotType: 'high' | 'med' | 'low' | 'rig' | 'subsystem',
  max: number,
  mods: Module[]
): number {
  const used = new Set(mods.filter((m) => m.slot === slotType).map((m) => m.slotIndex ?? 0))
  for (let i = 0; i < max; i++) {
    if (!used.has(i)) return i
  }
  return Math.max(0, max - 1)
}

export function formatV2Errors(data: FitsV2Response, fallback: string): string {
  const slotMsgs = Object.values(data.slotErrors || {}).flat()
  return [...(data.errors || []), ...slotMsgs].filter(Boolean).join('; ') || fallback
}
