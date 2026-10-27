export const TRACKABLE_TAG_ALIASES = {
  miner: ['miner'],
  ratter: ['ratter', 'ratting'],
} as const

export type TrackableTagKind = keyof typeof TRACKABLE_TAG_ALIASES

export const TRACKABLE_TAGS = [
  { tag: 'miner' as const, type: 'mining' as const },
  { tag: 'ratter' as const, type: 'ratting' as const },
] as const

export function hasTrackableTag(
  tags: string[] | null | undefined,
  kind: TrackableTagKind
): boolean {
  const normalized = (tags ?? []).map((t) => t.toLowerCase())
  return TRACKABLE_TAG_ALIASES[kind].some((alias) => normalized.includes(alias))
}
