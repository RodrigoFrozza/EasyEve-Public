'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import type { CharacterGroup as Group } from '@/lib/pi-v2/grouping'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import { ColonyCard } from './ColonyCard'

/**
 * Bloco de um personagem. O cabeçalho responde "vale a pena logar neste agora?"
 * antes de o jogador ler qualquer planeta: quantos precisam de ação e quantos
 * estão só no ritmo.
 */

/** Só o que exige ação aparece no resumo; balde zerado não vira texto. */
function useGroupSummary() {
  const { t } = useTranslations()
  return (group: Group): string => {
    const { counters } = group
    const parts: string[] = []
    if (counters.stalled > 0) parts.push(`${counters.stalled} ${t('piV2.bucket.stalled')}`)
    if (counters.losing > 0) parts.push(`${counters.losing} ${t('piV2.bucket.losing')}`)
    if (counters.degraded > 0) parts.push(`${counters.degraded} ${t('piV2.bucket.degraded')}`)
    if (counters.attention > 0) parts.push(`${counters.attention} ${t('piV2.bucket.attention')}`)
    if (counters.restockSoon > 0) {
      parts.push(`${counters.restockSoon} ${t('piV2.bucket.restockSoon')}`)
    }
    if (parts.length === 0) {
      return `${counters.running} ${t('piV2.bucket.running')}`
    }
    return parts.join(' · ')
  }
}

export function CharacterGroup({
  group,
  onSelectColony,
}: {
  group: Group
  onSelectColony: (colony: PortfolioColony) => void
}) {
  const { t } = useTranslations()
  const summary = useGroupSummary()

  // O ponto colorido do cabeçalho é o pior estado do bloco: dá para varrer a
  // coluna de personagens sem ler número nenhum.
  const worst = group.colonies[0]?.urgency.bucket ?? 'running'
  const dot =
    worst === 'stalled'
      ? 'bg-red-400'
      : worst === 'losing'
        ? 'bg-orange-400'
        : worst === 'degraded'
          ? 'bg-amber-400'
          : worst === 'attention'
            ? 'bg-yellow-400'
            : worst === 'restock_soon'
              ? 'bg-sky-400'
              : 'bg-emerald-400'

  return (
    <section className="space-y-2">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-zinc-800 pb-1.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />
        <h2 className="text-sm font-semibold text-zinc-200">{group.characterName}</h2>
        <span className="text-[11px] text-zinc-500">
          {t('piV2.group.colonies', { count: group.colonies.length })}
        </span>
        <span className="ml-auto text-[11px] text-zinc-400">{summary(group)}</span>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {group.colonies.map((colony) => (
          <ColonyCard
            key={`${colony.characterId}-${colony.planetId}`}
            colony={colony}
            onClick={() => onSelectColony(colony)}
          />
        ))}
      </div>
    </section>
  )
}
