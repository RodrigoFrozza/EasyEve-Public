'use client'

import { PremiumInfoModal } from '@/components/subscription/PremiumInfoModal'
import { useTranslations } from '@/i18n/hooks'

export function SubscriptionPageHeader() {
  const { t } = useTranslations()

  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="font-accent text-[22px] font-bold tracking-[0.01em] text-white">
          {t('subscription.pageTitle')}
        </h1>
        <p className="mt-1 text-[12.5px] text-ta-muted">{t('subscription.pageSubtitle')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PremiumInfoModal />
      </div>
    </header>
  )
}
