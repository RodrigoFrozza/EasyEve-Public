'use client'

import { ActivityEnhanced } from '@/types/domain'
import { HeroKpiStrip } from './sections/HeroKpiStrip'
import { FinancialBreakdownSection } from './sections/FinancialBreakdownSection'
import { EarningsTimelineSection } from './sections/EarningsTimelineSection'
import { LootManifestSection } from './sections/LootManifestSection'
import { RunHistorySection } from './sections/RunHistorySection'
import { PersonnelSection } from './sections/PersonnelSection'
import { SessionMetadataSection } from './sections/SessionMetadataSection'
import { ScrollArea } from '@/components/ui/scroll-area'

interface UnifiedSummaryPanelProps {
  activity: ActivityEnhanced
  onOpenMTU?: () => void
}

export function UnifiedSummaryPanel({ activity, onOpenMTU }: UnifiedSummaryPanelProps) {
  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. Hero KPIs - Always top, always visible */}
      <HeroKpiStrip activity={activity} />

      {/* 2. Scrollable Body with Expandable Sections */}
      <div className="flex-1 space-y-4 pb-8">
        <FinancialBreakdownSection activity={activity} onOpenMTU={onOpenMTU} />
        
        <EarningsTimelineSection activity={activity} />
        
        <LootManifestSection activity={activity} />
        
        <RunHistorySection activity={activity} />
        
        <PersonnelSection activity={activity} />
        
        <SessionMetadataSection activity={activity} />
      </div>
    </div>
  )
}
