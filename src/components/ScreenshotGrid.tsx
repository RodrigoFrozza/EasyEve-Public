'use client'

import { motion } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'
import { HomepageCarousel } from './HomepageCarousel'

export function ScreenshotGrid() {
  const { t } = useTranslations()

  return (
    <section id="screenshots" className="relative pt-40 pb-24 bg-transparent">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-extralight text-white mb-6 tracking-tight">
            {t('home.screenshots.sectionTitle')}
          </h2>
          <p className="text-base md:text-lg text-white/40 max-w-2xl mx-auto font-light leading-relaxed">
            {t('home.screenshots.sectionDescription')}
          </p>
        </motion.div>

        <div className="w-full rounded-3xl overflow-hidden border border-white/[0.03] bg-white/[0.01] shadow-2xl backdrop-blur-xl">
          <HomepageCarousel />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-16"
        >
          <a
            href="/dashboard"
            className="inline-flex items-center gap-3 text-white/50 hover:text-white transition-colors font-light text-sm uppercase tracking-widest group"
          >
            {t('home.screenshots.ctaDashboard')}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
