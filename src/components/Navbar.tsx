'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import { EXTERNAL_LINKS } from '@/constants/external-links'
import { Github, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-350 ${
          isScrolled
            ? 'bg-[#050b11]/90 backdrop-blur-xl border-eve-border/40 py-2.5 shadow-[0_4px_30px_rgba(0,0,0,0.4)]'
            : 'bg-[#050b11]/40 backdrop-blur-xs border-eve-border/30 py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xs bg-eve-accent/10 border border-eve-accent/35 group-hover:border-eve-accent/80 transition-all duration-300 shadow-eve-accent-glow-xs group-hover:shadow-eve-accent-glow-sm">
                <span className="text-xl font-bold text-eve-accent font-accent tracking-wider">E</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-0.5 font-accent">
                  <span className="text-lg font-bold text-eve-text group-hover:text-eve-accent transition-colors leading-none">
                    Easy
                  </span>
                  <span className="text-lg font-bold text-eve-accent leading-none">Eve</span>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {[
                { href: '#features', label: 'Recursos' },
                { href: '#screenshots', label: 'Imagens' },
                { href: '#roadmap', label: 'Roadmap' },
                { href: '#opensource', label: 'Código aberto' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="relative text-sm font-medium text-eve-muted hover:text-eve-text transition-colors duration-300 py-1.5 group/nav"
                >
                  {link.label}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-eve-accent transition-all duration-300 group-hover/nav:w-full shadow-eve-accent-glow-sm" />
                </a>
              ))}
            </div>

            {/* Side Operations */}
            <div className="hidden lg:flex items-center gap-3">
              <a
                href={EXTERNAL_LINKS.GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-eve-panel border border-eve-border/80 hover:border-eve-accent/50 text-eve-muted hover:text-eve-accent transition-all duration-300 rounded-xs"
                title="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>

              <a
                href={EXTERNAL_LINKS.DISCORD}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-eve-panel border border-eve-border/80 hover:border-eve-accent/50 text-eve-muted hover:text-eve-accent transition-all duration-300 rounded-xs"
                title="Discord"
              >
                <DiscordIcon className="w-4 h-4" />
              </a>

              <div className="h-6 w-px bg-eve-border/60 mx-1.5" />

              <Button variant="eve" size="sm" className="text-sm font-semibold rounded-sm" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
            </div>

            {/* Mobile Toggle */}
            <button
              type="button"
              className="lg:hidden p-2.5 bg-eve-panel border border-eve-border text-eve-muted hover:text-eve-text transition-colors rounded-xs"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-[65px] z-50 bg-[#050b11]/95 backdrop-blur-xl border-t border-eve-border/40">
            <div className="p-6 space-y-6 font-accent">
              <div className="flex flex-col gap-4">
                {[
                  { href: '#features', label: 'Recursos' },
                  { href: '#screenshots', label: 'Imagens' },
                  { href: '#roadmap', label: 'Roadmap' },
                  { href: '#opensource', label: 'Código aberto' },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="block py-3 text-sm font-medium text-eve-muted hover:text-eve-accent border-b border-eve-border/25"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              <div className="space-y-4 pt-6">
                <Button
                  variant="eve"
                  className="w-full font-accent font-bold text-xs uppercase tracking-widest rounded-xs"
                  asChild
                >
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    Entrar
                  </Link>
                </Button>
                
                <div className="flex gap-3">
                  <a
                    href={EXTERNAL_LINKS.GITHUB}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center py-3 bg-eve-panel border border-eve-border text-eve-muted hover:text-eve-accent rounded-xs transition-colors"
                  >
                    <Github className="w-5 h-5" />
                  </a>

                  <a
                    href={EXTERNAL_LINKS.DISCORD}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center py-3 bg-eve-panel border border-eve-border text-eve-muted hover:text-eve-accent rounded-xs transition-colors"
                  >
                    <DiscordIcon className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      <div className="h-[72px]" />
    </>
  )
}
