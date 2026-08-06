'use client'

import { useMemo } from 'react'
import {
  ActivityEnhanced,
  isMiningActivity,
  isRattingActivity,
  isAbyssalActivity,
  isExplorationActivity,
} from '@/types/domain'
import {
  ExpandableSection,
  SESSION_SECTION_LABEL,
  SESSION_SECTION_VALUE,
} from '../shared/ExpandableSection'
import { Users, Ship } from 'lucide-react'
import { formatISK, cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { useTranslations } from '@/i18n/hooks'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'

interface PersonnelSectionProps {
  activity: ActivityEnhanced
  theme?: ActivityThemeClasses
}

function resolvePilotName(
  pilot: { characterName?: string; characterId?: number },
  t: (key: 'common.unknown') => string
): string {
  const name = pilot.characterName?.trim()
  if (name && name.toUpperCase() !== 'UNKNOWN') return name
  return t('common.unknown')
}

export function PersonnelSection({ activity, theme }: PersonnelSectionProps) {
  const { t } = useTranslations()
  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])
  const totalEarned = metrics.net

  const durationHours = useMemo(() => {
    const ms = getActivityDurationMs({
      startTime: activity.startTime,
      endTime: activity.endTime,
      status: activity.status,
      updatedAt: activity.updatedAt,
      accumulatedPausedTime: activity.accumulatedPausedTime,
      isPaused: activity.isPaused,
      pausedAt: activity.pausedAt,
    })
    return ms / 3600000
  }, [activity])

  const pilotStats = useMemo(() => {
    const participants = activity.participants ?? []
    const n = participants.length
    const equalShare = n > 0 ? totalEarned / n : 0

    return participants
      .map((pilot) => {
        let earned = 0
        const data = pilot as unknown as Record<string, unknown>

        if (isMiningActivity(activity)) {
          earned = Number(data.totalLootValue) || 0
        } else if (isRattingActivity(activity)) {
          const activityData = activity.data
          const charId = pilot.characterId
          if (charId != null && activityData.participantEarnings?.[charId] != null) {
            earned = Number(activityData.participantEarnings[charId]) || 0
          } else {
            earned = equalShare
          }
        } else if (isAbyssalActivity(activity) || isExplorationActivity(activity)) {
          earned = equalShare
        } else {
          earned = Number(data.totalLootValue) || equalShare
        }

        if (earned === 0 && totalEarned > 0 && n > 0) {
          earned = equalShare
        }

        const percentage = totalEarned > 0 ? (earned / totalEarned) * 100 : 0
        const displayName = resolvePilotName(pilot, t)

        return {
          ...pilot,
          displayName,
          earned,
          percentage,
          iskPerHour: durationHours > 0.001 ? earned / durationHours : 0,
          fitName:
            pilot.fitName ||
            pilot.fit ||
            t('common.unknown'),
          initial: displayName[0]?.toUpperCase() ?? '?',
        }
      })
      .sort((a, b) => b.earned - a.earned)
  }, [activity, totalEarned, durationHours, t])

  if (pilotStats.length === 0) return null

  const accent = theme?.revenuePositive ?? 'text-eve-accent'
  const barColor = theme?.accentBar ?? 'bg-eve-accent/50'

  return (
    <ExpandableSection
      title={t('common.session.personnelBreakdown')}
      icon={<Users className="h-4 w-4" />}
      variant="accent"
      accentClassName={theme?.headerIcon}
      borderClassName={theme ? cn(theme.panel, 'border') : undefined}
      summary={
        <p className={cn('font-mono text-[10px] font-black uppercase tracking-[0.2em]', SESSION_SECTION_LABEL)}>
          {pilotStats.length} {t('common.session.pilots').toUpperCase()} ·{' '}
          {t('common.session.share')}: {pilotStats[0]?.percentage.toFixed(0)}%
        </p>
      }
    >
      <p
        className={cn(
          'mb-3 font-mono text-[9px] font-black uppercase tracking-[0.2em]',
          SESSION_SECTION_LABEL
        )}
      >
        {t('common.session.fleetCitizens')}
      </p>
      <div className="grid grid-cols-1 gap-2 py-2 md:grid-cols-2">
        {pilotStats.map((pilot, idx) => (
          <div
            key={`${pilot.characterId}-${idx}`}
            className={cn(
              'group flex items-center gap-4 rounded-none border bg-black p-4 transition-none',
              theme?.historyRow ?? 'border-eve-border/20',
              'hover:border-eve-border/40'
            )}
          >
            <Avatar className="h-12 w-12 rounded-none border border-eve-border/20 shadow-none">
              <AvatarImage
                src={`https://images.evetech.net/characters/${pilot.characterId}/portrait?size=128`}
                className="rounded-none"
              />
              <AvatarFallback className="rounded-none bg-zinc-950 text-xs font-black">
                {pilot.initial}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    'truncate text-[11px] font-black uppercase tracking-wider',
                    SESSION_SECTION_VALUE
                  )}
                >
                  {pilot.displayName}
                </p>
                <span className={cn('font-mono text-[10px] font-black', accent)}>
                  {pilot.percentage.toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Ship className="h-3 w-3 text-zinc-700" />
                <span
                  className={cn(
                    'truncate font-mono text-[10px] font-bold uppercase tracking-[0.2em]',
                    SESSION_SECTION_LABEL
                  )}
                >
                  {pilot.fitName}
                </span>
              </div>

              <div className="h-1 w-full overflow-hidden rounded-none bg-zinc-900">
                <div
                  style={{ width: `${pilot.percentage}%` }}
                  className={cn('h-full', barColor)}
                />
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-[10px] font-bold tracking-tighter text-zinc-200">
                  {formatISK(pilot.earned)}
                </p>
                {pilot.iskPerHour > 0 && (
                  <p className="font-mono text-[9px] font-bold tracking-tighter text-zinc-500">
                    {formatISK(pilot.iskPerHour)}/h
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ExpandableSection>
  )
}
