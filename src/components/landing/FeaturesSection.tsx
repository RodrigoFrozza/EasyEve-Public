'use client'

import { motion } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'
import Link from 'next/link'
import { 
  Rocket, 
  Gem, 
  Pickaxe, 
  Swords, 
  Layers, 
  ShoppingBag,
  ArrowRight
} from 'lucide-react'

const features = [
  { key: 'realTime', titleKey: 'realTimeTitle', descKey: 'realTimeDesc', Icon: Rocket },
  { key: 'lootAnalysis', titleKey: 'lootAnalysisTitle', descKey: 'lootAnalysisDesc', Icon: Gem },
  { key: 'miningStats', titleKey: 'miningStatsTitle', descKey: 'miningStatsDesc', Icon: Pickaxe },
  { key: 'combatLogs', titleKey: 'combatLogsTitle', descKey: 'combatLogsDesc', Icon: Swords },
  {
    key: 'shipFitting',
    titleKey: 'shipFittingTitle',
    descKey: 'shipFittingDesc',
    href: '/dashboard/fits/editor',
    Icon: Layers,
    colorClass: 'text-violet-400',
    bgClass: 'bg-violet-400/10',
    borderClass: 'hover:border-violet-500/50'
  },
  {
    key: 'marketBrowser',
    titleKey: 'marketBrowserTitle',
    descKey: 'marketBrowserDesc',
    href: '/market',
    Icon: ShoppingBag,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-400/10',
    borderClass: 'hover:border-emerald-500/50'
  },
] as const

export function FeaturesSection() {
  const { t } = useTranslations()

  return (
    <section id="features" className="relative py-24 bg-eve-dark overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-eve-accent/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
            {t('home.features.sectionTitle')}
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
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
                className={`group relative p-8 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] ${borderClass} transition-all duration-300 shadow-2xl`}
              >
                {'href' in feature && feature.href ? (
                  <Link
                    href={feature.href}
                    className="absolute inset-0 z-10 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eve-accent"
                    aria-label={t(`home.features.${feature.titleKey}`)}
                  />
                ) : null}
                
                <div className="relative z-0">
                  <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${bgClass} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-7 h-7 ${colorClass}`} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-eve-accent transition-colors">
                    {t(`home.features.${feature.titleKey}`)}
                  </h3>
                  <p className="text-gray-400 leading-relaxed text-[15px]">
                    {t(`home.features.${feature.descKey}`)}
                  </p>
                  
                  {'href' in feature && feature.href && (
                    <div className={`mt-6 flex items-center gap-2 text-sm font-bold ${colorClass} opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0`}>
                      <span>Explore</span>
                      <ArrowRight className="w-4 h-4" />
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
          className="text-center mt-16 flex flex-col sm:flex-row flex-wrap gap-6 justify-center items-center"
        >
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 text-eve-accent hover:text-cyan-300 transition-all font-bold text-lg"
          >
            {t('home.features.cta')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/dashboard/fits/editor"
            className="group inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 transition-all font-bold text-lg"
          >
            {t('home.features.ctaFits')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/market"
            className="group inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-all font-bold text-lg"
          >
            {t('home.features.ctaMarket')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}