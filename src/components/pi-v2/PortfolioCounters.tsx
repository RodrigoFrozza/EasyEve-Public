'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import type { PortfolioCounters as Counters } from '@/lib/pi-v2/urgency'
import type { ColonyBucket } from '@/lib/pi-v2/urgency'

/**
 * O contador honesto do topo.
 *
 * Cada número significa uma coisa só, e nenhum engloba outro:
 * **X parados · Y perdendo · Z degradados · W atenção · V reabastecer.**
 *
 * O antecessor colapsava tudo em "26 parados" — grande, vermelho e falso, o que
 * treinou o usuário a ignorar o número inteiro. Um contador só vale se, quando
 * ele diz 0 parados, não houver nada parado.
 */

const TONE: Record<string, string> = {
  stalled: 'border-red-500/40 bg-red-500/10 text-red-200',
  losing: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  degraded: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  attention: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-200',
  restockSoon: 'border-sky-500/30 bg-sky-500/5 text-sky-200',
  running: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
}

const BUCKET_BY_KEY: Record<string, ColonyBucket> = {
  stalled: 'stalled',
  losing: 'losing',
  degraded: 'degraded',
  attention: 'attention',
  restockSoon: 'restock_soon',
  running: 'running',
}

type CounterKey = keyof typeof BUCKET_BY_KEY

/** Ordem fixa: do mais grave ao normal. É a mesma ordem da lista abaixo. */
const ORDER: CounterKey[] = [
  'stalled',
  'losing',
  'degraded',
  'attention',
  'restockSoon',
  'running',
]

export function PortfolioCounters({
  counters,
  activeFilter,
  onFilterChange,
}: {
  counters: Counters
  activeFilter: ColonyBucket | null
  onFilterChange: (bucket: ColonyBucket | null) => void
}) {
  const { t } = useTranslations()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-zinc-400">
        {t('piV2.counters.total', { count: counters.total })}
      </span>
      {ORDER.map((key) => {
        const value = counters[key as keyof Counters] as number
        // Zero não vira chip: um "0 parados" apagado é ruído. A ausência já diz.
        if (value === 0) return null
        const bucket = BUCKET_BY_KEY[key]!
        const active = activeFilter === bucket
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(active ? null : bucket)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity',
              TONE[key],
              active ? 'ring-1 ring-current' : 'opacity-80 hover:opacity-100'
            )}
          >
            <span className="tabular-nums font-semibold">{value}</span>
            <span>{t(`piV2.bucket.${key}`)}</span>
          </button>
        )
      })}
    </div>
  )
}
