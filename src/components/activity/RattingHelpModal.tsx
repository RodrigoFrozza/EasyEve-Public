'use client'

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  HelpCircle, 
  Zap, 
  ShieldCheck, 
  Wallet, 
  RefreshCw, 
  Target,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useTranslations } from '@/i18n/hooks'

interface RattingHelpModalProps {
  children?: React.ReactNode
}

export function RattingHelpModal({ children }: RattingHelpModalProps) {
  const { t } = useTranslations()
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-eve-accent">
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-eve-panel border-eve-border text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-red-500" />
            {t('activity.ratting.title')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('activity.ratting.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section 1: Preparation */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-eve-accent flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {t('activity.ratting.characterPreparation')}
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              {t('activity.ratting.characterPreparationText')}
            </p>
            <div className="bg-eve-dark/50 border border-eve-border rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 shrink-0" />
                <div className="text-sm">
                  {t('activity.ratting.walletScopeText')}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 shrink-0" />
                <div className="text-sm">
                  <span className="font-bold text-white">{t('activity.ratting.activeTokens')}</span> {t('activity.ratting.activeTokensHelp')}
                </div>
              </div>
            </div>
          </section>

          <Separator className="bg-eve-border/50" />

          {/* Section 2: Starting the Operation */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-eve-accent flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {t('activity.ratting.startOperation')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">{t('activity.ratting.stepA')}</h4>
                <p className="text-xs text-gray-400">
                  {t('activity.ratting.stepAText')}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">{t('activity.ratting.stepB')}</h4>
                <p className="text-xs text-gray-400">
                  {t('activity.ratting.stepBText')}
                </p>
              </div>
            </div>
            <div className="mt-2 text-xs bg-red-500/10 border border-red-500/20 rounded p-3 text-red-400 flex gap-2 italic">
              <Info className="h-4 w-4 shrink-0" />
              {t('activity.ratting.note')}
            </div>
          </section>

          <Separator className="bg-eve-border/50" />

          {/* Section 3: Automatic Synchronization */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-eve-accent flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              {t('activity.ratting.iskSync')}
            </h3>
            <p className="text-sm text-gray-300">
              {t('activity.ratting.iskSyncText')}
            </p>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="bg-zinc-900 p-3 rounded-lg border border-eve-border flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-bold text-white uppercase">{t('activity.ratting.bountyTicks')}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {t('activity.ratting.bountyTicksHelp')}
                  </p>
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg border border-eve-border flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-bold text-white uppercase">{t('activity.ratting.essPayouts')}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {t('activity.ratting.essPayoutsHelp')}
                  </p>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <h4 className="text-xs font-bold text-yellow-500 uppercase flex items-center gap-2 mb-1">
                  <AlertCircle className="h-3 w-3" />
                  {t('activity.ratting.important')}
                </h4>
                <p className="text-[10px] text-yellow-500/80">
                  {t('activity.ratting.importantText')}
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Expert Tips */}
          <section className="bg-zinc-900/50 border border-eve-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              {t('activity.ratting.expertTips')}
            </h3>
            <ul className="text-xs text-gray-400 space-y-2 list-disc pl-4">
              <li>{t('activity.ratting.expertTip1')}</li>
              <li>{t('activity.ratting.expertTip2')}</li>
              <li>{t('activity.ratting.expertTip3')}</li>
            </ul>
          </section>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={() => {}} className="bg-eve-accent text-black font-bold hover:bg-eve-accent/80">
            {t('activity.ratting.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
