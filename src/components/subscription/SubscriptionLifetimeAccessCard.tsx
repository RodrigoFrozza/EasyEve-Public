'use client'

import { Crown, Infinity } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'

export function SubscriptionLifetimeAccessCard() {
  const { t } = useTranslations()

  return (
    <div className="ta-panel !border-eve-accent/[0.2] p-[22px]">
      <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-[14px]">
        <Crown className="h-4 w-4 text-eve-accent" />
        <h3 className="font-accent text-[13px] font-semibold uppercase tracking-[0.1em] text-ta-body">
          {t('subscription.lifetimeAccessTitle')}
        </h3>
      </div>
      <div className="flex items-start gap-4 rounded-[10px] border border-eve-accent/20 bg-eve-accent/[0.06] p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-eve-accent/30 bg-eve-accent/[0.1]">
          <Infinity className="h-6 w-6 text-eve-accent" />
        </div>
        <div>
          <p className="font-accent font-semibold text-eve-accent">{t('subscription.lifetimeLabel')}</p>
          <p className="mt-1 text-sm text-ta-secondary">{t('subscription.lifetimeAccessDesc')}</p>
        </div>
      </div>
    </div>
  )
}
