'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import { EXTERNAL_LINKS } from '@/constants/external-links'

const StarField = dynamic(
  () => import('@/components/landing/StarField').then((m) => ({ default: m.StarField })),
  { ssr: false }
)

function LoginContent() {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const prefersReducedMotion = usePrefersReducedMotion()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const error = searchParams.get('error')
  const isBlocked = searchParams.get('blocked') === 'true'

  const handleLogin = () => {
    window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" as const }
    }
  }

  return (
    <main id="main-content" className="relative flex min-h-screen items-center justify-center bg-[#000000] p-4 overflow-hidden">
      <StarField />
      
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md z-10"
      >
        <Card className="relative border-white/[0.05] bg-white/[0.01] backdrop-blur-2xl rounded-[2.5rem] shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
          
          <CardHeader className="text-center pt-12">
            {/* Dark Planet Logo */}
            <div className="relative mx-auto mb-8 w-24 h-24 group">
              <motion.div
                className="relative w-full h-full rounded-full bg-black flex items-center justify-center border border-white/10 shadow-2xl overflow-hidden"
                whileHover={{ scale: 1.05 }}
              >
                {/* Rotating Surface */}
                <motion.div 
                  className="absolute inset-0"
                  animate={prefersReducedMotion ? {} : { rotate: 360 }}
                  transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15)_0%,transparent_60%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.05)_0%,transparent_50%)]" />
                </motion.div>

                {/* Spherical Shadow */}
                <div className="absolute inset-0 shadow-[inset_-10px_-10px_30px_rgba(0,0,0,0.9),inset_5px_5px_30px_rgba(255,255,255,0.03)] rounded-full pointer-events-none" />
                
                <span className="text-4xl font-bold text-white/90 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] relative z-10 tracking-tighter">E</span>
              </motion.div>
              
              <div className="absolute -top-1 -right-1 bg-white/[0.03] text-white/40 text-[7px] font-light px-2 py-0.5 rounded-full z-20 border border-white/10 backdrop-blur-md uppercase tracking-[0.2em]">
                {t('common.beta')}
              </div>
            </div>

            <CardTitle className="text-xl font-light text-white/90 tracking-[0.2em] uppercase font-accent">
               {t('login.welcomeToEasyEve')}
             </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 pb-12 px-8">
            {(error || isBlocked) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                {error && (
                  <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-4 text-[11px] text-red-400/80 backdrop-blur-md flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                {error === 'OAuthAccountNotLinked'
                         ? t('login.errorOAuthNotLinked')
                         : t('login.errorGeneric')}
                    </div>
                  </div>
                )}

                {isBlocked && (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-[11px] text-red-400 backdrop-blur-md flex flex-col gap-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <AlertCircle className="h-12 w-12 rotate-12" />
                    </div>
                    <p className="font-bold tracking-[0.2em] uppercase flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      Account Restricted
                    </p>
                    <p className="opacity-80 leading-relaxed uppercase tracking-tighter">
                      {t('login.reason')} {searchParams.get('reason') || 'Terms violation or administrative pending.'}
                    </p>
                    <p className="text-[9px] mt-1 italic text-white/30 uppercase tracking-widest">
                      {t('login.contactDiscord')}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            <Button
              onClick={handleLogin}
              className="w-full bg-white/[0.03] hover:bg-white/[0.07] text-white/90 border border-white/10 h-14 rounded-2xl text-sm font-light tracking-widest uppercase transition-all duration-500 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <svg className="mr-3 h-5 w-5 opacity-50 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Login with ESI
            </Button>

            <div className="pt-2">
              <Button
                asChild
                variant="ghost"
                className="w-full text-white/20 hover:text-white/60 hover:bg-white/5 h-12 rounded-2xl text-[10px] font-light tracking-[0.3em] uppercase transition-all duration-500"
              >
                <a href={EXTERNAL_LINKS.DISCORD} target="_blank" rel="noopener noreferrer">
                   <DiscordIcon className="mr-2 h-3 w-3 opacity-50" />
                   {t('login.needSupport')}
                 </a>
              </Button>
            </div>

            <p className="text-center text-[10px] text-white/20 font-light leading-relaxed px-4 uppercase tracking-tighter">
               {t('login.agreeTerms')}
             </p>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#000000]">
        <Loader2 className="h-8 w-8 animate-spin text-white/20 z-10" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}


