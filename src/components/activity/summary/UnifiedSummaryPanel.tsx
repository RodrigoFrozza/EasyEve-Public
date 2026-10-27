'use client'

import { useMemo } from 'react'
import { ActivityEnhanced } from '@/types/domain'
import { HeroKpiStrip } from './sections/HeroKpiStrip'
import { FinancialBreakdownSection } from './sections/FinancialBreakdownSection'
import { EarningsTimelineSection } from './sections/EarningsTimelineSection'
import { LootManifestSection } from './sections/LootManifestSection'
import { RunHistorySection } from './sections/RunHistorySection'
import { PersonnelSection } from './sections/PersonnelSection'
import { SessionMetadataSection } from './sections/SessionMetadataSection'
import { SessionLootIntelSection } from './sections/SessionLootIntelSection'
import {
  sessionHasLootManifest,
  sessionHasTimelineLogs,
} from '@/lib/activities/session-kpis'
import {
  getActivityTheme,
  type ActivityThemeClasses,
} from '@/lib/activity/activity-theme'
import { isAbyssalActivity } from '@/types/domain'

interface UnifiedSummaryPanelProps {
  activity: ActivityEnhanced
  theme?: ActivityThemeClasses
  onOpenMTU?: () => void
}

export function UnifiedSummaryPanel({
  activity,
  theme: themeProp,
  onOpenMTU,
}: UnifiedSummaryPanelProps) {
  const theme = themeProp ?? getActivityTheme(activity.type)

  const showTimeline = useMemo(() => sessionHasTimelineLogs(activity), [activity])
  const showLoot = useMemo(() => sessionHasLootManifest(activity), [activity])
  const showRuns =
    isAbyssalActivity(activity) && (activity.data.runs?.length ?? 0) > 0
  const showPersonnel = (activity.participants?.length ?? 0) > 0

  return (
    <div className="flex flex-col space-y-6 transition-none">
      <HeroKpiStrip activity={activity} theme={theme} />

      {activity.status === 'completed' && (
        <SessionLootIntelSection activity={activity} theme={theme} />
      )}

      <div className="flex-1 space-y-4 pb-2">
        <FinancialBreakdownSection
          activity={activity}
          theme={theme}
          onOpenMTU={onOpenMTU}
        />

        {showTimeline && (
          <EarningsTimelineSection activity={activity} theme={theme} />
        )}

        {showLoot && <LootManifestSection activity={activity} theme={theme} />}

        {showRuns && <RunHistorySection activity={activity} theme={theme} />}

        {showPersonnel && (
          <PersonnelSection activity={activity} theme={theme} />
        )}

        <SessionMetadataSection activity={activity} theme={theme} />
      </div>
    </div>
  )
}
