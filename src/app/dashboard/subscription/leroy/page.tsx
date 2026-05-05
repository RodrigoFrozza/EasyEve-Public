'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/session-client'
import { isPremium } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { 
  Sparkles, Shield, Star, Crown, Rocket, 
  CheckCircle2, Copy, Check, Zap, Gift,
  Medal, ChevronRight, X, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import Link from 'next/link'

const PULALEEROY_BANNER_KEY = 'pulaLeeroy_banner_dismissed'
const PULALEEROY_CODE_KEY = 'pulaLeeroy_personal_code'

interface PulaLeeroyCode {
  code: string
  generated: boolean
}

export default function PulaLeeroyPage() {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const [copied, setCopied] = useState(false)
  const [hasDismissed, setHasDismissed] = useState(false)
  const [loadingCode, setLoadingCode] = useState(true)
  const [pulaLeeroyCode, setPulaLeeroyCode] = useState<PulaLeeroyCode | null>(null)
  const hasPremium = isPremium(session?.user?.subscriptionEnd)

  useEffect(() => {
    const initCode = async () => {
      const dismissed = localStorage.getItem(PULALEEROY_BANNER_KEY)
      if (dismissed === 'true') {
        setHasDismissed(true)
      }

      // Check if user already has a code stored locally
      const storedCode = localStorage.getItem(PULALEEROY_CODE_KEY)
      if (storedCode) {
        setPulaLeeroyCode({ code: storedCode, generated: false })
        setLoadingCode(false)
        return
      }

      // Generate new unique code and store on server
      try {
        const res = await fetch('/api/subscription/leroy-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await res.json()
        if (data.code) {
          localStorage.setItem(PULALEEROY_CODE_KEY, data.code)
          setPulaLeeroyCode({ code: data.code, generated: true })
        }
      } catch (err) {
        console.error('Failed to generate code:', err)
      } finally {
        setLoadingCode(false)
      }
    }

    initCode()
  }, [])

  const copyCode = () => {
    if (pulaLeeroyCode?.code) {
      navigator.clipboard.writeText(pulaLeeroyCode.code)
      setCopied(true)
      toast.success(t('subscription.leroy.codeCopied'))
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(PULALEEROY_BANNER_KEY, 'true')
    setHasDismissed(true)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24 px-4 py-8">
      {/* Dismiss Button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/20"
        >
          <X className="h-4 w-4 mr-1" />
          {t('subscription.leroy.dontShowAgain')}
        </Button>
      </div>

      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative text-center space-y-6 py-12"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent rounded-full blur-3xl" />
        
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="relative inline-flex"
        >
          <Crown className="h-20 w-20 text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.5)]" />
          <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-amber-300 animate-pulse" />
        </motion.div>

        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter relative">
          <span className="text-amber-400">Pula</span>
          <span className="text-white">Leeroy</span>
        </h1>
        
        <p className="text-xl text-amber-200/80 max-w-2xl mx-auto">
          {t('subscription.leroy.thankYouMessage')}
        </p>
      </motion.div>

      {/* Special Gift Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-amber-950/50 to-yellow-950/30 border-amber-500/30 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-20">
            <Gift className="h-32 w-32 text-amber-400" />
          </div>
          
          <CardContent className="p-8 md:p-12 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <Star className="h-5 w-5 fill-amber-400" />
                  <span className="text-sm font-bold uppercase tracking-widest">{t('subscription.leroy.specialGift')}</span>
                </div>
                
                <h2 className="text-3xl font-black text-white">{t('subscription.leroy.lifetimeAccess')}</h2>
                
                <p className="text-amber-200/70 leading-relaxed">
                  {t('subscription.leroy.lifetimeDescription')}
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t('subscription.leroy.unlimitedTracking')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t('subscription.leroy.unlimitedFits')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t('subscription.leroy.globalRanking')}</span>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto">
                {hasPremium ? (
                  <div className="text-center space-y-3 p-6 bg-green-950/30 rounded-xl border border-green-500/30">
                    <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto" />
                    <p className="text-green-400 font-bold text-lg">{t('subscription.leroy.active')}</p>
                    <p className="text-green-300/70 text-sm">{t('subscription.leroy.youHaveAccess')}</p>
                  </div>
                ) : loadingCode ? (
                  <div className="text-center space-y-4 p-6">
                    <Loader2 className="h-8 w-8 text-amber-400 animate-spin mx-auto" />
                    <p className="text-amber-400/70 text-sm">{t('subscription.leroy.generatingCode')}</p>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="bg-black/50 p-4 rounded-xl border border-amber-500/30">
                      <p className="text-xs text-amber-400/70 uppercase font-bold tracking-widest mb-2">{t('subscription.leroy.yourCode')}</p>
                      <code className="text-2xl font-black text-amber-400">{pulaLeeroyCode?.code || 'PL8R-FREE'}</code>
                    </div>
                    <Button 
                      onClick={copyCode}
                      disabled={!pulaLeeroyCode?.code}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          {t('subscription.leroy.copiedSuccess')}
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          {t('subscription.leroy.copyCode')}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-amber-400 mb-4">
          <Zap className="h-5 w-5" />
          <span className="font-bold uppercase tracking-widest">{t('subscription.leroy.howToActivate')}</span>
        </div>

        <Card className="bg-zinc-950/50 border-zinc-800">
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-4">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">1</div>
              <div>
                <p className="text-white font-medium">{t('subscription.leroy.step1Title')}</p>
                <p className="text-zinc-500 text-sm">{t('subscription.leroy.step1Desc')}</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">2</div>
              <div>
                <p className="text-white font-medium">{t('subscription.leroy.step2Title')}</p>
                <p className="text-zinc-500 text-sm">{t('subscription.leroy.step2Desc')}</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">3</div>
              <div>
                <p className="text-white font-medium">{t('subscription.leroy.step3Title')}</p>
                <p className="text-zinc-500 text-sm">{t('subscription.leroy.step3Desc')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link href="/dashboard/subscription">
          <Button className="w-full bg-eve-accent hover:bg-eve-accent/80 text-black font-bold mt-4">
            {t('subscription.leroy.goToSubscription')}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </motion.div>

      {/* Footer Message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center space-y-2"
      >
        <p className="text-zinc-500 text-sm">
          🦅 <span className="text-amber-400 font-bold">GLORIOUS</span> 🦅
        </p>
        <p className="text-zinc-600 text-xs">
          {t('subscription.leroy.footerMessage')}
        </p>
      </motion.div>
    </div>
  )
}