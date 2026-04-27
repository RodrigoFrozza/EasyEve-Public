'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PromoBannerViewModel } from '@/lib/promo-banners'
import {
  ArrowRight,
  Check,
  Copy,
  Gift,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'

interface PromoBannerSpotlightProps {
  initialBanners: PromoBannerViewModel[]
}

export function PromoBannerSpotlight({ initialBanners }: PromoBannerSpotlightProps) {
  const router = useRouter()
  const [banners, setBanners] = useState(initialBanners)
  const [claimingBannerId, setClaimingBannerId] = useState<string | null>(null)
  const [dismissingBannerId, setDismissingBannerId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  if (banners.length === 0) {
    return null
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success('Promo code copied')

    window.setTimeout(() => {
      setCopiedCode((current) => current === code ? null : current)
    }, 1500)
  }

  async function handleClaim(bannerId: string) {
    setClaimingBannerId(bannerId)

    try {
      // 1. Send the interaction to the server
      const response = await fetch(`/api/promo-banners/${bannerId}/claim`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process interaction')
      }
      const banner = banners.find(b => b.id === bannerId)
      if (!banner) return

      // 2. Handle different action types
      if (banner.actionType === 'REDIRECT' && banner.actionConfig?.redirectPath) {
        toast.success('Redirecting...')
        router.push(banner.actionConfig.redirectPath)
        return
      }

      if (banner.actionType === 'EXTERNAL_LINK' && banner.actionConfig?.externalUrl) {
        toast.success('Opening link...')
        window.open(banner.actionConfig.externalUrl, '_blank')
        return
      }

      // Default: CLAIM_CODE
      setBanners((current) => current.map((banner) => (
        banner.id === bannerId
          ? {
              ...banner,
              status: 'generated',
              code: data.code,
              redeemPath: data.redeemPath,
            }
          : banner
      )))

      if (data.code) {
        await copyCode(data.code)
      }

      toast.success(data.alreadyGenerated ? 'Your promo code is ready' : 'Reward code generated')

      if (data.redeemPath) {
        router.push(data.redeemPath)
      }
    } catch (error) {
      console.error('Failed to process campaign action:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to process interaction')
    } finally {
      setClaimingBannerId(null)
    }
  }

  async function handleDismiss(bannerId: string) {
    setDismissingBannerId(bannerId)

    try {
      const response = await fetch(`/api/promo-banners/${bannerId}/dismiss`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to dismiss promo banner')
      }

      setBanners((current) => current.filter((banner) => banner.id !== bannerId))
    } catch (error) {
      console.error('Failed to dismiss promo banner:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to dismiss promo banner')
    } finally {
      setDismissingBannerId(null)
    }
  }

  function openRedeemPage(redeemPath: string) {
    router.push(redeemPath)
  }

  return (
    <div className="space-y-4">
      {banners.map((banner) => (
        <div
          key={banner.id}
          className="overflow-hidden bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[32px] shadow-2xl relative group"
        >
          {/* Decorative glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border border-cyan-400/30 bg-cyan-400/15 text-cyan-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] font-outfit rounded-xl">
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  {banner.badgeText || 'New account reward'}
                </Badge>
                {banner.type === 'BANNER' && (
                  <Badge variant="outline" className="border-amber-400/40 text-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] font-outfit rounded-xl bg-amber-400/5">
                    {banner.actionType === 'CLAIM_CODE' ? 'REWARD AVAILABLE' : 'LIMITED TIME'}
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-black tracking-tight text-white font-outfit uppercase">{banner.title}</h2>
                <p className="max-w-2xl text-sm text-zinc-400 font-inter leading-relaxed">{banner.description}</p>
              </div>

              {banner.status === 'generated' && banner.code && (
                <div className="rounded-[24px] border border-cyan-400/20 bg-black/40 p-6 backdrop-blur-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/60 font-outfit">
                    PERSONAL PROMO CODE
                  </p>
                  <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <code className="text-3xl font-black tracking-[0.2em] text-white font-mono">
                      {banner.code}
                    </code>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="outline"
                        className="h-12 px-6 border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 font-black uppercase tracking-widest rounded-xl font-outfit transition-all"
                        onClick={() => copyCode(banner.code!)}
                      >
                        {copiedCode === banner.code ? (
                          <Check className="mr-2 h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="mr-2 h-4 w-4" />
                        )}
                        {copiedCode === banner.code ? 'COPIED' : 'COPY CODE'}
                      </Button>
                      {banner.redeemPath && (
                        <Link href={banner.redeemPath}>
                          <Button className="h-12 px-6 bg-cyan-500 text-black hover:bg-cyan-400 font-black uppercase tracking-widest rounded-xl font-outfit shadow-xl shadow-cyan-500/20 transition-all">
                            OPEN REDEEM PAGE
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-4 lg:w-[320px]">
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-xl group-hover:bg-white/[0.04] transition-all">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-inner">
                    <Gift className="h-7 w-7 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 font-outfit">
                      REWARD STATUS
                    </p>
                    <p className="text-xs text-zinc-400 font-inter mt-1 leading-tight">
                      {banner.status === 'generated'
                        ? 'Your code is ready to redeem'
                        : 'Generate a one-time premium code for this account'}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className={cn(
                  'h-14 rounded-[20px] font-black uppercase tracking-[0.2em] text-[11px] font-outfit transition-all shadow-2xl',
                  banner.status === 'generated'
                    ? 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/10'
                )}
                disabled={claimingBannerId === banner.id}
                onClick={() => (
                  banner.status === 'generated' && banner.redeemPath
                    ? openRedeemPage(banner.redeemPath)
                    : handleClaim(banner.id)
                )}
              >
                {claimingBannerId === banner.id ? (
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                ) : (
                  banner.status === 'generated' && banner.redeemPath
                    ? <ArrowRight className="mr-3 h-4 w-4" />
                    : <Gift className="mr-3 h-4 w-4" />
                )}
                {banner.status === 'generated' ? 'REDEEM NOW' : banner.buttonText.toUpperCase()}
              </Button>

              {banner.dismissible && (
                <Button
                  variant="ghost"
                  className="h-12 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 hover:bg-white/5 font-outfit rounded-xl"
                  disabled={dismissingBannerId === banner.id}
                  onClick={() => handleDismiss(banner.id)}
                >
                  {dismissingBannerId === banner.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-2 h-4 w-4" />
                  )}
                  HIDE THIS BANNER
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
