'use client'

import { useState } from 'react'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import {
  ExternalLink,
  Share2,
  Download,
  Ship,
  Info
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { FitStatsSnapshot } from '@/components/fits/FitStatsSnapshot'
import { FitModuleList } from '@/components/fits/FitModuleList'
import Image from 'next/image'

interface FitClientProps {
  fit: any
}

export default function FitClient({ fit }: FitClientProps) {
  const { t } = useTranslations()
  const [imgError, setImgError] = useState(false)

  const copyEft = () => {
    // Logic to reconstruct EFT string from module list
    // For now, placeholder toast
    toast.success('EFT string copied to clipboard!')
  }

  if (!fit) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
          <Info className="text-red-500 w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold">Fit Unavailable</h1>
        <p className="text-zinc-400">This fit does not exist or has been made private.</p>
        <Button asChild variant="outline">
          <Link href="/">{t('global.backToHome')}</Link>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black text-white selection:bg-blue-500/30">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-20 overflow-hidden">
        {imgError ? (
          <div className="w-full h-full bg-zinc-900 blur-3xl scale-150" />
        ) : (
          <Image 
            src={`https://images.evetech.net/types/${fit.shipId}/render?size=1024`}
            fill
            className="object-cover blur-3xl scale-150"
            alt=""
            onError={() => setImgError(true)}
            priority
          />
        )}
      </div>

      <nav className="relative z-10 border-b border-white/5 bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-8 h-8">
            <Image src="/favicon.png" fill alt="EasyEve" className="object-contain" />
          </div>
          <div>
            <div className="text-xs font-bold text-blue-400 uppercase tracking-tighter">Shared Fit</div>
            <div className="text-sm text-zinc-400 font-medium">EasyEve_ Engine</div>
          </div>
        </div>
        <Link href="/login" className="text-sm font-medium hover:text-blue-400 transition-colors">
          Import to my Dashboard <ExternalLink className="inline w-3 h-3 ml-1" />
        </Link>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Visuals and Stats */}
        <div className="lg:col-span-5 space-y-8">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full scale-75 group-hover:scale-100 transition-transform duration-1000" />
            {imgError ? (
              <div className="relative w-full aspect-square flex items-center justify-center bg-zinc-900/50">
                <Ship className="w-1/2 h-1/2 text-zinc-700 opacity-50" />
              </div>
            ) : (
              <Image 
                src={`https://images.evetech.net/types/${fit.shipId}/render?size=512`}
                alt={fit.ship}
                fill
                className="object-contain drop-shadow-[0_0_50px_rgba(59,130,246,0.3)] animate-float"
                onError={() => setImgError(true)}
                priority
              />
            )}
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight">{fit.name}</h1>
            <h2 className="text-xl text-zinc-400 font-medium">Ship: {fit.ship}</h2>
            {fit.description && <p className="text-zinc-500 leading-relaxed italic border-l-2 border-white/5 pl-4">{fit.description}</p>}
          </div>

          <FitStatsSnapshot stats={fit.esiData as any} />

          <div className="grid grid-cols-2 gap-4">
            <Button onClick={copyEft} className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 shadow-lg shadow-blue-500/20">
              <Download className="w-4 h-4 mr-2" /> Export to EFT
            </Button>
            <Button variant="outline" className="h-12 border-white/5 hover:bg-white/5">
              <Share2 className="w-4 h-4 mr-2" /> Share Link
            </Button>
          </div>
        </div>

        {/* Right Column: Modules */}
        <div className="lg:col-span-7 bg-zinc-900/20 rounded-2xl border border-white/5 p-8 backdrop-blur-sm shadow-2xl">
          <div className="h-[700px]">
            <FitModuleList 
              modules={fit.modules} 
              drones={fit.drones} 
              cargo={fit.cargo} 
              slotHistory={fit.esiData?.slotHistory} 
            />
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-12 text-center text-zinc-600 text-xs">
         &copy; 2024 EasyEve_ • Design inspired by EVE Online • Build Version 2.0 (Fits Overhaul)
      </footer>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
