/**
 * Per-activity-type visual themes (mining cyan, ratting red, etc.).
 * Intentionally independent of the user's global accent (settings → Appearance).
 * Do not replace these classes with eve-accent / --eve-accent.
 */
import type { ActivityType } from '@/lib/constants/activity-colors'
import { getActivityColors } from '@/lib/constants/activity-colors'
import { cn } from '@/lib/utils'

/** Shared radius for activity cards and major surfaces */
export const ACTIVITY_SURFACE_RADIUS = 'rounded-2xl'
export const ACTIVITY_INNER_RADIUS = 'rounded-xl'

export interface ActivityThemeClasses {
  type: ActivityType
  accentBar: string
  card: string
  cardGlow: string
  /** Decorative blur orb (top-right) */
  cardOrb: string
  /** Full-card color wash */
  cardTint: string
  header: string
  /** Soft color wash behind the card header */
  headerWash: string
  headerIcon: string
  headerIconBox: string
  body: string
  footer: string
  text: string
  textMuted: string
  iconBg: string
  chip: string
  chipActive: string
  metricShell: string
  panel: string
  /** Inner gradient on log / feature panels */
  panelWash: string
  /** Header divider inside log / feature panels */
  panelDivider: string
  /** Dashed empty state inside log panels */
  logEmpty: string
  historyRow: string
  historyRowHover: string
  historyIconBox: string
  revenuePositive: string
  chevron: string
}

function glassCard(
  border: string,
  borderLeft: string,
  from: string,
  via: string,
  ring: string,
  shadow: string,
  orb: string,
  tint: string
): Pick<ActivityThemeClasses, 'card' | 'cardGlow' | 'cardOrb' | 'cardTint'> {
  // "Teal Aurora" op-card shell: one calm panel gradient + hairline border for every
  // activity, with a per-type accent bar on the left (borderLeft). The old saturated
  // glassmorphism (from/via/ring/shadow/orb/tint) is intentionally neutralized —
  // args are kept so the per-type theme table below still type-checks.
  void border; void from; void via; void ring; void shadow; void orb; void tint
  return {
    card: cn(
      ACTIVITY_SURFACE_RADIUS,
      'border border-l-[3px] border-white/[0.08] bg-[linear-gradient(160deg,#101a26,#0c141d)] shadow-[0_10px_30px_-14px_rgba(0,0,0,0.6)]',
      borderLeft
    ),
    cardGlow: '',
    cardOrb: '',
    cardTint: '',
  }
}

const GLASS_METRIC_SHELL =
  'rounded-[8px] border border-white/[0.06] bg-ta-inset p-3'

function themedMetricShell(border: string, bg: string): string {
  // Teal Aurora: neutral inset well for every activity (per-type tint dropped).
  void border; void bg
  return cn(
    'rounded-[8px] border border-white/[0.06] bg-ta-inset p-3 transition-colors'
  )
}

function glassPanel(borderTint: string, bgTint: string): string {
  // Teal Aurora: neutral inset panel for every activity.
  void borderTint; void bgTint
  return cn(
    'min-h-0 rounded-[10px] border border-white/[0.06] bg-ta-inset p-3 sm:p-4'
  )
}

function panelDivider(borderTint: string): string {
  return cn('mb-3 flex items-center justify-between gap-2 border-b pb-2.5', borderTint)
}

