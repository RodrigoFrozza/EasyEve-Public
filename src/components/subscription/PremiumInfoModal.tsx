'use client'

import { useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Crown, Coins, Check, X, 
  Sparkles, Users, ListChecks, BarChart3, HelpCircle,
  Zap, FileDown, Trophy, Store, Gift
} from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { cn, formatISK } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const SUBSCRIPTION_COST_ISK = 100_000_000

const TABS = [
  { id: 'benefits', label: 'benefits', icon: Sparkles },
  { id: 'pricing', label: 'pricing', icon: Coins },
  { id: 'compare', label: 'compare', icon: Users },
] as const

type TabId = typeof TABS[number]['id']

interface PremiumInfoModalProps {
  children?: ReactNode
}

export function PremiumInfoModal({ children }: PremiumInfoModalProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('benefits')
  const { t } = useTranslations()

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-8 w-8 rounded-full bg-eve-accent/10 border border-eve-accent/30 text-eve-accent hover:bg-eve-accent/20 hover:border-eve-accent/50"
        aria-label={t('subscription.infoModal.openHelp')}
      >
        {children || <HelpCircle className="h-4 w-4" />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800 bg-gradient-to-r from-eve-accent/10 to-transparent">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-eve-accent/20 border border-eve-accent/30 flex items-center justify-center">
                <Crown className="h-5 w-5 text-eve-accent" />
              </div>
              <div>
                <span className="text-eve-accent text-xs font-bold uppercase tracking-widest">{t('subscription.premiumTacticalAdvantage')}</span>
                <h2 className="text-xl font-black text-white">{t('subscription.premium')}</h2>
              </div>
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm mt-1">
              {t('subscription.infoModal.subtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-0 pt-4">
            <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      activeTab === tab.id
                        ? "bg-eve-accent text-black font-bold"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(`subscription.infoModal.tabs.${tab.label}`)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="pt-4"
              >
                {activeTab === 'benefits' && <BenefitsTab t={t} />}
                {activeTab === 'pricing' && <PricingTab t={t} />}
                {activeTab === 'compare' && <CompareTab t={t} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BenefitsTab({ t }: { t: ReturnType<typeof useTranslations>['t'] }) {
  const benefits = [
    { icon: ListChecks, title: t('subscription.infoModal.benefits.unlimitedFittings.title'), desc: t('subscription.infoModal.benefits.unlimitedFittings.desc') },
    { icon: Users, title: t('subscription.infoModal.benefits.unlimitedTracking.title'), desc: t('subscription.infoModal.benefits.unlimitedTracking.desc') },
    { icon: BarChart3, title: t('subscription.infoModal.benefits.leaderboard.title'), desc: t('subscription.infoModal.benefits.leaderboard.desc') },
    { icon: Crown, title: t('subscription.infoModal.benefits.advancedTools.title'), desc: t('subscription.infoModal.benefits.advancedTools.desc') },
    { icon: Zap, title: t('subscription.infoModal.benefits.esiSync.title'), desc: t('subscription.infoModal.benefits.esiSync.desc') },
    { icon: FileDown, title: t('subscription.infoModal.benefits.csvExport.title'), desc: t('subscription.infoModal.benefits.csvExport.desc') },
    { icon: Trophy, title: t('subscription.infoModal.benefits.reputation.title'), desc: t('subscription.infoModal.benefits.reputation.desc') },
    { icon: Store, title: t('subscription.infoModal.benefits.storeAccess.title'), desc: t('subscription.infoModal.benefits.storeAccess.desc') },
    { icon: Gift, title: t('subscription.infoModal.benefits.events.title'), desc: t('subscription.infoModal.benefits.events.desc') },
  ]

  return (
    <div className="space-y-4">
      <p className="text-zinc-400 text-sm leading-relaxed">
        {t('subscription.infoModal.benefits.intro')}
      </p>
      
      <div className="space-y-3">
        {benefits.map((benefit, i) => {
          const Icon = benefit.icon
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-zinc-900/50 to-zinc-900/20 border border-zinc-800/50"
            >
              <div className="h-10 w-10 shrink-0 rounded-lg bg-eve-accent/10 border border-eve-accent/20 flex items-center justify-center">
                <Icon className="h-5 w-5 text-eve-accent" />
              </div>
              <div>
                <h3 className="text-white font-semibold">{benefit.title}</h3>
                <p className="text-zinc-400 text-sm mt-0.5">{benefit.desc}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-eve-accent/5 border border-eve-accent/20">
        <p className="text-sm text-zinc-300 leading-relaxed">
          {t('subscription.infoModal.benefits.cta')}
        </p>
      </div>
    </div>
  )
}

function PricingTab({ t }: { t: ReturnType<typeof useTranslations>['t'] }) {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-gradient-to-br from-eve-accent/10 to-transparent border border-eve-accent/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Badge className="bg-eve-accent/20 text-eve-accent border-eve-accent/30 mb-2">
              {t('subscription.infoModal.pricing.mostPopular')}
            </Badge>
            <h3 className="text-2xl font-black text-white">{t('subscription.infoModal.pricing.monthlyPlan')}</h3>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-amber-400">{formatISK(SUBSCRIPTION_COST_ISK)}</p>
            <p className="text-zinc-500 text-sm">{t('subscription.infoModal.pricing.perMonth')}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-zinc-300">
            <Check className="h-4 w-4 text-green-400 shrink-0" />
            {t('subscription.infoModal.pricing.feature1')}
          </div>
          <div className="flex items-center gap-2 text-zinc-300">
            <Check className="h-4 w-4 text-green-400 shrink-0" />
            {t('subscription.infoModal.pricing.feature2')}
          </div>
          <div className="flex items-center gap-2 text-zinc-300">
            <Check className="h-4 w-4 text-green-400 shrink-0" />
            {t('subscription.infoModal.pricing.feature3')}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
        <h4 className="text-white font-semibold mb-2">{t('subscription.infoModal.pricing.howTo.title')}</h4>
        <ol className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-start gap-2">
            <span className="h-5 w-5 shrink-0 rounded bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-bold">1</span>
            <span>{t('subscription.infoModal.pricing.howTo.step1')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="h-5 w-5 shrink-0 rounded bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-bold">2</span>
            <span>{t('subscription.infoModal.pricing.howTo.step2')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="h-5 w-5 shrink-0 rounded bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-bold">3</span>
            <span>{t('subscription.infoModal.pricing.howTo.step3')}</span>
          </li>
        </ol>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <Coins className="h-6 w-6 text-amber-400 shrink-0" />
        <div>
          <p className="text-amber-300 font-semibold text-sm">{t('subscription.infoModal.pricing.iskEquivalent')}</p>
          <p className="text-zinc-400 text-xs mt-0.5">{t('subscription.infoModal.pricing.iskEquivalentDesc')}</p>
        </div>
      </div>
    </div>
  )
}

function CompareTab({ t }: { t: ReturnType<typeof useTranslations>['t'] }) {
  return (
    <div className="space-y-4">
      <p className="text-zinc-400 text-sm leading-relaxed">
        {t('subscription.infoModal.compare.intro')}
      </p>

      <div className="rounded-xl overflow-hidden border border-zinc-800">
        <div className="grid grid-cols-3 gap-4 p-3 bg-zinc-900/80 border-b border-zinc-800">
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{t('subscription.infoModal.compare.feature')}</div>
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider text-center">{t('subscription.infoModal.compare.free')}</div>
          <div className="text-eve-accent text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1">
            <Crown className="h-3 w-3" />
            {t('subscription.infoModal.compare.premium')}
          </div>
        </div>
        
        <div className="divide-y divide-zinc-800/50">
          <FeatureRow t={t} name={t('subscription.infoModal.compare.characterLimit')} free="1" premium={t('subscription.infoModal.compare.unlimited')} highlight={false} />
          <FeatureRow t={t} name={t('subscription.infoModal.compare.concurrentActivities')} free="1" premium={t('subscription.infoModal.compare.unlimited')} highlight={false} />
          <FeatureRow t={t} name={t('subscription.infoModal.compare.fittingManagement')} free={t('subscription.infoModal.compare.viewOnly')} premium={t('subscription.infoModal.compare.fullAccess')} highlight={true} />
          <FeatureRow t={t} name={t('subscription.infoModal.compare.leaderboard')} free={false} premium={true} highlight={true} />
          <FeatureRow t={t} name={t('subscription.infoModal.compare.resolveFittings')} free={t('subscription.infoModal.compare.limited')} premium={t('subscription.infoModal.compare.unlimited')} highlight={false} />
          <FeatureRow t={t} name={t('subscription.infoModal.compare.marketData')} free={t('subscription.infoModal.compare.basic')} premium={t('subscription.infoModal.compare.fullAccess')} highlight={false} />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
        <p className="text-zinc-400 text-sm leading-relaxed">
          {t('subscription.infoModal.compare.cta')}
        </p>
      </div>
    </div>
  )
}

function FeatureRow({ t, name, free, premium, highlight }: { 
  t: ReturnType<typeof useTranslations>['t']
  name: string
  free: string | boolean
  premium: string | boolean
  highlight: boolean
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-4 p-3 text-sm", highlight && "bg-eve-accent/5")}>
      <div className={cn("text-zinc-300", highlight && "text-white font-medium")}>{name}</div>
      <div className="text-zinc-500 text-center flex items-center justify-center">
        {typeof free === 'boolean' ? (
          free ? <Check className="h-4 w-4 text-green-400 mx-auto" /> : <X className="h-4 w-4 text-zinc-600 mx-auto" />
        ) : (
          <span>{free}</span>
        )}
      </div>
      <div className="text-eve-accent text-center font-medium flex items-center justify-center">
        {typeof premium === 'boolean' ? (
          premium ? <Check className="h-4 w-4 text-eve-accent mx-auto" /> : <X className="h-4 w-4 text-zinc-600 mx-auto" />
        ) : (
          <span className="text-eve-accent">{premium}</span>
        )}
      </div>
    </div>
  )
}