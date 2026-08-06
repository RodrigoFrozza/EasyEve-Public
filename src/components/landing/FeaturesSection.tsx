'use client'

import { motion } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/motion-easing'
import {
  Users,
  Pickaxe,
  TrendingUp,
  Crosshair,
  Wrench,
  Code2,
} from 'lucide-react'

const features = [
  {
    icon: Users,
    title: 'Frota',
    description: 'Veja composição da frota e quem está voando com você em tempo quase real.',
  },
  {
    icon: Pickaxe,
    title: 'Mineração',
    description: 'Registre yields e divida resultados entre os pilotos do grupo.',
  },
  {
    icon: TrendingUp,
    title: 'Mercado',
    description: 'Consulte preços e rotas para tomar decisões de trade com mais clareza.',
  },
  {
    icon: Crosshair,
    title: 'Atividades',
    description: 'Acompanhe missões, combate e outras atividades detectadas nos seus personagens.',
  },
  {
    icon: Wrench,
    title: 'Fits',
    description: 'Simule encaixes de módulos e atributos da nave antes de gastar ISK.',
  },
  {
    icon: Code2,
    title: 'Código aberto',
    description: 'O projeto é aberto: você pode revisar, sugerir melhorias ou rodar por conta própria.',
  },
]

export function FeaturesSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: EASE_OUT_EXPO },
    },
  }

  return (
    <section
      id="features"
      className="relative py-24 md:py-32 bg-gradient-to-b from-eve-dark/80 to-[#010204] border-y border-eve-border/30"
    >
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="mb-14 space-y-3 max-w-2xl">
          <p className="text-sm font-medium text-eve-accent">Recursos</p>
          <h2 className="text-3xl md:text-4xl font-bold text-eve-text font-accent tracking-tight">
            O que o EasyEve faz por você
          </h2>
          <p className="text-base text-eve-muted leading-relaxed">
            Ferramentas pensadas para quem joga EVE Online e quer organizar frota, finanças e
            personagens em um só lugar.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
                className="eve-public-panel p-6 rounded-sm"
              >
                <div className="flex flex-col gap-4">
                  <div className="w-11 h-11 flex items-center justify-center bg-eve-accent/5 border border-eve-border rounded-sm">
                    <Icon className="w-5 h-5 text-eve-accent" strokeWidth={1.5} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-eve-text font-accent">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-eve-muted leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        <p className="mt-12 text-sm text-eve-muted border-t border-eve-border/20 pt-6">
          Login feito com a autenticação oficial da CCP. O EasyEve não pede sua senha do jogo.
        </p>
      </div>
    </section>
  )
}
