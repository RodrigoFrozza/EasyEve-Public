'use client'

import { motion } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/motion-easing'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const roadmapItems = [
  {
    title: 'Acompanhamento de frota',
    status: 'completed' as const,
    description:
      'Veja quem está na frota, onde estão os pilotos e quais personagens estão ativos, com dados atualizados do jogo.',
  },
  {
    title: 'Divisão de loot',
    status: 'completed' as const,
    description:
      'Registre o que cada piloto recebeu e calcule a divisão de forma automática, sem planilhas manuais.',
  },
  {
    title: 'Relatório de mineração',
    status: 'completed' as const,
    description:
      'Acompanhe o que foi minerado por personagem e consulte valores com base nos preços do mercado.',
  },
  {
    title: 'Simulador de fit',
    status: 'completed' as const,
    description:
      'Monte e teste fits de naves com os atributos oficiais do jogo antes de comprar módulos.',
  },
  {
    title: 'Mercado entre regiões',
    status: 'inProgress' as const,
    description:
      'Compare preços em diferentes regiões e encontre rotas de trade mais interessantes.',
  },
  {
    title: 'Análise de combate',
    status: 'inProgress' as const,
    description:
      'Revise logs de PvP, dano recebido e perdas de ISK em uma visão mais clara.',
  },
]

const statusLabel = {
  completed: 'Pronto',
  inProgress: 'Em desenvolvimento',
} as const

export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="relative py-24 md:py-32 bg-gradient-to-b from-[#010204] to-[#03070c] overflow-hidden"
    >
      <div className="max-w-3xl mx-auto px-6 relative z-10">
        <div className="mb-14 space-y-3 text-center md:text-left">
          <p className="text-sm font-medium text-eve-accent">Roadmap</p>
          <h2 className="text-3xl md:text-4xl font-bold text-eve-text font-accent tracking-tight">
            O que já está pronto e o que vem a seguir
          </h2>
          <p className="text-base text-eve-muted leading-relaxed max-w-2xl">
            Priorizamos funções que ajudam no dia a dia no EVE Online. Itens marcados como
            &quot;Em desenvolvimento&quot; estão em construção.
          </p>
        </div>

        <ol className="relative space-y-6 border-l border-eve-border/50 pl-8 md:pl-10">
          {roadmapItems.map((item, index) => {
            const isCompleted = item.status === 'completed'

            return (
              <motion.li
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
                className="relative list-none"
              >
                <span
                  className={cn(
                    'absolute -left-[2.125rem] md:-left-[2.375rem] top-6 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-[#050b11]',
                    isCompleted
                      ? 'border-emerald-500/80 text-emerald-500'
                      : 'border-eve-accent/80 text-eve-accent'
                  )}
                  aria-hidden
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </span>

                <article className="eve-public-panel rounded-sm p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium',
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          : 'bg-eve-accent/10 text-eve-accent border border-eve-accent/25'
                      )}
                    >
                      {statusLabel[item.status]}
                    </span>
                    <span className="text-xs text-eve-muted">Etapa {index + 1}</span>
                  </div>

                  <h3 className="text-lg font-semibold text-eve-text font-accent mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-eve-muted leading-relaxed">{item.description}</p>
                </article>
              </motion.li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
