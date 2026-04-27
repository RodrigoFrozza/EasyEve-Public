'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  ArrowRight, 
  Gift, 
  Globe, 
  Sparkles, 
  X 
} from 'lucide-react'

interface CampaignPreviewProps {
  data: any
}

export function CampaignPreview({ data }: CampaignPreviewProps) {
  const isBanner = data.type === 'BANNER'
  const isPopup = data.type === 'POPUP'
  const isToast = data.type === 'TOAST'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Real-time Preview</h3>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
          Live View
        </Badge>
      </div>

      <div className="relative min-h-[300px] rounded-[32px] border border-eve-border bg-eve-dark/50 flex items-center justify-center p-8 overflow-hidden">
        {/* Abstract background for context */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#00f2ff_0%,transparent_50%)]" />
        </div>

        {isBanner && (
          <div className="w-full max-w-2xl overflow-hidden bg-zinc-950/60 backdrop-blur-md border border-white/10 rounded-[32px] shadow-2xl relative group">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full" />
            
            <div className="relative z-10 flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="border border-cyan-400/30 bg-cyan-400/15 text-cyan-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] font-outfit rounded-xl">
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    {data.badgeText || 'PROMO REWARD'}
                  </Badge>
                  {data.actionType === 'CLAIM_CODE' && (
                    <Badge variant="outline" className="border-amber-400/40 text-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] font-outfit rounded-xl bg-amber-400/5">
                      {data.actionConfig?.codeType?.replace(/_/g, ' ') || '7 DAYS PREMIUM'}
                    </Badge>
                  )}
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl font-black tracking-tight text-white font-outfit uppercase truncate max-w-[400px]">
                    {data.title || 'Your Campaign Title'}
                  </h2>
                  <p className="max-w-md text-xs text-zinc-400 font-inter leading-relaxed line-clamp-2">
                    {data.description || 'Campaign description goes here. This is how users will see your message on their dashboard.'}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-stretch gap-3 lg:w-[220px]">
                <Button className="h-12 bg-cyan-500 text-black hover:bg-cyan-400 font-black uppercase tracking-[0.1em] text-[10px] font-outfit rounded-xl shadow-xl shadow-cyan-500/10">
                  {data.actionType === 'CLAIM_CODE' ? <Gift className="mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  {data.buttonText || 'TAKE ACTION'}
                </Button>
                {data.dismissible && (
                  <p className="text-[9px] text-center font-bold text-zinc-600 uppercase tracking-widest cursor-pointer hover:text-zinc-400">
                    HIDE THIS BANNER
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {isPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-none">
            <div className="w-full max-w-sm bg-eve-panel border border-eve-border rounded-[32px] p-8 shadow-2xl relative pointer-events-auto">
              <button className="absolute top-6 right-6 text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex flex-col items-center text-center gap-6">
                <div className="h-20 w-20 rounded-[24px] bg-eve-accent/10 flex items-center justify-center border border-eve-accent/20">
                  <Sparkles className="h-10 w-10 text-eve-accent" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white font-outfit uppercase">{data.title || 'Special Alert'}</h3>
                  <p className="text-sm text-gray-400">{data.description || 'This popup will grab the user\'s full attention.'}</p>
                </div>

                <Button className="w-full h-12 bg-eve-accent text-black font-black uppercase tracking-widest rounded-2xl hover:bg-eve-accent/80 transition-all">
                  {data.buttonText || 'Accept Reward'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {isToast && (
          <div className="absolute bottom-8 right-8 w-[350px] bg-zinc-950 border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
            <div className="h-10 w-10 shrink-0 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
              <Megaphone className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{data.title || 'Notification'}</p>
              <p className="text-[10px] text-gray-500 truncate">{data.description || 'Brief message...'}</p>
            </div>
            <Button size="sm" className="h-8 bg-white text-black font-bold text-[10px] rounded-lg">
              {data.buttonText || 'GO'}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4">
        <p className="text-[10px] text-amber-200/60 font-bold uppercase tracking-widest mb-1">Integration Note</p>
        <p className="text-xs text-amber-200/40">
          The action <span className="text-amber-200/80 font-bold">{data.actionType}</span> will be triggered automatically using the system&apos;s 
          central campaign handler.
        </p>
      </div>
    </div>
  )
}

function Megaphone(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  )
}
