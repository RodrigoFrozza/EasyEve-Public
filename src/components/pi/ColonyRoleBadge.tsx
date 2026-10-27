'use client'

import { cn } from '@/lib/utils'
import type { PiColonyRole } from '@/lib/pi/types'
import { useTranslations } from '@/i18n/hooks'

const ROLE_STYLES: Record<PiColonyRole, string> = {
  integrated: 'bg-violet-500/15 text-violet-300',
  factory_only: 'bg-cyan-500/15 text-cyan-300',
  extraction_only: 'bg-amber-500/15 text-amber-300',
  unknown: 'bg-zinc-500/15 text-zinc-400',
}

type Props = {
  role: PiColonyRole
  className?: string
  showFlow?: boolean
}

export function ColonyRoleBadge({ role, className, showFlow = false }: Props) {
  const { t } = useTranslations()

  if (role === 'unknown') return null

  return (
    <div className={cn('space-y-0.5', className)}>
      <span
        className={cn(
          'inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
          ROLE_STYLES[role]
        )}
      >
        {t(`pi.colonyRole.${role}`)}
      </span>
      {showFlow ? (
        <p className="text-[10px] leading-snug text-zinc-500">{t(`pi.colonyRole.flow.${role}`)}</p>
      ) : null}
    </div>
  )
}
