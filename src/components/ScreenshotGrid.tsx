'use client'

import { HomepageCarousel } from './HomepageCarousel'
import Link from 'next/link'

export function ScreenshotGrid() {
  return (
    <section
      id="screenshots"
      className="relative py-24 md:py-32 bg-gradient-to-b from-transparent to-eve-dark/80 border-y border-eve-border/30 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12 space-y-3 max-w-2xl">
          <p className="text-sm font-medium text-eve-accent">Painel</p>
          <h2 className="text-3xl md:text-4xl font-bold text-eve-text font-accent tracking-tight">
            Veja como é por dentro
          </h2>
          <p className="text-base text-eve-muted leading-relaxed">
            Telas reais do aplicativo: leitura rápida, poucos cliques e foco no que importa no
            jogo.
          </p>
        </div>

        <div className="relative border border-eve-border/50 bg-eve-panel/75 p-3 rounded-sm">
          <div className="bg-eve-dark overflow-hidden rounded-sm p-1">
            <HomepageCarousel />
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-eve-border/20 pt-6">
          <p className="text-sm text-eve-muted">
            Dados sincronizados com a API oficial do EVE Online.
          </p>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-eve-muted hover:text-eve-accent transition-colors"
          >
            Abrir painel →
          </Link>
        </div>
      </div>
    </section>
  )
}
