import { CHARACTER_STALE_THRESHOLD_MS } from '@/lib/characters/constants'
import { cn } from '@/lib/utils'

export type CharacterAccentInput = {
  isMain?: boolean
  tokenExpiresAt?: Date | string | null
  lastFetchedAt?: Date | string | null
}

function isStale(lastFetchedAt: Date | string | null | undefined): boolean {
  if (!lastFetchedAt) return true
  return Date.now() - new Date(lastFetchedAt).getTime() > CHARACTER_STALE_THRESHOLD_MS
}

const INVALID_TOKEN_THRESHOLD_MS = 1_000_000_000_000

function isTokenInvalid(tokenExpiresAt: Date | string | null | undefined): boolean {
  if (!tokenExpiresAt) return false
  const ms = new Date(tokenExpiresAt).getTime()
  return ms <= 0 || ms < INVALID_TOKEN_THRESHOLD_MS
}

export function getCharacterAccentClass(char: CharacterAccentInput): string {
  if (isTokenInvalid(char.tokenExpiresAt)) {
    return 'border-l-2 border-l-red-500/60'
  }
  if (char.isMain) {
    return 'border-l-2 border-l-eve-accent'
  }
  if (isStale(char.lastFetchedAt)) {
    return 'border-l-2 border-l-amber-500/40'
  }
  return 'border-l-2 border-l-transparent'
}

export function getCharacterPortraitRingClass(char: CharacterAccentInput): string {
  if (isTokenInvalid(char.tokenExpiresAt)) {
    return 'ring-2 ring-red-500/50'
  }
  if (char.isMain) {
    return 'ring-2 ring-eve-accent/80'
  }
  return 'ring-1 ring-white/10'
}

export function characterIsStale(char: CharacterAccentInput): boolean {
  return isStale(char.lastFetchedAt)
}

export function characterTokenInvalid(char: CharacterAccentInput): boolean {
  return isTokenInvalid(char.tokenExpiresAt)
}

export function getCharacterShellHoverClass(): string {
  return cn(
    'transition-all duration-300',
    'hover:border-zinc-600/80 hover:shadow-lg hover:shadow-black/20',
    'motion-safe:hover:-translate-y-0.5'
  )
}
