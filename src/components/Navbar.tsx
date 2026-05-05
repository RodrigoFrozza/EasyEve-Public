'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
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
            <Link href="/" className="flex items-center gap-4 group px-3 py-2 rounded-2xl hover:bg-white/[0.02] transition-all duration-500">
              <motion.div
                className="w-10 h-10 rounded-full bg-black border border-white/[0.1] flex items-center justify-center shadow-2xl relative overflow-hidden group/planet"
                whileHover={{ scale: 1.05 }}
              >
                {/* Planet Depth & Atmosphere */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08)_0%,transparent_60%)]" />
                <div className="absolute inset-0 shadow-[inset_-5px_-5px_15px_rgba(0,0,0,0.9),inset_3px_3px_15px_rgba(255,255,255,0.03)]" />
                <div className="absolute inset-0 rounded-full border border-white/10 opacity-30" />
                
                <span className="text-xl font-bold text-white/90 relative z-10 tracking-tighter">E</span>
              </motion.div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extralight tracking-[0.1em] text-white/90 group-hover:text-white transition-colors leading-none uppercase">
                    EasyEve
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.1] text-[8px] font-light text-white/40 tracking-[0.2em] leading-none uppercase">
                    {t('common.beta')}
                  </span>
                </div>
                <span className="text-[9px] font-light text-white/20 uppercase tracking-[0.3em] leading-none mt-1.5">
                  Deep Space Outpost
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {[
                { href: '#features', label: t('home.nav.features') },
                { href: '#screenshots', label: t('home.nav.screenshots') },
                { href: '#roadmap', label: t('home.nav.roadmap') },
                { href: '#about', label: t('home.nav.about') },
                { href: '#opensource', label: t('home.nav.openSource') },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-5 py-2 text-white/30 hover:text-white/80 hover:bg-white/[0.02] rounded-full transition-all text-xs font-light tracking-widest uppercase"
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
                 <DiscordIcon className="w-5 h-5" />
               </motion.a>

               <div className="h-6 w-px bg-white/10 mx-1" />

               <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                 <Link
                   href="/login"
                   className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.03] border border-white/10 text-white/90 font-light text-sm rounded-xl hover:bg-white/[0.06] hover:border-eve-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eve-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black transition-all"
                 >
                   {t('login.loginWithESI')}
                 </Link>
               </motion.div>

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
                  { href: '#roadmap', label: t('home.nav.roadmap') },
                  { href: '#about', label: t('home.nav.about') },
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