const THEME_BY_TYPE: Record<ActivityType, ActivityThemeClasses> = {
  mining: {
    type: 'mining',
    ...glassCard(
      'border-cyan-300/55',
      'border-l-cyan-200',
      'from-cyan-300/[0.42]',
      'via-sky-300/28',
      'ring-cyan-300/45 group-hover/card:ring-cyan-200/60',
      'shadow-[0_20px_60px_-18px_rgba(103,232,249,0.6)]',
      'bg-cyan-300/55',
      'from-cyan-300/[0.22] via-sky-200/[0.1] to-transparent'
    ),
    accentBar: 'bg-cyan-200',
    header:
      'relative overflow-hidden border-b border-cyan-300/25 bg-gradient-to-r from-cyan-300/25 via-cyan-400/10 to-transparent backdrop-blur-md',
    headerWash: 'bg-gradient-to-br from-cyan-300/30 via-cyan-400/10 to-transparent',
    headerIcon: 'text-cyan-100',
    headerIconBox:
      'rounded-lg border border-cyan-200/55 bg-cyan-300/25 backdrop-blur-sm shadow-[0_0_28px_-4px_rgba(103,232,249,0.65),inset_0_1px_0_rgba(255,255,255,0.12)]',
    body: 'relative bg-transparent',
    footer: 'border-t border-cyan-300/25 bg-cyan-300/[0.06] backdrop-blur-sm',
    text: 'text-cyan-100',
    textMuted: 'text-cyan-200/85',
    iconBg: 'bg-cyan-300/25 ring-1 ring-cyan-200/45',
    chip: 'rounded-md border border-cyan-300/40 bg-cyan-300/15 text-cyan-50/95',
    chipActive: 'rounded-md border-cyan-200/55 bg-cyan-300/30 text-white',
    metricShell: themedMetricShell('border-cyan-300/50', 'bg-cyan-300/22'),
    panel: glassPanel('border-cyan-300/50', 'bg-cyan-300/18'),
    panelWash: 'bg-gradient-to-br from-cyan-300/28 via-sky-300/10 to-transparent',
    panelDivider: panelDivider('border-cyan-300/30'),
    logEmpty: 'border-cyan-300/45 bg-cyan-300/12',
    historyRow:
      'rounded-lg border border-cyan-400/25 bg-cyan-950/25 backdrop-blur-md',
    historyRowHover: 'hover:border-cyan-300/45 hover:bg-cyan-400/[0.1]',
    historyIconBox:
      'rounded-lg border border-cyan-300/40 bg-cyan-400/15 backdrop-blur-sm',
    revenuePositive: 'text-cyan-200',
    chevron: 'group-hover/history:text-cyan-200 group-hover/history:border-cyan-300/45',
  },
  ratting: {
    type: 'ratting',
    ...glassCard(
      'border-red-400/35',
      'border-l-red-400',
      'from-red-500/[0.22]',
      'via-red-500/18',
      'ring-red-400/30 group-hover/card:ring-red-400/45',
      'shadow-[0_16px_52px_-16px_rgba(239,68,68,0.45)]',
      'bg-red-500/35',
      'from-red-500/[0.12] via-red-400/[0.05] to-transparent'
    ),
    accentBar: 'bg-red-400',
    header:
      'relative overflow-hidden border-b border-red-500/20 bg-gradient-to-r from-red-500/22 via-red-500/8 to-transparent backdrop-blur-md',
    headerWash: 'bg-gradient-to-br from-red-500/28 via-red-500/8 to-transparent',
    headerIcon: 'text-red-300',
    headerIconBox:
      'rounded-lg border border-red-400/45 bg-red-500/20 backdrop-blur-sm shadow-[0_0_24px_-4px_rgba(239,68,68,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]',
    body: 'relative bg-transparent',
    footer: 'border-t border-red-500/15 bg-red-500/[0.04] backdrop-blur-sm',
    text: 'text-red-300',
    textMuted: 'text-red-400/75',
    iconBg: 'bg-red-500/18 ring-1 ring-red-500/30',
    chip: 'rounded-md border border-red-500/20 bg-red-500/5 text-red-300/80',
    chipActive: 'rounded-md bg-red-500/15 text-red-200 border-red-400/35',
    metricShell: themedMetricShell('border-red-500/35', 'bg-red-500/[0.1]'),
    panel: glassPanel('border-red-500/35', 'bg-red-500/[0.12]'),
    panelWash: 'bg-gradient-to-br from-red-500/20 via-red-500/6 to-transparent',
    panelDivider: panelDivider('border-red-500/25'),
    logEmpty: 'border-red-500/35 bg-red-500/[0.08]',
    historyRow:
      'rounded-lg border border-red-500/15 bg-[#0c141c]/40 backdrop-blur-md',
    historyRowHover: 'hover:border-red-500/35 hover:bg-red-500/[0.06]',
    historyIconBox: 'rounded-lg border border-red-500/25 bg-red-500/10 backdrop-blur-sm',
    revenuePositive: 'text-red-300',
    chevron: 'group-hover/history:text-red-300 group-hover/history:border-red-500/35',
  },
  exploration: {
    type: 'exploration',
    ...glassCard(
      'border-orange-400/35',
      'border-l-orange-400',
      'from-orange-500/[0.22]',
      'via-orange-500/18',
      'ring-orange-400/30 group-hover/card:ring-orange-400/45',
      'shadow-[0_16px_52px_-16px_rgba(249,115,22,0.42)]',
      'bg-orange-500/35',
      'from-orange-500/[0.12] via-orange-400/[0.05] to-transparent'
    ),
    accentBar: 'bg-orange-400',
    header:
      'relative overflow-hidden border-b border-orange-500/20 bg-gradient-to-r from-orange-500/22 via-orange-500/8 to-transparent backdrop-blur-md',
    headerWash: 'bg-gradient-to-br from-orange-500/28 via-orange-500/8 to-transparent',
    headerIcon: 'text-orange-300',
    headerIconBox:
      'rounded-lg border border-orange-400/45 bg-orange-500/20 backdrop-blur-sm shadow-[0_0_24px_-4px_rgba(249,115,22,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]',
    body: 'relative bg-transparent',
    footer: 'border-t border-orange-400/15 bg-orange-500/[0.04] backdrop-blur-sm',
    text: 'text-orange-300',
    textMuted: 'text-orange-400/75',
    iconBg: 'bg-orange-500/18 ring-1 ring-orange-400/30',
    chip: 'rounded-md border border-orange-500/20 bg-orange-500/5 text-orange-300/80',
    chipActive: 'rounded-md bg-orange-500/15 text-orange-200 border-orange-400/35',
    metricShell: themedMetricShell('border-orange-400/35', 'bg-orange-500/[0.1]'),
    panel: glassPanel('border-orange-400/35', 'bg-orange-500/[0.12]'),
    panelWash: 'bg-gradient-to-br from-orange-500/20 via-orange-500/6 to-transparent',
    panelDivider: panelDivider('border-orange-400/25'),
    logEmpty: 'border-orange-400/35 bg-orange-500/[0.08]',
    historyRow:
      'rounded-lg border border-orange-500/15 bg-[#0c141c]/40 backdrop-blur-md',
    historyRowHover: 'hover:border-orange-500/35 hover:bg-orange-500/[0.06]',
    historyIconBox: 'rounded-lg border border-orange-500/25 bg-orange-500/10 backdrop-blur-sm',
    revenuePositive: 'text-orange-300',
    chevron: 'group-hover/history:text-orange-300 group-hover/history:border-orange-500/35',
  },
  salvaging: {
    type: 'salvaging',
    ...glassCard(
      'border-lime-400/35',
      'border-l-lime-400',
      'from-lime-500/[0.22]',
      'via-lime-500/18',
      'ring-lime-400/30 group-hover/card:ring-lime-400/45',
      'shadow-[0_16px_52px_-16px_rgba(132,204,22,0.42)]',
      'bg-lime-500/35',
      'from-lime-500/[0.12] via-lime-400/[0.05] to-transparent'
    ),
    accentBar: 'bg-lime-400',
    header:
      'relative overflow-hidden border-b border-lime-500/20 bg-gradient-to-r from-lime-500/22 via-lime-500/8 to-transparent backdrop-blur-md',
    headerWash: 'bg-gradient-to-br from-lime-500/28 via-lime-500/8 to-transparent',
    headerIcon: 'text-lime-300',
    headerIconBox:
      'rounded-lg border border-lime-400/45 bg-lime-500/20 backdrop-blur-sm shadow-[0_0_24px_-4px_rgba(132,204,22,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]',
    body: 'relative bg-transparent',
    footer: 'border-t border-lime-400/15 bg-lime-500/[0.04] backdrop-blur-sm',
    text: 'text-lime-300',
    textMuted: 'text-lime-400/75',
    iconBg: 'bg-lime-500/18 ring-1 ring-lime-400/30',
    chip: 'rounded-md border border-lime-500/20 bg-lime-500/5 text-lime-300/80',
    chipActive: 'rounded-md bg-lime-500/15 text-lime-200 border-lime-400/35',
    metricShell: themedMetricShell('border-lime-400/35', 'bg-lime-500/[0.1]'),
    panel: glassPanel('border-lime-400/35', 'bg-lime-500/[0.12]'),
    panelWash: 'bg-gradient-to-br from-lime-500/20 via-lime-500/6 to-transparent',
    panelDivider: panelDivider('border-lime-400/25'),
    logEmpty: 'border-lime-400/35 bg-lime-500/[0.08]',
    historyRow:
      'rounded-lg border border-lime-500/15 bg-[#0c141c]/40 backdrop-blur-md',
    historyRowHover: 'hover:border-lime-500/35 hover:bg-lime-500/[0.06]',
    historyIconBox: 'rounded-lg border border-lime-500/25 bg-lime-500/10 backdrop-blur-sm',
    revenuePositive: 'text-lime-300',
    chevron: 'group-hover/history:text-lime-300 group-hover/history:border-lime-500/35',
  },
  abyssal: {
    type: 'abyssal',
    ...glassCard(
      'border-purple-400/35',
      'border-l-purple-400',
      'from-purple-500/[0.22]',
      'via-purple-500/18',
      'ring-purple-400/30 group-hover/card:ring-purple-400/45',
      'shadow-[0_16px_52px_-16px_rgba(168,85,247,0.48)]',
      'bg-purple-500/35',
      'from-purple-500/[0.12] via-purple-400/[0.05] to-transparent'
    ),
    accentBar: 'bg-purple-400',
    header:
      'relative overflow-hidden border-b border-purple-500/20 bg-gradient-to-r from-purple-500/22 via-purple-500/8 to-transparent backdrop-blur-md',
    headerWash: 'bg-gradient-to-br from-purple-500/28 via-purple-500/8 to-transparent',
    headerIcon: 'text-purple-200',
    headerIconBox:
      'rounded-lg border border-purple-400/45 bg-purple-500/20 backdrop-blur-sm shadow-[0_0_24px_-4px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]',
    body: 'relative bg-transparent',
    footer: 'border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-sm',
    text: 'text-purple-400',
    textMuted: 'text-purple-400/65',
    iconBg: 'bg-purple-500/15',
    chip: 'rounded-md border border-purple-500/20 bg-purple-500/5 text-purple-300/80',
    chipActive: 'rounded-md bg-purple-500/15 text-purple-200 border-purple-400/35',
    metricShell: themedMetricShell('border-purple-400/35', 'bg-purple-500/[0.1]'),
    panel: glassPanel('border-purple-400/35', 'bg-purple-500/[0.12]'),
    panelWash: 'bg-gradient-to-br from-purple-500/22 via-purple-500/8 to-transparent',
    panelDivider: panelDivider('border-purple-400/25'),
    logEmpty: 'border-purple-400/35 bg-purple-500/[0.08]',
    historyRow:
      'rounded-lg border border-purple-500/15 bg-[#0c141c]/40 backdrop-blur-md',
    historyRowHover: 'hover:border-purple-500/35 hover:bg-purple-500/[0.06]',
    historyIconBox: 'rounded-lg border border-purple-500/25 bg-purple-500/10 backdrop-blur-sm',
    revenuePositive: 'text-purple-300',
    chevron: 'group-hover/history:text-purple-300 group-hover/history:border-purple-500/35',
  },
  crab: {
    type: 'crab',
    ...glassCard(
      'border-amber-500/25',
      'border-l-amber-500',
      'from-amber-500/[0.14]',
      'via-amber-950/30',
      'ring-amber-500/20',
      'shadow-[0_12px_40px_-16px_rgba(245,158,11,0.28)]',
      'bg-amber-500/22',
      'from-amber-500/[0.07] via-amber-500/[0.03] to-transparent'
    ),
    accentBar: 'bg-amber-500',
    header:
      'relative overflow-hidden border-b border-amber-500/15 bg-gradient-to-r from-amber-500/12 to-transparent backdrop-blur-md',
    headerWash: 'bg-gradient-to-br from-amber-500/18 via-amber-500/6 to-transparent',
    headerIcon: 'text-amber-400',
    headerIconBox: 'rounded-lg border border-amber-500/25 bg-amber-500/10 backdrop-blur-sm',
    body: 'relative bg-transparent',
    footer: 'border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-sm',
    text: 'text-amber-400',
    textMuted: 'text-amber-400/65',
    iconBg: 'bg-amber-500/12',
    chip: 'rounded-md border border-amber-500/20 bg-amber-500/5 text-amber-300/80',
    chipActive: 'rounded-md bg-amber-500/15 text-amber-200 border-amber-400/35',
    metricShell: GLASS_METRIC_SHELL,
    panel: glassPanel('border-amber-500/20', 'bg-amber-500/[0.04]'),
    panelWash: 'bg-gradient-to-br from-amber-500/12 to-transparent',
    panelDivider: panelDivider('border-amber-500/20'),
    logEmpty: 'border-amber-500/30 bg-amber-500/[0.06]',
    historyRow: 'rounded-lg border border-amber-500/15 bg-[#0c141c]/40 backdrop-blur-md',
    historyRowHover: 'hover:border-amber-500/30 hover:bg-amber-500/[0.05]',
    historyIconBox: 'rounded-lg border border-amber-500/25 bg-amber-500/10 backdrop-blur-sm',
    revenuePositive: 'text-amber-300',
    chevron: 'group-hover/history:text-amber-300 group-hover/history:border-amber-500/35',
  },
  pvp: {
    type: 'pvp',
    ...glassCard(
      'border-rose-500/25',
      'border-l-rose-500',
      'from-rose-500/[0.14]',
      'via-rose-950/30',
      'ring-rose-500/20',
      'shadow-[0_12px_40px_-16px_rgba(244,63,94,0.28)]',
      'bg-rose-500/22',
      'from-rose-500/[0.07] via-rose-500/[0.03] to-transparent'
    ),
    accentBar: 'bg-rose-500',
    header:
      'relative overflow-hidden border-b border-rose-500/15 bg-gradient-to-r from-rose-500/12 to-transparent backdrop-blur-md',
    headerWash: 'bg-gradient-to-br from-rose-500/18 via-rose-500/6 to-transparent',
    headerIcon: 'text-rose-400',
    headerIconBox: 'rounded-lg border border-rose-500/25 bg-rose-500/10 backdrop-blur-sm',
    body: 'relative bg-transparent',
    footer: 'border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-sm',
    text: 'text-rose-400',
    textMuted: 'text-rose-400/65',
    iconBg: 'bg-rose-500/12',
    chip: 'rounded-md border border-rose-500/20 bg-rose-500/5 text-rose-300/80',
    chipActive: 'rounded-md bg-rose-500/15 text-rose-200 border-rose-400/35',
    metricShell: GLASS_METRIC_SHELL,
    panel: glassPanel('border-rose-500/20', 'bg-rose-500/[0.04]'),
    panelWash: 'bg-gradient-to-br from-rose-500/12 to-transparent',
    panelDivider: panelDivider('border-rose-500/20'),
    logEmpty: 'border-rose-500/30 bg-rose-500/[0.06]',
    historyRow: 'rounded-lg border border-rose-500/15 bg-[#0c141c]/40 backdrop-blur-md',
    historyRowHover: 'hover:border-rose-500/30 hover:bg-rose-500/[0.05]',
    historyIconBox: 'rounded-lg border border-rose-500/25 bg-rose-500/10 backdrop-blur-sm',
    revenuePositive: 'text-rose-300',
    chevron: 'group-hover/history:text-rose-300 group-hover/history:border-rose-500/35',
  },
  escalations: {
    type: 'escalations',
    ...glassCard(
      'border-yellow-500/25',
      'border-l-yellow-500',
      'from-yellow-500/[0.14]',
      'via-yellow-950/30',
      'ring-yellow-500/20',
      'shadow-[0_12px_40px_-16px_rgba(234,179,8,0.25)]',
      'bg-yellow-500/20',
      'from-yellow-500/[0.06] via-yellow-500/[0.03] to-transparent'
    ),
    accentBar: 'bg-yellow-500',
    header:
      'relative overflow-hidden border-b border-yellow-500/15 bg-gradient-to-r from-yellow-500/12 to-transparent backdrop-blur-md',
    headerWash: 'bg-gradient-to-br from-yellow-500/18 via-yellow-500/6 to-transparent',
    headerIcon: 'text-yellow-400',
    headerIconBox: 'rounded-lg border border-yellow-500/25 bg-yellow-500/10 backdrop-blur-sm',
    body: 'relative bg-transparent',
    footer: 'border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-sm',
    text: 'text-yellow-400',
    textMuted: 'text-yellow-400/65',
    iconBg: 'bg-yellow-500/12',
    chip: 'rounded-md border border-yellow-500/20 bg-yellow-500/5 text-yellow-300/80',
    chipActive: 'rounded-md bg-yellow-500/15 text-yellow-200 border-yellow-400/35',
    metricShell: GLASS_METRIC_SHELL,
    panel: glassPanel('border-yellow-500/20', 'bg-yellow-500/[0.04]'),
    panelWash: 'bg-gradient-to-br from-yellow-500/12 to-transparent',
    panelDivider: panelDivider('border-yellow-500/20'),
    logEmpty: 'border-yellow-500/30 bg-yellow-500/[0.06]',
    historyRow: 'rounded-lg border border-yellow-500/15 bg-[#0c141c]/40 backdrop-blur-md',
    historyRowHover: 'hover:border-yellow-500/30 hover:bg-yellow-500/[0.05]',
    historyIconBox: 'rounded-lg border border-yellow-500/25 bg-yellow-500/10 backdrop-blur-sm',
    revenuePositive: 'text-yellow-300',
    chevron: 'group-hover/history:text-yellow-300 group-hover/history:border-yellow-500/35',
  },
  industry: {
    type: 'industry',
    ...glassCard(
      'border-zinc-500/25',
      'border-l-zinc-500',
      'from-zinc-500/[0.12]',
      'via-zinc-900/35',
      'ring-zinc-500/15',
      'shadow-[0_8px_32px_-12px_rgba(0,0,0,0.4)]',
      'bg-zinc-500/15',
      'from-zinc-500/[0.05] via-zinc-800/[0.08] to-transparent'
    ),
    accentBar: 'bg-zinc-500',
    header:
      'relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-r from-zinc-500/10 to-transparent backdrop-blur-md',
    headerWash: 'bg-gradient-to-br from-zinc-500/12 via-zinc-800/6 to-transparent',
    headerIcon: 'text-zinc-400',
    headerIconBox: 'rounded-lg border border-zinc-600/35 bg-zinc-800/30 backdrop-blur-sm',
    body: 'relative bg-transparent',
    footer: 'border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-sm',
    text: 'text-zinc-300',
    textMuted: 'text-zinc-500',
    iconBg: 'bg-zinc-800/40',
    chip: 'rounded-md border border-zinc-700/40 bg-zinc-900/40 text-zinc-400',
    chipActive: 'rounded-md bg-zinc-800/60 text-zinc-200 border-zinc-600/50',
    metricShell: GLASS_METRIC_SHELL,
    panel: glassPanel('border-zinc-600/25', 'bg-white/[0.03]'),
    panelWash: 'bg-gradient-to-br from-zinc-500/10 to-transparent',
    panelDivider: panelDivider('border-white/10'),
    logEmpty: 'border-white/10 bg-black/15',
    historyRow: 'rounded-lg border border-eve-border/25 bg-[#0c141c]/40 backdrop-blur-md',
    historyRowHover: 'hover:border-eve-border/45 hover:bg-white/[0.03]',
    historyIconBox: 'rounded-lg border border-zinc-600/35 bg-zinc-800/30 backdrop-blur-sm',
    revenuePositive: 'text-zinc-200',
    chevron: 'group-hover/history:text-eve-muted group-hover/history:border-eve-border/40',
  },
}

export function getActivityTheme(type: string): ActivityThemeClasses {
  const key = (type?.toLowerCase() || 'ratting') as ActivityType
  return THEME_BY_TYPE[key] ?? THEME_BY_TYPE.ratting
}

export function getActivityThemeIcon(type: string) {
  return getActivityColors((type?.toLowerCase() || 'ratting') as ActivityType).icon
}

export function getSpaceBadgeClass(space?: string | null): string {
  const s = space?.toLowerCase()
  if (s === 'high' || s === 'hs')
    return 'rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (s === 'low' || s === 'ls')
    return 'rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400'
  if (s === 'null' || s === 'nullsec')
    return 'rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-400'
  if (s === 'wormhole' || s === 'w-space')
    return 'rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-400'
  return 'rounded-md border border-eve-border/35 bg-black/20 text-eve-muted'
}

export function formatSpaceLabel(space?: string | null): string {
  if (!space) return '—'
  const s = space.toLowerCase()
  if (s === 'null' || s === 'nullsec') return 'Nullsec'
  if (s === 'high' || s === 'hs') return 'Highsec'
  if (s === 'low' || s === 'ls') return 'Lowsec'
  return space
}
