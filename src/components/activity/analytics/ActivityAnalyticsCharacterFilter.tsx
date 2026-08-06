'use client'

import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import type { CharacterBreakdownRow } from '@/lib/activity/activity-analytics'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

type Props = {
  theme: ActivityThemeClasses
  characters: CharacterBreakdownRow[]
  selectedId: string
  onSelect: (id: string) => void
}

export function ActivityAnalyticsCharacterFilter({
  theme,
  characters,
  selectedId,
  onSelect,
}: Props) {
  const { t } = useTranslations()

  if (characters.length <= 1) return null

  return (
    <div className={cn('flex flex-wrap gap-2 rounded-xl border p-2 backdrop-blur-sm', theme.metricShell)}>
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={cn(
          'rounded-lg px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors',
          selectedId === 'all' ? theme.chipActive : theme.chip
        )}
      >
        {t('activity.analytics.filterAllPilots')}
      </button>
      {characters.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors',
            selectedId === c.id ? theme.chipActive : theme.chip
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
