'use client'

import { cn } from '@/lib/utils'

/**
 * Hub como chip colorido, para escanear "o que vai pra Jita vs C-J6 vs UALX" de
 * relance em vez de ler cada linha.
 *
 * A cor de uma estação é **derivada do id**, não configurada: assim ela é estável
 * entre sessões e entre telas (a mesma estação tem sempre a mesma cor), sem
 * inventar preferência nova para o jogador manter. Região e Jita têm cor fixa —
 * são as duas fontes públicas e o olho já as procura no mesmo lugar.
 *
 * Puramente visual: nada aqui entra no cálculo de preço, frete ou escolha de hub.
 */

const PUBLIC_STYLES: Record<string, string> = {
  region: 'bg-sky-500/15 text-sky-300',
  jita: 'bg-emerald-500/15 text-emerald-300',
  reference: 'bg-zinc-500/15 text-zinc-400',
  none: 'bg-zinc-800/60 text-zinc-500',
}

/** Paleta das estações. Cores distintas entre si e das duas fontes públicas. */
const STATION_PALETTE = [
  'bg-violet-500/15 text-violet-300',
  'bg-amber-500/15 text-amber-300',
  'bg-rose-500/15 text-rose-300',
  'bg-teal-500/15 text-teal-300',
  'bg-indigo-500/15 text-indigo-300',
  'bg-orange-500/15 text-orange-300',
]

/** Hash estável e barato — só precisa espalhar, não precisa ser criptográfico. */
function paletteIndex(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % STATION_PALETTE.length
}

export function hubChipStyle(origin: string, stationId?: string): string {
  if (origin === 'structure') {
    return STATION_PALETTE[paletteIndex(stationId ?? origin)]!
  }
  return PUBLIC_STYLES[origin] ?? PUBLIC_STYLES.none!
}

export function HubChip({
  origin,
  stationId,
  label,
  className,
}: {
  origin: string
  stationId?: string
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-block max-w-[10rem] truncate rounded px-1.5 py-px text-[10px] font-medium leading-tight',
        hubChipStyle(origin, stationId),
        className
      )}
      title={label}
    >
      {label}
    </span>
  )
}
