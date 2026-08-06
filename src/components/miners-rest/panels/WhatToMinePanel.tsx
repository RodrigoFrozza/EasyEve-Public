'use client'

import { MiningValuableOres } from '@/components/activity/MiningValuableOres'
import { useTranslations } from '@/i18n/hooks'
import { MinersRestSection } from '../MinersRestSection'

type Props = {
  space?: string
  category?: string
}

export function WhatToMinePanel({ space, category }: Props) {
  const { t } = useTranslations()

  return (
    <MinersRestSection title={t('minersRest.tools.whatToMine')}>
      <MiningValuableOres
        initialType={category || 'Ore'}
        space={space}
        lockCategory={Boolean(category)}
        themed
      />
    </MinersRestSection>
  )
}
