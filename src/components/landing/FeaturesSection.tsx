'use client'

import { motion } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'
import Link from 'next/link'
import { 
  Rocket, 
  Gem, 
  Pickaxe, 
  Zap, 
  Layers, 
  ShoppingBag,
  ArrowRight
} from 'lucide-react'

const features = [
  { key: 'realTime', titleKey: 'realTimeTitle', descKey: 'realTimeDesc', Icon: Rocket },
  { key: 'lootAnalysis', titleKey: 'lootAnalysisTitle', descKey: 'lootAnalysisDesc', Icon: Gem },
  { key: 'miningStats', titleKey: 'miningStatsTitle', descKey: 'miningStatsDesc', Icon: Pickaxe },
  { key: 'abyssalTracker', titleKey: 'abyssalTrackerTitle', descKey: 'abyssalTrackerDesc', Icon: Zap },
  {
    key: 'shipFitting',
    titleKey: 'shipFittingTitle',
    descKey: 'shipFittingDesc',
    href: '/dashboard/fits/editor',
    Icon: Layers,
    colorClass: 'text-violet-400',
    bgClass: 'bg-violet-400/10',
    borderClass: 'hover:border-violet-500/50',
    isSoon: true
  },
  {
    key: 'marketBrowser',
    titleKey: 'marketBrowserTitle',
    descKey: 'marketBrowserDesc',
    href: '/market',
    Icon: ShoppingBag,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-400/10',
    borderClass: 'hover:border-emerald-500/50',
    isSoon: true
  },
] as const

export function FeaturesSection() {
  const { t } = useTranslations()

  return (
    <section id="features" className="relative py-32 bg-transparent overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-24"
        >
          <h2 className="text-4xl md:text-6xl font-extralight text-white mb-6 tracking-tight">
            {t('home.features.sectionTitle')}
          </h2>
          <p className="text-base md:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed font-light">
            {t('home.features.sectionDescription')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.Icon
            const colorClass = 'colorClass' in feature ? feature.colorClass : 'text-eve-accent'
            const bgClass = 'bgClass' in feature ? feature.bgClass : 'bg-eve-accent/10'
            const borderClass = 'borderClass' in feature ? feature.borderClass : 'hover:border-eve-accent/50'

            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className={`group relative p-10 rounded-3xl bg-white/[0.01] backdrop-blur-xl border border-white/[0.03] hover:border-white/10 transition-all duration-500`}
              >
                {'href' in feature && feature.href ? (
                  <Link
                    href={feature.href}
                    className="absolute inset-0 z-10 rounded-3xl focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white/20"
                    aria-label={t(`home.features.${feature.titleKey}`)}
                  />
                ) : null}
                
                <div className="relative z-0">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full border border-white/5 flex items-center justify-center mb-8 group-hover:bg-white/[0.02] group-hover:border-white/20 transition-all duration-500`}>
                    <Icon className={`w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity`} />
                  </div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-light text-white/90 group-hover:text-white transition-colors">
                      {t(`home.features.${feature.titleKey}`)}
                    </h3>
                    {'isSoon' in feature && feature.isSoon && (
                      <span className="text-[9px] font-bold bg-white/5 text-white/60 px-2 py-1 rounded border border-white/10 uppercase tracking-[0.2em]">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 font-light leading-relaxed text-sm">
                    {t(`home.features.${feature.descKey}`)}
                  </p>
                  
                  {'href' in feature && feature.href && (
                    <div className={`mt-8 flex items-center gap-3 text-xs font-medium text-white/40 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0`}>
                      <span className="uppercase tracking-widest">Explore</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-24 flex flex-col sm:flex-row flex-wrap gap-8 justify-center items-center"
        >
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-3 text-white/50 hover:text-white transition-colors font-light text-sm uppercase tracking-widest"
          >
            {t('home.features.cta')}
            <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
          </Link>
          <Link
            href="/dashboard/fits/editor"
            className="group inline-flex items-center gap-3 text-white/50 hover:text-white transition-colors font-light text-sm uppercase tracking-widest"
          >
            {t('home.features.ctaFits')}
            <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
          </Link>
          <Link
            href="/market"
            className="group inline-flex items-center gap-3 text-white/50 hover:text-white transition-colors font-light text-sm uppercase tracking-widest"
          >
            {t('home.features.ctaMarket')}
            <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}