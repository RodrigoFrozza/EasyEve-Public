'use client'

import { motion } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'

const stats = [
  { key: 'openSource', value: '100%' },
  { key: 'hosted', value: 'Cloud' },
]

export function SocialProof() {
  const { t } = useTranslations()

  return (
    <section className="relative py-16 bg-gradient-to-r from-eve-panel via-eve-dark to-eve-panel">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            {t('home.socialProof.title')}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
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
              className="text-center p-4"
            >
              <div className="text-3xl md:text-4xl font-black text-eve-accent mb-1">
                {stat.value}
              </div>
              <div className="text-white font-semibold">{t(`home.socialProof.${stat.key}`)}</div>
              <div className="text-gray-500 text-sm">{t(`home.socialProof.${stat.key}Desc`)}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}