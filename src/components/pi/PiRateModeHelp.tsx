'use client'

import { HelpCircle } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = {
  rateMode: 'potential' | 'current'
}

export function PiRateModeHelp({ rateMode }: Props) {
  const { t } = useTranslations()
  const tooltipKey =
    rateMode === 'potential' ? 'pi.rateMode.potentialTooltip' : 'pi.rateMode.currentTooltip'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label={t('pi.rateMode.helpLabel')}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm whitespace-pre-line text-xs">
          {t(tooltipKey)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function PiPricingModeHelp() {
  const { t } = useTranslations()

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label={t('pi.config.pricingHelpLabel')}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        {/* Portalled to the body so it isn't clipped by the settings modal's
            overflow-y-auto; collisionPadding keeps it inside the viewport. */}
        <TooltipPortal>
          <TooltipContent
            side="bottom"
            align="start"
            collisionPadding={12}
            className="max-w-sm whitespace-pre-line text-xs"
          >
            {t('pi.config.pricingHelp')}
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  )
}

export function PiRateModeTabsHelp() {
  const { t } = useTranslations()

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label={t('pi.rateMode.helpLabel')}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-md space-y-2 whitespace-pre-line text-xs">
          <p>
            <span className="font-semibold text-violet-200">{t('pi.rateMode.potential')}:</span>{' '}
            {t('pi.rateMode.potentialTooltip')}
          </p>
          <p>
            <span className="font-semibold text-cyan-200">{t('pi.rateMode.current')}:</span>{' '}
            {t('pi.rateMode.currentTooltip')}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
