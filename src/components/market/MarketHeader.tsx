'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { MessageSquare, LogIn, ExternalLink, Globe } from 'lucide-react'
import { EXTERNAL_LINKS } from '@/constants/external-links'
import { DiscordIcon } from '@/components/shared/DiscordIcon'

export function MarketHeader() {
  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-md bg-eve-dark/60 border-b border-eve-border/30">
      <div className="max-w-[1800px] mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-eve-accent to-cyan-400 flex items-center justify-center shadow-lg shadow-eve-accent/20"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <span className="text-xl font-black text-black italic">E</span>
          </motion.div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tighter text-white group-hover:text-eve-accent transition-colors leading-none uppercase font-outfit">
              EasyEve
            </span>
            <span className="text-[10px] font-bold text-eve-accent/50 uppercase tracking-[0.2em] leading-none mt-1 font-inter">
              Market Browser
            </span>
          </div>
        </Link>

        {/* Action Links */}
        <div className="flex items-center gap-4">
          <motion.a
            href={EXTERNAL_LINKS.DISCORD}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#5865F2]/10 border border-[#5865F2]/20 text-[#5865F2] hover:bg-[#5865F2]/20 rounded-xl transition-all font-bold text-xs font-inter"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <DiscordIcon className="w-4 h-4" />
            Join Discord
            <ExternalLink className="w-3 h-3 opacity-50" />
          </motion.a>

          <div className="h-8 w-px bg-eve-border/30 mx-1 hidden sm:block" />

          <Link href="/login">
            <motion.div
              className="flex items-center gap-2 px-6 py-2 bg-white text-black hover:bg-zinc-200 rounded-xl transition-all font-black text-xs uppercase tracking-widest font-outfit shadow-xl shadow-white/5"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogIn className="w-4 h-4" />
              Login with EasyEve
            </motion.div>
          </Link>
        </div>
      </div>
    </nav>
  )
}
