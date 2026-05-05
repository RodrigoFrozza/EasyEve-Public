'use client'

import { motion } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight,
  Pickaxe,
  Swords,
  Rocket,
  Gem,
  Layers,
  TrendingUp,
  Box,
  Factory,
  Database,
  Users,
  Wallet
} from 'lucide-react'

export function Roadmap() {
  const { t } = useTranslations()

  const currentFeatures = [
    { key: 'mining', Icon: Pickaxe },
    { key: 'abyssal', Icon: Swords },
    { key: 'ratting', Icon: Rocket },
    { key: 'exploration', Icon: Gem },
  ]

  const futureFeatures = [
    { key: 'fitting', Icon: Layers },
    { key: 'market', Icon: TrendingUp },
    { key: 'pi', Icon: Box },
    { key: 'industry', Icon: Factory },
    { key: 'assets', Icon: Database },
    { key: 'more', Icon: Users },
  ]

  return (
    <section id="roadmap" className="relative py-32 bg-transparent overflow-hidden">
      {/* Subtle separator */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-24"
        >
          <h2 className="text-4xl md:text-6xl font-extralight text-white mb-6 tracking-tight">
            {t('home.roadmap.title')}
          </h2>
          <p className="text-base md:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed font-light">
            {t('home.roadmap.subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Active Now */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative p-10 rounded-3xl bg-white/[0.01] backdrop-blur-xl border border-white/[0.03] shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-10">
              <div className="flex h-1.5 w-1.5 rounded-full bg-white/50 animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
              <h3 className="text-xl font-light text-white uppercase tracking-[0.2em]">
                {t('home.roadmap.now.title')}
              </h3>
            </div>

            <div className="space-y-4">
              {currentFeatures.map((item) => (
                <div 
                  key={item.key}
                  className="flex items-center gap-5 p-5 rounded-2xl bg-white/[0.01] border border-white/[0.02] group hover:bg-white/[0.03] transition-all duration-500"
                >
                  <div className="p-3 rounded-full border border-white/5 text-white/50 group-hover:text-white/80 transition-colors">
                    <item.Icon className="w-4 h-4" />
                  </div>
                  <span className="text-white/70 font-light text-sm">{t(`home.roadmap.now.${item.key}`)}</span>
                  <CheckCircle2 className="w-4 h-4 text-white/20 ml-auto" />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Coming Soon */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative p-10 rounded-3xl bg-white/[0.01] backdrop-blur-xl border border-white/[0.03] shadow-[0_0_30px_rgba(255,255,255,0.01)]"
          >
            <div className="flex items-center gap-4 mb-10">
              <div className="flex h-1.5 w-1.5 rounded-full bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.1)]" />
              <h3 className="text-xl font-light text-white/50 uppercase tracking-[0.2em]">
                {t('home.roadmap.next.title')}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {futureFeatures.map((item) => (
                <div 
                  key={item.key}
                  className="flex flex-col gap-4 p-5 rounded-2xl bg-white/[0.01] border border-white/[0.02] group hover:bg-white/[0.02] transition-all duration-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-full border border-white/5 text-white/30 group-hover:text-white/60 transition-colors">
                      <item.Icon className="w-4 h-4" />
                    </div>
                    <Circle className="w-3 h-3 text-white/10" />
                  </div>
                  <span className="text-sm text-white/40 font-light tracking-wide group-hover:text-white/60 transition-colors">
                    {t(`home.roadmap.next.${item.key}`)}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-10 pt-8 border-t border-white/[0.02]">
              <p className="text-xs text-white/30 font-light text-center tracking-wide">
                Suggest a feature on our <a href="https://discord.gg/easyeve" className="text-white/60 hover:text-white transition-colors">Discord</a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
