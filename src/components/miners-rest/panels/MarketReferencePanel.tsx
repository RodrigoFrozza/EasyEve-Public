'use client'

import { MARKET_NOTES, MINERAL_NAMES } from '@/lib/constants/mining-knowledge'
import { useTranslations } from '@/i18n/hooks'
import { MinersRestSection } from '../MinersRestSection'

export function MarketReferencePanel() {
  const { t } = useTranslations()

  return (
    <MinersRestSection title={t('minersRest.tools.marketReference')}>
      <div className="space-y-4 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-sm text-zinc-400">
        <p className="font-medium text-cyan-100/90">{MARKET_NOTES.hubRegion}</p>
        <p>{MARKET_NOTES.summary}</p>
        <p className="text-xs text-zinc-500">
          {t('minersRest.tools.minerals')}: {MINERAL_NAMES.join(', ')}
        </p>
        <p className="text-xs text-zinc-500">{t('minersRest.tools.marketNote')}</p>
      </div>
    </MinersRestSection>
  )
}
