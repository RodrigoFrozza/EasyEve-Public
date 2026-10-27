'use client'

import { cn } from '@/lib/utils'
import type { PiCommodityTier } from '@/lib/pi-v2/sde'

/**
 * Selo de tier (P0–P4), nas cores que o grafo de produção já usa.
 *
 * Serve para bater o olho e ver a composição da compra — "estou levando muito P3
 * caro" — sem ler número. É leitura pura: o tier vem do SDE
 * (`getCommodityTier`), nada aqui influencia cálculo.
 *
 * Chip discreto de propósito: com ícone + nome + tier + hub na mesma linha, o
 * risco é poluir. Fundo suave, texto curto, sem borda.
 */

const TIER_STYLES: Record<number, string> = {
  0: 'bg-zinc-500/15 text-zinc-400',
  1: 'bg-sky-500/15 text-sky-300',
  2: 'bg-emerald-500/15 text-emerald-300',
  3: 'bg-violet-500/15 text-violet-300',
  4: 'bg-pink-500/15 text-pink-300',
}

export function TierBadge({
  tier,
  className,
}: {
  tier: PiCommodityTier | undefined
  className?: string
}) {
  // Tier desconhecido não vira chip: melhor a ausência do que um rótulo chutado.
  if (tier == null) return null
  return (
    <span
      className={cn(
        'inline-block shrink-0 rounded px-1 py-px text-[9px] font-semibold leading-tight tabular-nums',
        TIER_STYLES[tier] ?? TIER_STYLES[0],
        className
      )}
    >
      P{tier}
    </span>
  )
}
