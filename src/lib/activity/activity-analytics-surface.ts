import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import { cn } from '@/lib/utils'

function themeBorderClasses(panelClass: string): string {
  return panelClass.split(/\s+/).filter((c) => c.startsWith('border')).join(' ')
}

/** Elevated glass panels for the analytics modal (lighter than tracker cards). */
export function analyticsPanelSurface(theme: ActivityThemeClasses): string {
  return cn(
    'rounded-xl border p-4 backdrop-blur-md',
    'bg-gradient-to-br from-zinc-800/55 via-zinc-800/35 to-zinc-900/25',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
    themeBorderClasses(theme.panel) || 'border-white/15'
  )
}

export function analyticsMetricTile(theme: ActivityThemeClasses): string {
  return cn(
    theme.metricShell,
    'bg-white/[0.08] hover:bg-white/[0.11] transition-colors',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
  )
}

export function analyticsChartWell(): string {
  return 'relative w-full rounded-lg border border-white/18 bg-zinc-950/40'
}

export function analyticsCompositionTrack(): string {
  return 'h-2 overflow-hidden rounded-full border border-white/14 bg-zinc-950/50'
}
