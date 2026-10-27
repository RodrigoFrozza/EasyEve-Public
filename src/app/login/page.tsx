'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/motion-easing'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import { EXTERNAL_LINKS } from '@/constants/external-links'
import { PublicPageChrome } from '@/components/landing/PublicPageChrome'
import { ShieldCheck, LogIn, AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

function LoginContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const error = searchParams.get('error')
  const isBlocked = searchParams.get('blocked') === 'true'

  const handleLogin = () => {
    window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.55, ease: EASE_OUT_EXPO },
    },
  }

  return (
    <PublicPageChrome centered className="p-4 font-accent">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="fixed top-6 left-6 z-20"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-eve-muted hover:text-eve-accent font-medium transition-colors duration-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para o início</span>
        </Link>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-md"
        id="main-content"
      >
        <motion.div variants={itemVariants}>
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-eve-accent to-transparent rounded-full shadow-eve-accent-glow-sm" />
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="eve-public-panel rounded-xs overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-eve-accent/50 pointer-events-none z-20" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-eve-accent/50 pointer-events-none z-20" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-eve-accent/50 pointer-events-none z-20" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-eve-accent/50 pointer-events-none z-20" />

          <div className="bg-eve-dark px-8 py-6 border-b border-eve-border/40 relative">
            <div className="flex items-center gap-2 mb-4 text-[10px] text-eve-accent/80 font-medium">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-eve-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-eve-accent"></span>
              </span>
              <span>Acesso seguro</span>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xs bg-eve-accent/10 border border-eve-accent/35 shadow-eve-accent-glow-xs">
                <span className="text-lg font-bold text-eve-accent">E</span>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-eve-text">
                  Easy<span className="text-eve-accent">Eve</span>
                </h1>
              </div>
            </div>
            <p className="text-xs text-eve-muted font-medium mt-1">
              Entre com sua conta do EVE Online
            </p>
          </div>

          <div className="px-8 py-8 space-y-6">
            {(error || isBlocked) && (
              <motion.div variants={itemVariants} className="space-y-4">
                {error && (
                  <div className="relative bg-red-950/15 border border-red-500/25 p-5 rounded-xs overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500/60" />
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <p className="text-xs font-semibold text-red-400">Falha ao entrar</p>
                    </div>
                    <p className="text-xs text-red-300/80 font-medium leading-relaxed">
                      {error === 'OAuthAccountNotLinked'
                        ? 'Este personagem já está associado a outra conta.'
                        : 'Ocorreu um problema ao entrar. Por favor, tente novamente.'}
                    </p>
                  </div>
                )}

                {isBlocked && (
                  <div className="relative bg-red-950/10 border border-red-900/30 p-5 rounded-xs overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-700/60" />
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <p className="text-xs font-semibold text-red-400">Conta restrita</p>
                    </div>
                    <p className="text-eve-muted text-xs font-medium leading-relaxed">
                      Motivo: {searchParams.get('reason') || 'Ação administrativa.'}
                    </p>
                    <div className="mt-4 pt-3 border-t border-eve-border/20">
                      <a
                        href={EXTERNAL_LINKS.DISCORD}
                        className="text-xs text-eve-accent hover:underline font-semibold"
                      >
                        Falar com o suporte →
                      </a>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <motion.div variants={itemVariants} className="space-y-4">
              <Button
                type="button"
                variant="eve"
                size="lg"
                onClick={handleLogin}
                className="relative w-full h-14 text-sm font-bold rounded-xs group overflow-hidden"
              >
                <LogIn className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                <span className="relative z-10">Entrar com EVE Online</span>
              </Button>
            </motion.div>

            <motion.div variants={itemVariants} className="flex items-center gap-4">
              <div className="flex-1 h-px bg-eve-border/30" />
              <span className="text-[10px] text-eve-muted font-medium">Comunidade</span>
              <div className="flex-1 h-px bg-eve-border/30" />
            </motion.div>

            <motion.div variants={itemVariants}>
              <a
                href={EXTERNAL_LINKS.DISCORD}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-4 bg-eve-dark border border-eve-border/50 hover:border-eve-accent/40 hover:bg-eve-accent/[0.02] rounded-xs transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-eve-accent/[0.04] border border-eve-border/60 rounded-xs group-hover:border-eve-accent/40 transition-colors">
                    <DiscordIcon className="h-4 w-4 text-eve-muted group-hover:text-eve-accent transition-colors" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-eve-text group-hover:text-eve-accent transition-colors block">
                      Comunidade no Discord
                    </span>
                    <span className="text-[10px] text-eve-muted font-normal">
                      Entre e tire suas dúvidas
                    </span>
                  </div>
                </div>
                <span className="text-eve-accent/40 text-xs group-hover:text-eve-accent transition-colors">
                  →
                </span>
              </a>
            </motion.div>

            <motion.div variants={itemVariants}>
              <div className="pt-4 border-t border-eve-border/20 space-y-3">
                <div className="flex items-center justify-center gap-2 text-xs text-eve-muted font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
                  <span>Login seguro via CCP SSO</span>
                </div>
                <p className="text-[10px] text-eve-muted text-center font-normal leading-relaxed">
                  O EasyEve não solicita e nem guarda a senha da sua conta. Toda a autenticação é feita
                  diretamente pelos servidores da CCP Games. Suas credenciais continuam totalmente
                  seguras.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </PublicPageChrome>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#03070c]">
          <div className="flex items-center gap-2">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-eve-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-eve-accent"></span>
            </span>
            <span className="text-xs text-eve-muted font-medium font-accent">Carregando...</span>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
