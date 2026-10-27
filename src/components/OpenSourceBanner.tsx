'use client'

import { EXTERNAL_LINKS } from '@/constants/external-links'
import { Github } from 'lucide-react'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import { motion } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/motion-easing'

const stats = [
  { label: 'Linguagem', value: 'TypeScript' },
  { label: 'App', value: 'Next.js 14' },
  { label: 'Banco', value: 'PostgreSQL' },
  { label: 'Status', value: 'Beta público' },
]

export function OpenSourceBanner() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: EASE_OUT_EXPO },
    },
  }

  return (
    <section
      id="opensource"
      className="relative py-24 md:py-32 bg-[#03070c] border-t border-eve-border/30 overflow-hidden"
    >
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-[300px] bg-eve-accent-radial-soft pointer-events-none z-0 opacity-80" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="mb-12 space-y-3 max-w-2xl">
          <p className="text-sm font-medium text-eve-accent">Código aberto</p>
          <h2 className="text-3xl md:text-4xl font-bold text-eve-text font-accent tracking-tight">
            Transparente e colaborativo
          </h2>
          <p className="text-base text-eve-muted leading-relaxed">
            O código está no GitHub. Você pode auditar, sugerir mudanças ou rodar o projeto na sua
            máquina.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className="eve-public-panel p-5 rounded-sm"
            >
              <span className="text-xs text-eve-muted block mb-1">{stat.label}</span>
              <p className="text-eve-text text-base font-semibold">{stat.value}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          <motion.a
            href={EXTERNAL_LINKS.GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            variants={itemVariants}
            className="eve-public-panel p-6 rounded-sm flex items-start gap-4 group"
          >
            <div className="p-3 bg-eve-accent/5 border border-eve-border rounded-sm text-eve-muted group-hover:text-eve-accent transition-colors">
              <Github className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-eve-text group-hover:text-eve-accent transition-colors">
                Repositório no GitHub
              </h3>
              <p className="text-sm text-eve-muted leading-relaxed">
                Veja o código, abra issues e envie pull requests.
              </p>
            </div>
          </motion.a>

          <motion.a
            href={EXTERNAL_LINKS.DISCORD}
            target="_blank"
            rel="noopener noreferrer"
            variants={itemVariants}
            className="eve-public-panel p-6 rounded-sm flex items-start gap-4 group"
          >
            <div className="p-3 bg-eve-accent/5 border border-eve-border rounded-sm text-eve-muted group-hover:text-eve-accent transition-colors">
              <DiscordIcon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-eve-text group-hover:text-eve-accent transition-colors">
                Comunidade no Discord
              </h3>
              <p className="text-sm text-eve-muted leading-relaxed">
                Tire dúvidas, reporte bugs e converse com outros jogadores.
              </p>
            </div>
          </motion.a>
        </motion.div>

        <p className="mt-12 text-sm text-eve-muted border-t border-eve-border/20 pt-6">
          Licença MIT.
        </p>
      </div>
    </section>
  )
}
