'use client'

import dynamic from 'next/dynamic'
import { useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { 
  Gem, 
  Layers, 
  Pickaxe, 
  Rocket, 
  Swords, 
  ChevronDown, 
  Zap, 
  Layout, 
  TrendingUp,
  Github,
  MessageSquare
} from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { Navbar } from '@/components/Navbar'
import { ScreenshotGrid } from '@/components/ScreenshotGrid'
import { OpenSourceBanner } from '@/components/OpenSourceBanner'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { SocialProof } from '@/components/landing/SocialProof'
import { Roadmap } from '@/components/landing/Roadmap'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import { EXTERNAL_LINKS } from '@/constants/external-links'

const StarField = dynamic(
  () => import('@/components/landing/StarField').then((m) => ({ default: m.StarField })),
  { ssr: false }
)

const heroChipDefs = [
  { href: '#features', labelKey: 'home.heroChips.realTimeFleet' as const, Icon: Rocket },
  { href: '#features', labelKey: 'home.heroChips.lootAnalysis' as const, Icon: Gem },
  { href: '#features', labelKey: 'home.heroChips.miningStats' as const, Icon: Pickaxe },
  { href: '#features', labelKey: 'home.heroChips.combatLogs' as const, Icon: Swords },
]

export function HomePageClient() {
  const { t } = useTranslations()
  const prefersReducedMotion = usePrefersReducedMotion()

  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], [0, 150])

  const containerVariants = useMemo(
    () =>
      ({
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2,
          },
        },
      }) as const,
    []
  )

  const itemVariants = useMemo(
    () =>
      ({
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            type: 'spring',
            stiffness: 80,
            damping: 12,
          },
        },
      }) as const,
    []
  )

  const logoVariants = useMemo(() => {
    if (prefersReducedMotion) {
      return {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: 0.25 },
        },
      } as const
    }
    return {
      hidden: { scale: 0.8, opacity: 0 },
      visible: {
        scale: 1,
        opacity: 1,
        transition: {
          type: 'spring',
          stiffness: 100,
          damping: 15,
          delay: 0.1,
        },
      },
    } as const
  }, [prefersReducedMotion])

  const scrollDown = useCallback(() => {
    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })
  }, [])

  const onScrollKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        scrollDown()
      }
    },
    [scrollDown]
  )

  const heroLine1 = t('home.heroLine1')
  const heroLine2 = t('home.heroLine2')

  return (
    <main id="main-content" className="relative min-h-screen bg-black overflow-x-hidden selection:bg-white/20 selection:text-white">
      <Navbar />

      <StarField />

      {/* Deep Space Void */}
      <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_70%)] z-0 pointer-events-none" />

      <motion.div
        ref={containerRef}
        className="relative z-10 text-center px-4 pt-48 pb-48 min-h-screen flex flex-col items-center justify-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={prefersReducedMotion ? undefined : { y }}
      >
        {/* Animated Hero Logo - Glassmorphism style */}
        <motion.div variants={logoVariants} className="mb-16 relative group">
          <div className="relative inline-block">
            <motion.div
              className="relative w-32 h-32 mx-auto rounded-full bg-black flex items-center justify-center border border-white/10 backdrop-blur-3xl shadow-[0_0_80px_rgba(255,255,255,0.02)] group-hover:shadow-[0_0_100px_rgba(255,255,255,0.05)] transition-shadow duration-1000 overflow-hidden"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <motion.div 
                className="absolute inset-0"
                style={{ willChange: 'transform', transform: 'translateZ(0)' }}
               animate={prefersReducedMotion ? {} : { rotate: [0, 360] }}
                 transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
              >
                {/* Primary Surface Glow (Lit side) */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15)_0%,transparent_60%)]" />
                
                {/* Surface texture/variation - More pronounced to see movement */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.08)_0%,transparent_40%)]" />
                
                {/* Third feature for better parallax reference */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_80%,rgba(255,255,255,0.05)_0%,transparent_30%)]" />
              </motion.div>

              {/* Global Spherical Shadow (Static relative to light source) */}
              <div className="absolute inset-0 shadow-[inset_-20px_-20px_50px_rgba(0,0,0,0.9),inset_10px_10px_50px_rgba(255,255,255,0.04)] rounded-full pointer-events-none" />
              
              {/* Atmospheric Rim / Fresnel effect (Static) */}
              <div className="absolute inset-0 rounded-full border border-white/10 opacity-40 shadow-[0_0_15px_rgba(255,255,255,0.05)] pointer-events-none" />
              
              {/* Static Brand Initial */}
              <span className="text-6xl font-bold text-white/90 drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] relative z-10 tracking-tighter select-none">E</span>
            </motion.div>
            <div className="absolute -top-2 -right-2 bg-white/[0.03] text-white/40 text-[8px] font-light px-3 py-1 rounded-full z-20 shadow-2xl border border-white/10 backdrop-blur-md uppercase tracking-[0.3em] pointer-events-none">
              {t('common.beta')}
            </div>
          </div>
        </motion.div>
        
        {/* Beta Notice Banner */}
        <motion.div variants={itemVariants} className="mb-10 max-w-2xl px-4">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/[0.01] border border-white/[0.05] backdrop-blur-2xl transition-all duration-500">
            <div className="flex h-1.5 w-1.5 rounded-full bg-white/50 animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
            <span className="text-[9px] font-light text-white/50 uppercase tracking-[0.3em] border-r border-white/10 pr-3 leading-none">
              {t('common.beta')}
            </span>
            <p className="text-[11px] text-white/40 font-light tracking-wide leading-relaxed">
              {t('home.betaNotice')}
              <a 
                href={EXTERNAL_LINKS.DISCORD} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 text-white/70 hover:text-white transition-colors font-medium inline-flex items-center gap-1.5"
              >
                <DiscordIcon className="w-3 h-3 opacity-70" />
                Discord
              </a>
            </p>
          </div>
        </motion.div>

        {/* Hero Heading */}
        <motion.h1
          variants={itemVariants}
          className="text-5xl md:text-7xl lg:text-8xl font-extralight text-white mb-10 tracking-tight"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="block opacity-90">{heroLine1}</span>
            <span className="block text-white/60 font-light">
              {heroLine2}
            </span>
          </div>
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-base md:text-xl text-white/40 mb-16 max-w-3xl mx-auto leading-relaxed font-light tracking-wide"
        >
          {t('home.subtitle')}
        </motion.p>

        {/* Hero Actions */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row flex-wrap gap-5 justify-center items-center"
        >
          {/* Primary CTA */}
          <motion.div
            whileHover={prefersReducedMotion ? undefined : { scale: 1.05, y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          >
              <Link
                href="/login"
                className="group relative inline-flex items-center gap-4 px-12 py-5 bg-white/[0.03] text-white/90 font-light text-lg rounded-full overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.02)] border border-white/10 backdrop-blur-xl hover:bg-white/[0.05] transition-all duration-500"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="relative z-10 flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
                  {t('home.getStarted')}
                </div>
              </Link>
          </motion.div>

          {/* Secondary CTAs */}
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { href: '/dashboard', label: t('home.dashboard'), Icon: Layout, border: 'border-white/10', hover: 'hover:bg-white/5' },
              { href: '/dashboard/fits/editor', label: t('home.fitsEditor'), Icon: Layers, border: 'border-violet-500/20', hover: 'hover:bg-violet-500/10', text: 'text-violet-300' },
              { href: '/market', label: t('home.marketCta'), Icon: TrendingUp, border: 'border-emerald-500/20', hover: 'hover:bg-emerald-500/10', text: 'text-emerald-400' },
            ].map((btn) => (
              <motion.div
                key={btn.href}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              >
                <Link
                  href={btn.href}
                  className={`group relative inline-flex items-center gap-3 px-8 py-4 bg-transparent backdrop-blur-sm border ${btn.border} text-white/60 font-light text-sm rounded-full transition-all duration-500 hover:text-white/90 ${btn.hover}`}
                >
                  <btn.Icon className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  {btn.label}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.ul
          variants={itemVariants}
          role="list"
          className="mt-40 flex max-w-5xl flex-col flex-wrap items-center justify-center gap-6 text-sm text-gray-500 sm:mx-auto sm:flex-row sm:gap-x-12 sm:gap-y-8"
        >
          {heroChipDefs.map(({ href, labelKey, Icon }) => (
            <li key={labelKey} className="list-none flex-1 min-w-[140px] max-w-[200px]">
              <a
                href={href}
                className="flex flex-col items-center justify-center gap-4 py-4 text-center transition-all group"
              >
                <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center bg-white/[0.01] group-hover:bg-white/[0.03] group-hover:border-white/20 transition-all duration-500">
                  <Icon className="h-4 w-4 text-white/30 group-hover:text-white/70 transition-colors" aria-hidden />
                </div>
                <span className="leading-tight font-light tracking-wide text-white/30 group-hover:text-white/70 transition-colors text-xs uppercase">{t(labelKey)}</span>
              </a>
            </li>
          ))}
        </motion.ul>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.button
        type="button"
        className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0 flex flex-col items-center gap-4 group"
        aria-label={t('home.scrollToContent')}
        onClick={scrollDown}
        onKeyDown={onScrollKeyDown}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <span className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-light group-hover:text-white/40 transition-colors">Scroll</span>
        <div className="relative w-px h-16 bg-white/5 overflow-hidden">
          {!prefersReducedMotion && (
            <motion.div
              className="w-full h-4 bg-gradient-to-b from-transparent via-white/40 to-transparent"
              animate={{ 
                y: [-16, 64],
                opacity: [0, 1, 0]
              }}
              transition={{ 
                duration: 2.5, 
                repeat: Infinity,
                ease: "linear"
              }}
            />
          )}
        </div>
      </motion.button>

      <ScreenshotGrid />
      <FeaturesSection />
      <SocialProof />
      <Roadmap />
      <OpenSourceBanner />

      {/* Premium Footer */}
      <footer className="relative z-10 py-24 border-t border-white/[0.02] bg-black overflow-hidden">
        
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
            <div className="lg:col-span-2 space-y-8">
              <Link href="/" className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center font-extralight text-white/80 transition-all duration-500 group-hover:border-white/30 group-hover:text-white">
                  E
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-light text-white/90 tracking-widest uppercase">EasyEve</span>
                  <span className="text-[9px] font-light text-white/40 uppercase tracking-[0.3em]">Next-Gen Management</span>
                </div>
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                The ultimate open-source platform for EVE Online pilots. 
                Powerful fittings, advanced character management, and deep activity tracking.
              </p>
              <div className="flex items-center gap-4">
                <motion.a
                  href={EXTERNAL_LINKS.GITHUB}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-white/[0.1] transition-all text-gray-400 hover:text-white"
                  whileHover={{ y: -3 }}
                >
                  <Github className="w-5 h-5" />
                </motion.a>
                <motion.a
                  href={EXTERNAL_LINKS.DISCORD}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20 hover:bg-[#5865F2]/20 hover:border-[#5865F2]/30 transition-all text-[#5865F2] hover:text-white"
                  whileHover={{ y: -3 }}
                >
                  <DiscordIcon className="w-5 h-5 group-hover:scale-110 transition-transform duration-500" />
                </motion.a>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-white font-bold uppercase tracking-widest text-xs">{t('home.footer.links')}</h4>
              <ul className="space-y-4">
                {['features', 'screenshots', 'opensource'].map((item) => (
                  <li key={item}>
                    <a href={`#${item}`} className="text-gray-400 hover:text-eve-accent transition-colors text-sm font-medium flex items-center gap-2 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-eve-accent opacity-0 group-hover:opacity-100 transition-all scale-0 group-hover:scale-110" />
                      {t(`home.nav.${item}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-white font-bold uppercase tracking-widest text-xs">{t('home.footer.community')}</h4>
              <ul className="space-y-4">
                <li>
                  <a href={EXTERNAL_LINKS.GITHUB} target="_blank" className="text-gray-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2">
                    <Github className="w-4 h-4" /> {t('home.footer.publicCode')}
                  </a>
                </li>
                <li>
                  <a href={EXTERNAL_LINKS.DISCORD} target="_blank" className="text-gray-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2">
                    <DiscordIcon className="w-4 h-4" />
                    {t('home.footer.joinDiscord')}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-10 border-t border-white/[0.05] flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="space-y-4 max-w-3xl">
              <p className="text-gray-500 text-[11px] leading-relaxed italic opacity-80">
                {t('home.footer.trademark')}
              </p>
              <p className="text-gray-500 text-[11px] leading-relaxed">
                {t('home.footer.affiliate')}
              </p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2 shrink-0">
              <p className="text-gray-400 text-xs font-black tracking-[0.2em] uppercase">
                EasyEve &copy; {new Date().getFullYear()}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-600 font-medium">
                <span>MADE WITH</span>
                <span className="text-red-500">❤️</span>
                <span>FOR NEW EDEN</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
