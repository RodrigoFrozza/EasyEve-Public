'use client'

import { motion } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'

const stats = [
  { key: 'openSource', value: '100%' },
  { key: 'hosted', value: 'Cloud' },
  { key: 'secure', value: 'Safe' },
  { key: 'mobile', value: 'Full' },
]

export function SocialProof() {
  const { t } = useTranslations()

  return (
    <section id="about" className="relative py-32 bg-transparent">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-extralight text-white mb-6 tracking-tight">
            {t('home.socialProof.title')}
          </h2>
          <p className="text-base md:text-lg text-white/40 max-w-2xl mx-auto font-light leading-relaxed">
            {t('home.socialProof.description')}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center p-6 rounded-2xl bg-white/[0.01] border border-white/[0.02]"
            >
              <div className="text-3xl md:text-5xl font-extralight text-white/80 mb-3 tracking-tighter">
                {stat.value}
              </div>
              <div className="text-white/60 font-light text-sm uppercase tracking-widest mb-2">{t(`home.socialProof.${stat.key}`)}</div>
              <div className="text-white/30 text-xs font-light">{t(`home.socialProof.${stat.key}Desc`)}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}