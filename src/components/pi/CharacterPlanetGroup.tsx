'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { cn, formatCurrencyValue } from '@/lib/utils'
import type { PiColonyAnalysis } from '@/lib/pi/types'
import { computeCharacterNetIsk } from '@/lib/pi/portfolio-attribution'
import { useTranslations } from '@/i18n/hooks'
import { PlanetTile } from './PlanetTile'
import { PlanetIconSummary } from './PlanetIconSummary'

type Props = {
  characterId: number
  characterName: string
  colonies: PiColonyAnalysis[]
  rateMode: 'potential' | 'current'
  showWarnings?: boolean
  onSelectColony: (colony: PiColonyAnalysis) => void
  defaultOpen?: boolean
}

export function CharacterPlanetGroup({
  characterId,
  characterName,
  colonies,
  rateMode,
  showWarnings = true,
  onSelectColony,
  defaultOpen = false,
}: Props) {
  const { t } = useTranslations()
  const [open, setOpen] = useState(defaultOpen)

  const netIskSum = computeCharacterNetIsk(colonies, characterId, rateMode)

  const toggle = () => setOpen((v) => !v)

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className="flex w-full cursor-pointer items-center gap-4 p-4 text-left hover:bg-zinc-800/40"
      >
        <img
          src={`https://images.evetech.net/characters/${characterId}/portrait?size=64`}
          alt=""
          className="h-12 w-12 rounded-lg border border-zinc-700 bg-zinc-800 object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-eve-text">{characterName}</h3>
            {!open && colonies.length > 0 ? (
              <PlanetIconSummary colonies={colonies} />
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">
            {colonies.length} {t('pi.group.planets')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {t('pi.group.netIskPerHour')}
          </p>
          <p
            className={cn(
              'text-lg font-bold tabular-nums',
              netIskSum >= 0 ? 'text-emerald-300' : 'text-red-400'
            )}
          >
            {formatCurrencyValue(netIskSum)}
            <span className="ml-0.5 text-xs font-normal text-zinc-500">/h</span>
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
        )}
      </div>

      {open ? (
        <div className="border-t border-zinc-800 p-4">
          {colonies.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">{t('pi.group.noColonies')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {colonies.map((colony) => (
                <PlanetTile
                  key={colony.planetId}
                  colony={colony}
                  rateMode={rateMode}
                  showWarnings={showWarnings}
                  onClick={() => onSelectColony(colony)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
