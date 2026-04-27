'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useTranslations } from '@/i18n/hooks'
import { EXTERNAL_LINKS } from '@/constants/external-links'
import { Github, MessageSquare, Code, Menu, X, ExternalLink } from 'lucide-react'

export function Navbar() {
  const { t } = useTranslations()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b transition-all duration-500 ${
          isScrolled 
            ? 'bg-eve-dark/85 border-eve-border/30 py-2' 
            : 'bg-transparent border-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group px-2 py-1 rounded-lg hover:bg-white/[0.03] transition-all duration-300">
              <motion.div
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-eve-accent to-cyan-400 flex items-center justify-center shadow-lg shadow-eve-accent/20"
                whileHover={{ scale: 1.05, rotate: 5 }}
              >
                <span className="text-xl font-black text-black">E</span>
              </motion.div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black tracking-tight text-white group-hover:text-eve-accent transition-colors leading-none">
                    EasyEve
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-eve-accent/10 border border-eve-accent/20 text-[9px] font-black text-eve-accent leading-none">
                    {t('common.beta').toUpperCase()}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-eve-accent/50 uppercase tracking-widest leading-none mt-1">
                  Cloud
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {[
                { href: '#features', label: t('home.nav.features') },
                { href: '#screenshots', label: t('home.nav.screenshots') },
                { href: '#opensource', label: t('home.nav.openSource') },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-full transition-all text-sm font-semibold"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <motion.a
                href={EXTERNAL_LINKS.GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-white/[0.1] transition-all text-gray-400 hover:text-white"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                title={t('home.nav.githubRepo')}
              >
                <Github className="w-5 h-5" />
              </motion.a>

              <motion.a
                href={EXTERNAL_LINKS.DISCORD}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20 hover:bg-[#5865F2]/20 hover:border-[#5865F2]/30 transition-all text-[#5865F2] hover:text-white"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                title={t('home.nav.joinDiscord')}
              >
                <MessageSquare className="w-5 h-5" />
              </motion.a>

              <div className="h-6 w-px bg-white/10 mx-1" />

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href={EXTERNAL_LINKS.GITHUB}
                  target="_blank"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-eve-accent/20 to-cyan-500/20 border border-eve-accent/30 text-eve-accent font-bold text-sm rounded-xl hover:from-eve-accent/30 hover:to-cyan-500/30 transition-all shadow-lg shadow-eve-accent/10"
                >
                  <Code className="w-4 h-4" />
                  {t('home.nav.openSourceCta')}
                </Link>
              </motion.div>
            </div>

            <motion.button
              type="button"
              className="md:hidden p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-gray-400 hover:text-white transition-all"
              aria-expanded={isMobileMenuOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              whileTap={{ scale: 0.9 }}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              id="landing-mobile-nav"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-eve-dark/95 backdrop-blur-2xl border-t border-white/[0.05] overflow-hidden"
            >
              <div className="px-6 py-8 space-y-4">
                {[
                  { href: '#features', label: t('home.nav.features') },
                  { href: '#screenshots', label: t('home.nav.screenshots') },
                  { href: '#opensource', label: t('home.nav.openSource') },
                ].map((link) => (
                  <a 
                    key={link.href}
                    href={link.href} 
                    className="block text-xl font-bold text-gray-400 hover:text-eve-accent transition-colors py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}

                <div className="pt-6 border-t border-white/5 space-y-4">
                  <a
                    href={EXTERNAL_LINKS.GITHUB}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl text-white group hover:bg-white/[0.06] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-black/20 rounded-lg">
                        <Github className="w-5 h-5 text-gray-400 group-hover:text-white" />
                      </div>
                      <span className="font-bold">{t('home.nav.github')}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                  </a>

                  <a
                    href={EXTERNAL_LINKS.DISCORD}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-2xl text-white group hover:bg-[#5865F2]/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#5865F2]/20 rounded-lg">
                        <MessageSquare className="w-5 h-5 text-[#5865F2]" />
                      </div>
                      <span className="font-bold">{t('home.nav.discord')}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <div className="h-16" />
    </>
  )
}
