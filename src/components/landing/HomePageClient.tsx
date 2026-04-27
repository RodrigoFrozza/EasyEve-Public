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
import { HomepageCarousel } from '@/components/HomepageCarousel'
import { OpenSourceBanner } from '@/components/OpenSourceBanner'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { SocialProof } from '@/components/landing/SocialProof'
import { EXTERNAL_LINKS } from '@/constants/external-links'

const StarField = dynamic(
  () => import('@/components/landing/StarField').then((m) => ({ default: m.StarField })),
  { ssr: false }
)
const FloatingParticles = dynamic(
  () =>
    import('@/components/landing/FloatingParticles').then((m) => ({
      default: m.FloatingParticles,
    })),
  { ssr: false }
)
const GridLines = dynamic(
  () => import('@/components/landing/GridLines').then((m) => ({ default: m.GridLines })),
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
    <main id="main-content" className="relative min-h-screen bg-eve-dark overflow-x-hidden selection:bg-eve-accent/30 selection:text-white">
      <Navbar />

      <StarField />
      <FloatingParticles />
      <GridLines />

      {/* Sophisticated background depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-eve-dark/40 to-eve-dark" />
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(0,212,255,0.08),transparent_50%)]" />

      <motion.div
        ref={containerRef}
        className="relative z-10 text-center px-4 pt-20 min-h-[90vh] flex flex-col items-center justify-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={prefersReducedMotion ? undefined : { y }}
      >
        {/* Animated Hero Logo */}
        <motion.div variants={logoVariants} className="mb-10 relative group">
          <div className="relative inline-block">
            {!prefersReducedMotion && (
              <motion.div
                className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-eve-accent to-cyan-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
            <motion.div
              className="relative w-28 h-28 mx-auto rounded-3xl bg-gradient-to-br from-eve-accent via-cyan-400 to-blue-500 shadow-2xl flex items-center justify-center overflow-hidden border border-white/20"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.05, rotate: 2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
              <span className="text-6xl font-black text-black drop-shadow-2xl relative z-10">E</span>
              <div className="absolute top-1 right-1 bg-black text-white text-[10px] font-black px-1.5 py-0.5 rounded-md z-20">
                {t('common.beta').toUpperCase()}
              </div>
              
              {!prefersReducedMotion && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
                  initial={{ x: '-150%' }}
                  animate={{ x: '150%' }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 2,
                  }}
                />
              )}
            </motion.div>
          </div>
        </motion.div>
        
        {/* Beta Notice Banner */}
        <motion.div variants={itemVariants} className="mb-6 max-w-2xl px-4">
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-eve-accent/10 border border-eve-accent/20 backdrop-blur-md group hover:border-eve-accent/40 transition-all duration-300">
            <div className="flex h-2 w-2 rounded-full bg-eve-accent animate-pulse shadow-[0_0_8px_rgba(0,212,255,0.5)]" />
            <span className="text-[10px] font-black text-eve-accent uppercase tracking-[0.2em] border-r border-eve-accent/20 pr-2 leading-none">
              {t('common.beta')}
            </span>
            <p className="text-xs text-gray-300 font-medium leading-relaxed">
              {t('home.betaNotice')}
              <a 
                href={EXTERNAL_LINKS.DISCORD} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-1.5 text-eve-accent hover:text-white hover:underline transition-colors font-bold inline-flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3" />
                Discord
              </a>
            </p>
          </div>
        </motion.div>

        {/* Hero Heading */}
        <motion.h1
          variants={itemVariants}
          className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter"
        >
          <div className="flex flex-col items-center justify-center">
            <span className="block">{heroLine1}</span>
            <span className="block mt-[-0.1em] text-transparent bg-clip-text bg-gradient-to-r from-eve-accent via-cyan-200 to-eve-accent drop-shadow-[0_0_30px_rgba(0,212,255,0.3)]">
              {heroLine2}
            </span>
          </div>
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-lg md:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed font-medium"
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
              className="group relative inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-eve-accent to-cyan-500 text-black font-black text-xl rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,212,255,0.3)]"
            >
              <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative z-10 flex items-center gap-3">
                <Zap className="w-6 h-6 fill-black" />
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
                whileHover={prefersReducedMotion ? undefined : { scale: 1.05, y: -2 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              >
                <Link
                  href={btn.href}
                  className={`group relative inline-flex items-center gap-3 px-6 py-4 bg-white/[0.03] backdrop-blur-md border-2 ${btn.border} ${btn.text || 'text-white'} font-bold text-base rounded-2xl transition-all ${btn.hover}`}
                >
                  <btn.Icon className="w-5 h-5" />
                  {btn.label}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Hero Chips (Features) */}
        <motion.ul
          variants={itemVariants}
          role="list"
          className="mt-20 flex max-w-5xl flex-col flex-wrap items-stretch justify-center gap-4 text-sm text-gray-500 sm:mx-auto sm:flex-row sm:items-center sm:gap-x-6 sm:gap-y-4"
        >
          {heroChipDefs.map(({ href, labelKey, Icon }) => (
            <li key={labelKey} className="list-none sm:flex-1 sm:min-w-0 sm:max-w-[12rem]">
              <a
                href={href}
                className="flex min-h-12 w-full items-center justify-center gap-3 whitespace-normal rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-2 text-center transition-all hover:bg-white/[0.08] hover:border-eve-accent/30 group"
              >
                <Icon className="h-5 w-5 shrink-0 text-eve-accent group-hover:scale-110 transition-transform" aria-hidden />
                <span className="leading-tight font-medium text-gray-400 group-hover:text-gray-200 transition-colors">{t(labelKey)}</span>
              </a>
            </li>
          ))}
        </motion.ul>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.button
        type="button"
        className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0 flex flex-col items-center gap-2"
        aria-label={t('home.scrollToContent')}
        onClick={scrollDown}
        onKeyDown={onScrollKeyDown}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Scroll</span>
        <div className="relative w-7 h-12 rounded-full border-2 border-white/10 flex justify-center p-1 overflow-hidden">
          {!prefersReducedMotion && (
            <motion.div
              className="w-1.5 h-1.5 bg-eve-accent rounded-full"
              animate={{ 
                y: [0, 24, 0],
                opacity: [0, 1, 0]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          )}
          {prefersReducedMotion && <div className="w-1.5 h-1.5 bg-eve-accent rounded-full opacity-50" />}
        </div>
      </motion.button>

      <HomepageCarousel />
      <ScreenshotGrid />
      <FeaturesSection />
      <SocialProof />
      <OpenSourceBanner />

      {/* Premium Footer */}
      <footer className="relative z-10 py-20 border-t border-white/[0.05] bg-eve-dark/40 backdrop-blur-3xl overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-eve-accent/50 to-transparent opacity-30" />
        
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="lg:col-span-2 space-y-6">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-eve-accent to-cyan-500 flex items-center justify-center font-black text-black shadow-lg shadow-eve-accent/20 transition-transform group-hover:scale-110 group-hover:rotate-3">
                  E
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-black text-white tracking-tight">EasyEve</span>
                  <span className="text-xs font-bold text-eve-accent uppercase tracking-[0.2em] opacity-70">Next-Gen Management</span>
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
                  <MessageSquare className="w-5 h-5" />
                </motion.a>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-white font-bold uppercase tracking-widest text-xs">{t('home.footer.links')}</h4>
              <ul className="space-y-4">
                {['features', 'screenshots', 'opensource'].map((item) => (
                  <li key={item}>
                    <a href={`#${item}`} className="text-gray-400 hover:text-eve-accent transition-colors text-sm font-medium flex items-center gap-2 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-eve-accent opacity-0 group-hover:opacity-100 transition-all scale-0 group-hover:scale-100" />
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
                    <MessageSquare className="w-4 h-4" /> {t('home.footer.joinDiscord')}
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
