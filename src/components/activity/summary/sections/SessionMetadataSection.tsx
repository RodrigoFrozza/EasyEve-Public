'use client'

import { useMemo } from 'react'
import {
  ActivityEnhanced,
  isRattingActivity,
  isMiningActivity,
  isAbyssalActivity,
  isExplorationActivity,
  isSalvagingActivity,
} from '@/types/domain'
import {
  ExpandableSection,
  SESSION_SECTION_LABEL,
  SESSION_SECTION_VALUE,
} from '../shared/ExpandableSection'
import {
  Info,
  MapPin,
  Clock,
  Fingerprint,
  Activity as ActivityIcon,
  Target,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { formatSessionDuration } from '@/lib/activities/session-kpis'
import { getRattingNpcFaction, getSalvagingNpcFaction } from '@/lib/constants/activity-data'
import { analyticsMetricTile } from '@/lib/activity/activity-analytics-surface'
import { formatSpaceLabel } from '@/lib/activity/activity-theme'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'

interface SessionMetadataSectionProps {
  activity: ActivityEnhanced
  theme?: ActivityThemeClasses
}

interface MetaItem {
  label: string
  value: string
  icon: React.ReactNode
}

export function SessionMetadataSection({
  activity,
  theme,
}: SessionMetadataSectionProps) {
  const { t } = useTranslations()
  const start = new Date(activity.startTime)
  const end = activity.endTime ? new Date(activity.endTime) : null
  const data = activity.data || {}

  const metaItems = useMemo(() => {
    const items: MetaItem[] = [
      {
        label: t('common.session.start'),
        value: start.toLocaleString(),
        icon: <Clock className="h-3.5 w-3.5" />,
      },
      {
        label: t('common.session.end'),
        value: end
          ? end.toLocaleString()
          : t('common.session.inProgress'),
        icon: <Clock className="h-3.5 w-3.5" />,
      },
      {
        label: t('common.session.duration'),
        value: formatSessionDuration(activity),
        icon: <ActivityIcon className="h-3.5 w-3.5" />,
      },
      {
        label: t('common.session.location'),
        value:
          (data.system as string) ||
          (data.siteName as string) ||
          t('common.session.unknownSpace'),
        icon: <MapPin className="h-3.5 w-3.5" />,
      },
      {
        label: t('common.session.activityType'),
        value: t(`activity.types.${activity.type}` as 'activity.types.ratting'),
        icon: <ActivityIcon className="h-3.5 w-3.5" />,
      },
      {
        label: t('common.session.operationId'),
        value: `${activity.id.substring(0, 12)}…`,
        icon: <Fingerprint className="h-3.5 w-3.5" />,
      },
    ]

    if (isRattingActivity(activity)) {
      const space = (activity as { space?: string }).space
      if (space) {
        items.splice(4, 0, {
          label: t('common.session.space'),
          value: formatSpaceLabel(space),
          icon: <Target className="h-3.5 w-3.5" />,
        })
      }
      const npcFaction = getRattingNpcFaction(activity) || (data.npcFaction as string)
      if (npcFaction) {
        items.splice(5, 0, {
          label: t('activity.ratting.npcFaction'),
          value: npcFaction,
          icon: <Layers className="h-3.5 w-3.5" />,
        })
      }
    }

    if (isSalvagingActivity(activity)) {
      const npcFaction = getSalvagingNpcFaction(activity)
      if (npcFaction) {
        items.splice(4, 0, {
          label: t('activity.salvaging.npcFaction'),
          value: npcFaction,
          icon: <Layers className="h-3.5 w-3.5" />,
        })
      }
      const space = (activity as { space?: string }).space
      if (space) {
        items.splice(5, 0, {
          label: t('common.session.space'),
          value: formatSpaceLabel(space),
          icon: <Target className="h-3.5 w-3.5" />,
        })
      }
    }

    if (isMiningActivity(activity) && data.miningType) {
      items.splice(4, 0, {
        label: t('common.session.miningCategory'),
        value: String(data.miningType),
        icon: <Layers className="h-3.5 w-3.5" />,
      })
    }

    if (isAbyssalActivity(activity)) {
      if (data.trackingMode) {
        items.splice(4, 0, {
          label: t('common.session.trackingMode'),
          value: String(data.trackingMode),
          icon: <ActivityIcon className="h-3.5 w-3.5" />,
        })
      }
      const runCount = (data.runs || []).filter(
        (r: { status?: string }) => r.status === 'completed'
      ).length
      items.splice(5, 0, {
        label: t('common.session.runCount'),
        value: String(runCount),
        icon: <Target className="h-3.5 w-3.5" />,
      })
    }

    if (isExplorationActivity(activity) && data.tier) {
      items.splice(4, 0, {
        label: 'Tier',
        value: String(data.tier),
        icon: <MapPin className="h-3.5 w-3.5" />,
      })
    }

    return items
  }, [activity, data, end, start, t])

  const locationSummary =
    (data.system as string) ||
    (data.siteName as string) ||
    t('common.session.unknownSpace')

  return (
    <ExpandableSection
      title={t('common.session.sessionMetadata')}
      icon={<Info className="h-4 w-4" />}
      variant="accent"
      accentClassName={theme?.headerIcon}
      borderClassName={theme ? cn(theme.panel, 'border') : undefined}
      summary={
        <p
          className={cn(
            'font-mono text-[10px] font-black uppercase tracking-[0.2em]',
            SESSION_SECTION_LABEL
          )}
        >
          {t(`activity.types.${activity.type}` as 'activity.types.ratting')} ·{' '}
          {locationSummary} · {formatSessionDuration(activity)}
        </p>
      }
    >
      <div className="grid grid-cols-1 gap-2 py-2 md:grid-cols-2">
        {metaItems.map((item, idx) => (
          <div
            key={idx}
            className={cn(
              'group flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors',
              theme ? analyticsMetricTile(theme) : 'border-white/12 bg-white/[0.04]',
              'hover:bg-white/[0.06]'
            )}
          >
            <div
              className={cn(
                'rounded-lg border border-white/10 bg-white/[0.04] p-2.5',
                theme?.headerIconBox
              )}
            >
              <span className={cn(theme?.headerIcon ?? 'text-zinc-400')}>
                {item.icon}
              </span>
            </div>
            <div className="flex flex-col font-mono">
              <span
                className={cn(
                  'text-[9px] font-bold uppercase tracking-[0.2em]',
                  SESSION_SECTION_LABEL
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  'max-w-[180px] truncate text-[11px] font-black uppercase tracking-wider',
                  SESSION_SECTION_VALUE
                )}
              >
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ExpandableSection>
  )
}
