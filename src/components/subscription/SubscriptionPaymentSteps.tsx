'use client'

import { useState } from 'react'
import { Wallet, Copy, Check } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { toast } from 'sonner'

const CORP_NAME = "Easy Eve Holding's"

interface SubscriptionPaymentStepsProps {
  accountCode: string | null | undefined
}

export function SubscriptionPaymentSteps({ accountCode }: SubscriptionPaymentStepsProps) {
  const { t } = useTranslations()
  const [copied, setCopied] = useState(false)

  const copyCorp = () => {
    navigator.clipboard.writeText(CORP_NAME)
    setCopied(true)
    toast.success(t('subscription.corpNameCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  const steps = [
    {
      n: 1,
      title: t('subscription.step1Title'),
      desc: t('subscription.step1Desc'),
      extra: (
        <button
          type="button"
          className="mt-3 flex w-full items-center gap-3 rounded-[10px] border border-white/[0.08] bg-ta-inset p-3 text-left transition-colors hover:border-eve-accent/40"
          onClick={copyCorp}
          aria-label={t('subscription.copyCorpAria')}
        >
          <div className="min-w-0 flex-1">
            <p className="font-accent text-[10px] font-semibold uppercase tracking-wider text-ta-muted">
              {t('subscription.transferTo')}
            </p>
            <code className="font-sans font-bold text-eve-accent">{CORP_NAME}</code>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-white/[0.08] bg-ta-inset">
            {copied ? (
              <Check className="h-4 w-4 text-ta-success" />
            ) : (
              <Copy className="h-4 w-4 text-ta-muted" />
            )}
          </div>
        </button>
      ),
    },
    {
      n: 2,
      title: t('subscription.step2Title'),
      desc: t('subscription.step2Desc'),
      extra: accountCode ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ta-secondary">{t('subscription.putInReason')}</span>
          <code className="rounded-[6px] border border-dashed border-eve-accent/[0.34] bg-ta-inset px-2 py-0.5 font-sans text-sm font-bold tracking-[0.1em] text-eve-accent">
            {accountCode}
          </code>
        </div>
      ) : null,
    },
    {
      n: 3,
      title: t('subscription.step3Title'),
      desc: t('subscription.step3Desc'),
      extra: null,
    },
  ]

  return (
    <div className="ta-panel p-[22px]">
      <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-[14px]">
        <Wallet className="h-4 w-4 text-eve-accent" />
        <h3 className="font-accent text-[13px] font-semibold uppercase tracking-[0.1em] text-ta-body">
          {t('subscription.howItWorks')}
        </h3>
      </div>
      <div className="space-y-[14px]">
        {steps.map((step) => (
          <div key={step.n} className="flex items-start gap-[14px]">
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-eve-accent/[0.22] bg-eve-accent/[0.1] font-accent text-[13px] font-bold text-eve-accent">
              {step.n}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-accent text-[14px] font-semibold text-ta-bright">{step.title}</p>
              <p className="mt-0.5 text-[12.5px] text-ta-secondary">{step.desc}</p>
              {step.extra}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
