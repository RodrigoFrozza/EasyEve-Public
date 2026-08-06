'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/motion-easing'
import { Navbar } from '@/components/Navbar'
import { ScreenshotGrid } from '@/components/ScreenshotGrid'
import { OpenSourceBanner } from '@/components/OpenSourceBanner'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { Roadmap } from '@/components/landing/Roadmap'
import { PublicPageChrome } from '@/components/landing/PublicPageChrome'
import { Github, ChevronDown, Terminal, Radio, Shield, HelpCircle } from 'lucide-react'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import { EXTERNAL_LINKS } from '@/constants/external-links'
import { Button } from '@/components/ui/button'

const heroChipDefs = [
  { href: '#features', label: 'Frota', desc: 'Veja quem está voando com você' },
  { href: '#features', label: 'Mineração', desc: 'Registros e divisão de loot' },
  { href: '#features', label: 'Fits', desc: 'Simule encaixes de módulos' },
  { href: '#features', label: 'Mercado', desc: 'Preços e rotas de trade' },
]

export function HomePageClient() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 25, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: EASE_OUT_EXPO },
    },
  }

  return (
    <PublicPageChrome>
      <main id="main-content" className="relative w-full">
        <Navbar />

        <div className="relative z-10 px-6 md:px-12 pt-32 lg:pt-40 pb-20 min-h-[90vh] flex flex-col justify-center max-w-7xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start w-full"
          >
            <motion.p
              variants={itemVariants}
              className="mb-6 text-sm text-eve-muted"
            >
              Versão beta · Login seguro com a CCP
            </motion.p>

            <motion.div variants={itemVariants} className="mb-6 font-accent">
              <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-none">
                <span className="text-eve-text">Easy</span>
                <span className="text-eve-accent ml-1 sm:ml-2 relative">
                  Eve
                  <span className="absolute -top-1 -right-10 text-xs font-medium border border-eve-accent/30 text-eve-accent bg-eve-accent/5 px-1.5 py-0.5 rounded-sm">
                    Beta
                  </span>
                </span>
              </h1>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="max-w-2xl mb-12 border-l-2 border-eve-accent/40 pl-6 py-1"
            >
              <p className="text-base sm:text-lg text-eve-muted leading-relaxed">
                Organize frota, personagens, mineração e mercado do EVE Online em um painel
                simples. Feito por jogadores, com código aberto.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-center w-full max-w-4xl"
            >
              <Button variant="eve" size="lg" className="rounded-sm h-auto px-8 py-3 text-sm font-semibold" asChild>
                <Link href="/login" className="gap-2">
                  <Terminal className="w-4 h-4" />
                  <span>Entrar com EVE Online</span>
                </Link>
              </Button>

              <div className="flex flex-wrap gap-3">
                {[
                  { href: '/dashboard', label: 'Painel' },
                  { href: '/dashboard/fits/editor', label: 'Simulador de fit' },
                  { href: '/market', label: 'Mercado' },
                ].map((btn) => (
                  <Link
                    key={btn.href}
                    href={btn.href}
                    className="flex items-center justify-center px-5 py-3 bg-eve-panel border border-eve-border/60 text-eve-muted hover:text-eve-text hover:border-eve-accent/50 hover:bg-eve-accent/5 transition-all duration-300 text-sm font-medium rounded-sm"
                  >
                    {btn.label}
                  </Link>
                ))}
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="mt-20 w-full max-w-5xl">
              <p className="text-sm text-eve-muted mb-4 flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-eve-accent/60" />
                <span>Destaques</span>
              </p>
              <ul
                role="list"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-eve-border/30 pt-6"
              >
                {heroChipDefs.map(({ href, label, desc }) => (
                  <li key={label} className="list-none">
                    <a
                      href={href}
                      className="relative block p-4 bg-eve-panel border border-eve-border/40 hover:border-eve-accent/40 hover:bg-eve-accent/[0.02] rounded-xs transition-all duration-300 shadow-eve-accent-glow-xs group overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-eve-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-eve-border group-hover:bg-eve-accent transition-colors" />
                        <span className="text-sm font-semibold text-eve-text group-hover:text-eve-accent transition-colors">
                          {label}
                        </span>
                      </div>
                      <span className="text-xs text-eve-muted block ml-4">{desc}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none">
            <span className="text-xs text-eve-muted">Role para ver mais</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
              <ChevronDown className="w-5 h-5 text-eve-accent/80" />
            </motion.div>
          </div>
        </div>

        <div className="relative z-10 bg-gradient-to-b from-transparent via-eve-dark/80 to-[#010204]">
          <ScreenshotGrid />
          <FeaturesSection />
          <Roadmap />
          <OpenSourceBanner />
        </div>

        <footer className="relative z-20 py-24 border-t border-eve-border/30 bg-eve-dark overflow-hidden text-eve-muted">
          <div className="absolute inset-0 bg-transparent tech-grid-bg opacity-[0.03] pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
              <div className="lg:col-span-2 space-y-6">
                <Link href="/" className="flex items-center gap-2 group">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xs bg-eve-accent/10 border border-eve-accent/30">
                    <span className="text-sm font-bold text-eve-accent">E</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-eve-text leading-none font-accent">
                      Easy<span className="text-eve-accent">Eve</span>
                    </span>
                  </div>
                </Link>
                <p className="text-eve-muted text-sm leading-relaxed max-w-md">
                  Ferramentas para pilotos de EVE Online. Projeto independente, não oficial da
                  CCP Games.
                </p>
                <div className="flex items-center gap-3">
                  <a
                    href={EXTERNAL_LINKS.GITHUB}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-eve-panel border border-eve-border/60 hover:border-eve-accent/50 hover:text-eve-accent transition-all duration-300 rounded-xs text-eve-muted"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                  <a
                    href={EXTERNAL_LINKS.DISCORD}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-eve-panel border border-eve-border/60 hover:border-eve-accent/50 hover:text-eve-accent transition-all duration-300 rounded-xs text-eve-muted"
                  >
                    <DiscordIcon className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-eve-text font-semibold text-sm flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-eve-accent/80" />
                  <span>Navegação</span>
                </h4>
                <ul className="space-y-2">
                  {[
                    { id: 'features', label: 'Recursos' },
                    { id: 'screenshots', label: 'Imagens' },
                    { id: 'roadmap', label: 'Roadmap' },
                    { id: 'opensource', label: 'Código aberto' },
                  ].map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="text-eve-muted hover:text-eve-accent transition-colors text-sm block"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-6">
                <h4 className="text-eve-text font-semibold text-sm flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-eve-accent/80" />
                  <span>Comunidade</span>
                </h4>
                <ul className="space-y-2">
                  <li>
                    <a
                      href={EXTERNAL_LINKS.GITHUB}
                      target="_blank"
                      className="text-eve-muted hover:text-eve-accent transition-colors text-sm"
                    >
                      GitHub
                    </a>
                  </li>
                  <li>
                    <a
                      href={EXTERNAL_LINKS.DISCORD}
                      target="_blank"
                      className="text-eve-muted hover:text-eve-accent transition-colors text-sm"
                    >
                      Discord
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-10 border-t border-eve-border/20 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="space-y-2">
                <p className="text-eve-muted/80 text-xs leading-relaxed">
                  EVE Online e imagens relacionadas são marcas registradas da CCP hf.
                </p>
                <p className="text-eve-muted/80 text-xs leading-relaxed">
                  O EasyEve é independente e não é endossado oficialmente pela CCP Games.
                </p>
              </div>
              <div className="text-right">
                <p className="text-eve-muted text-xs">
                  &copy; {new Date().getFullYear()} EasyEve
                </p>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </PublicPageChrome>
  )
}
