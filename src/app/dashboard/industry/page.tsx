'use client'

import { useState } from 'react'
import { Factory, Settings2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { IndustryCalculator, type CalculatorPreset } from '@/components/industry/IndustryCalculator'
import { WhatToProduce } from '@/components/industry/WhatToProduce'
import { BestOutputs } from '@/components/industry/BestOutputs'
import { IndustryJobs } from '@/components/industry/IndustryJobs'
import { IndustrySettingsModal } from '@/components/industry/IndustrySettingsModal'
import { HubScan } from '@/components/industry/HubScan'
import { cn } from '@/lib/utils'

export default function IndustryDashboardPage() {
  const { t } = useTranslations()
  const [tab, setTab] = useState<'cost' | 'produce' | 'best' | 'jobs' | 'hubscan'>('cost')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [configVersion, setConfigVersion] = useState(0)
  const [preset, setPreset] = useState<CalculatorPreset | null>(null)

  // Clicking an item in the scanner opens it in the cost calculator.
  const openInCalculator = (typeId: number, name: string) => {
    setPreset({ typeId, name, nonce: Date.now() })
    setTab('cost')
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Factory className="h-5 w-5 text-violet-300" />
          <h1 className="text-lg font-semibold text-eve-text">{t('industry.pageTitle')}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} className="gap-1.5 border-zinc-800">
          <Settings2 className="h-3.5 w-3.5" />
          {t('industry.settings.button')}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'cost' | 'produce' | 'best' | 'jobs' | 'hubscan')}>
        <TabsList className="border border-zinc-800 bg-zinc-900">
          <TabsTrigger value="cost">{t('industry.tabCost')}</TabsTrigger>
          <TabsTrigger value="produce">{t('industry.tabProduce')}</TabsTrigger>
          <TabsTrigger value="best">{t('industry.tabBest')}</TabsTrigger>
          <TabsTrigger value="jobs">{t('industry.tabJobs')}</TabsTrigger>
          <TabsTrigger value="hubscan">{t('industry.tabHubScan')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* All four stay mounted (hidden when inactive) so switching tabs doesn't re-run
          the scanner, lose the calculator's state, or refetch the jobs list. */}
      <div className={cn(tab !== 'cost' && 'hidden')}>
        <IndustryCalculator configVersion={configVersion} preset={preset} />
      </div>
      <div className={cn(tab !== 'produce' && 'hidden')}>
        <WhatToProduce configVersion={configVersion} onOpenInCalculator={openInCalculator} />
      </div>
      <div className={cn(tab !== 'best' && 'hidden')}>
        <BestOutputs configVersion={configVersion} onOpenInCalculator={openInCalculator} />
      </div>
      <div className={cn(tab !== 'jobs' && 'hidden')}>
        <IndustryJobs />
      </div>
      <div className={cn(tab !== 'hubscan' && 'hidden')}>
        <HubScan />
      </div>

      <IndustrySettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={() => setConfigVersion((v) => v + 1)}
      />
    </div>
  )
}
