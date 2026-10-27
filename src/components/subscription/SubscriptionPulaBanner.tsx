'use client'

import Link from 'next/link'
import { Crown, ArrowUpRight } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'

export function SubscriptionPulaBanner() {
  const { t } = useTranslations()

  return (
    <Link
      href="/dashboard/subscription/leroy"
      className="flex items-center justify-between gap-3 rounded-[14px] border border-[rgba(224,169,74,.3)] bg-[rgba(224,169,74,.06)] p-4 transition-colors hover:bg-[rgba(224,169,74,.1)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(224,169,74,.3)] bg-[rgba(224,169,74,.15)]">
          <Crown className="h-5 w-5 text-ta-warning" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-accent font-semibold text-ta-warning">
            {t('subscription.leroy.pulaMember') || t('subscription.pulaLeeroyDetected')}
          </p>
          <p className="truncate text-sm text-ta-secondary">
            {t('subscription.leroy.claimReward') || t('subscription.pulaLeeroyClaim')}
          </p>
        </div>
      </div>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-ta-warning" />
    </Link>
  )
}
