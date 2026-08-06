/**
 * Layered backgrounds for the activity history detail modal (lighter glass, aligned with analytics modal).
 */
export const SESSION_MODAL_SURFACE = {
  dialog:
    'border-white/12 bg-zinc-900/95 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl',
  body: 'bg-gradient-to-b from-zinc-800/30 via-zinc-900/50 to-zinc-950/70',
  headerOverlay: 'bg-gradient-to-br from-white/[0.06] to-transparent',
  kpiCard:
    'rounded-xl border border-white/15 bg-gradient-to-br from-white/[0.08] via-zinc-800/40 to-zinc-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md',
  section:
    'rounded-xl border border-white/15 bg-gradient-to-br from-zinc-800/50 via-zinc-800/35 to-zinc-900/25 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
  sectionExpanded:
    'border-t border-white/10 bg-zinc-800/25 backdrop-blur-sm',
  toolbar: 'rounded-xl border border-white/12 bg-white/[0.04] backdrop-blur-sm',
} as const

export const HISTORY_LIST_SURFACE = {
  row: 'bg-[#111820]/85 backdrop-blur-sm border-white/10',
  rowHover: 'hover:bg-[#151d28]/95 hover:border-white/18',
  metaChip: 'border-white/10 bg-[#0d1219]/80 text-zinc-400',
} as const
