'use client'

import type { Ref } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslations } from '@/i18n/hooks'

interface SubscriptionRedeemCardProps {
  activationCode: string
  onActivationCodeChange: (value: string) => void
  onRedeem: () => void
  isRedeeming: boolean
  hasPromoCodeInUrl: boolean
  inputRef: Ref<HTMLInputElement>
}

export function SubscriptionRedeemCard({
  activationCode,
  onActivationCodeChange,
  onRedeem,
  isRedeeming,
  hasPromoCodeInUrl,
  inputRef,
}: SubscriptionRedeemCardProps) {
  const { t } = useTranslations()

  return (
    <div id="premium-code-redeem" className="ta-panel p-[22px]">
      <h3 className="mb-4 font-accent text-[15px] font-semibold text-white">
        {t('subscription.sectionRedeem')}
      </h3>
      <div className="space-y-4">
        {hasPromoCodeInUrl && (
          <div className="rounded-[10px] border border-eve-accent/30 bg-eve-accent/[0.1] px-4 py-3">
            <p className="text-sm font-medium text-eve-accent">
              {t('subscription.promoCodeReadyHint')}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label
              htmlFor="activation-code"
              className="font-accent text-[10px] font-semibold uppercase tracking-[0.15em] text-ta-muted"
            >
              {t('subscription.codeActivationTitle')}
            </label>
            <Input
              id="activation-code"
              ref={inputRef}
              type="text"
              value={activationCode}
              onChange={(e) => onActivationCodeChange(e.target.value.toUpperCase())}
              placeholder={t('subscription.codePlaceholder')}
              className="h-12 rounded-[10px] border-white/[0.08] bg-ta-inset font-sans text-base tracking-[0.08em] text-ta-body placeholder:text-ta-faint"
            />
            <p className="text-xs text-ta-muted">{t('subscription.codeActivationDesc')}</p>
          </div>
          <Button
            onClick={onRedeem}
            disabled={isRedeeming || !activationCode.trim()}
            className="ta-cta h-12 shrink-0 rounded-[10px] px-6 font-accent font-bold disabled:opacity-50"
          >
            {isRedeeming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('subscription.redeemCode')
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
