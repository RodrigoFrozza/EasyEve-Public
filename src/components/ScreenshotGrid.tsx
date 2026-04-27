'use client'

import { motion } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'
import { ImageWithFallback } from './ImageWithFallback'

const screenshotIds = ['image1', 'image2', 'image3', 'image4'] as const

export function ScreenshotGrid() {
  const { t } = useTranslations()

  return (
    <section id="screenshots" className="relative py-20 bg-eve-dark">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-eve-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            {t('home.screenshots.sectionTitle')}
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            {t('home.screenshots.sectionDescription')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {screenshotIds.map((id, index) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative"
            >
              <div className="relative rounded-2xl overflow-hidden border border-eve-border/30 bg-eve-panel/30 hover:border-eve-accent/50 transition-all duration-300">
                <div className="absolute inset-0 bg-eve-accent/0 group-hover:bg-eve-accent/5 transition-colors duration-300" />

                <div className="aspect-video relative">
                  <ImageWithFallback
                    src={id}
                    alt={t(`home.screenshots.${id}Alt`)}
                    className="w-full h-full"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <div className="p-4 border-t border-eve-border/30">
                  <p className="text-gray-400 text-sm group-hover:text-white transition-colors">
                    {t(`home.screenshots.${id}Alt`)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12"
        >
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-eve-accent hover:text-cyan-300 transition-colors font-medium"
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
