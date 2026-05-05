'use client'

import { motion } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'
import { EXTERNAL_LINKS } from '@/constants/external-links'
import { Github, MessageSquare } from 'lucide-react'

const STAT_ICONS = ['💻', '⚡', '🗄️', '🎉'] as const

export function OpenSourceBanner() {
  const { t } = useTranslations()

  const stats = [
    {
      labelKey: 'home.openSource.statLanguage' as const,
      valueKey: 'home.openSource.valueTypeScript' as const,
      icon: STAT_ICONS[0],
    },
    {
      labelKey: 'home.openSource.statFramework' as const,
      valueKey: 'home.openSource.valueNextjs' as const,
      icon: STAT_ICONS[1],
    },
    {
      labelKey: 'home.openSource.statDatabase' as const,
      valueKey: 'home.openSource.valuePostgres' as const,
      icon: STAT_ICONS[2],
    },
    {
      labelKey: 'home.openSource.statPrice' as const,
      valueKey: 'home.openSource.valueAlwaysFree' as const,
      icon: STAT_ICONS[3],
    },
  ]

  return (
    <motion.section
      id="opensource"
      className="relative py-32 bg-transparent"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1 }}
    >
      <div className="relative max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/[0.05] rounded-full mb-12"
        >
          <CodeIcon className="w-4 h-4 text-white/40" />
          <span className="text-white/40 font-light text-xs tracking-widest uppercase">{t('home.openSource.badge')}</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-6xl font-extralight text-white mb-8 tracking-tight"
        >
          {t('home.openSource.title')}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-white/40 mb-16 max-w-2xl mx-auto font-light leading-relaxed"
        >
          {t('home.openSource.description')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20"
        >
          {stats.map((stat) => (
            <div key={stat.labelKey} className="p-6 bg-white/[0.01] rounded-2xl border border-white/[0.03] transition-colors hover:bg-white/[0.02]">
              <span className="text-white/20 text-[10px] uppercase tracking-widest font-light block mb-2">{t(stat.labelKey)}</span>
              <p className="text-white/70 font-light tracking-tight">{t(stat.valueKey)}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-6 justify-center"
        >
          <motion.a
            href={EXTERNAL_LINKS.GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -4, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-white/[0.02] border border-white/[0.1] text-white font-light rounded-2xl transition-all duration-300 tracking-wide"
          >
            <Github className="w-5 h-5 opacity-60" />
            {t('home.openSource.githubCta')}
          </motion.a>

          <motion.a
            href={EXTERNAL_LINKS.DISCORD}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -4, backgroundColor: 'rgba(88, 101, 242, 0.15)' }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-[#5865F2]/10 border border-[#5865F2]/20 text-[#5865F2] font-light rounded-2xl transition-all duration-300 tracking-wide"
          >
            <MessageSquare className="w-5 h-5 opacity-60" />
            {t('home.openSource.discordCta')}
          </motion.a>
        </motion.div>
      </div>
    </motion.section>
  )
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  )
}
