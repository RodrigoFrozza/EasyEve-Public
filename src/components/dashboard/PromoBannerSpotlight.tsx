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
      const response = await fetch(`/api/promo-banners/${bannerId}/claim`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process interaction')
      }
      const banner = banners.find(b => b.id === bannerId)
      if (!banner) return

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
          className="overflow-hidden bg-eve-panel border border-eve-border rounded-sm relative group"
        >
          <div className="relative z-10 flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  <Sparkles className="mr-1.5 h-3 w-3 opacity-60" />
                  {banner.badgeText || 'Promotion'}
                </Badge>
                {banner.type === 'BANNER' && (
                  <Badge variant="outline" className="text-[10px]">
                    {banner.actionType === 'CLAIM_CODE' ? 'Promo code' : 'Special offer'}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-eve-text">{banner.title}</h2>
                <p className="max-w-2xl text-xs text-eve-muted leading-relaxed">{banner.description}</p>
              </div>

              {banner.status === 'generated' && banner.code && (
                <div className="rounded-sm border border-eve-border bg-eve-dark p-4">
                  <p className="text-[11px] text-eve-muted mb-3">
                    Your promo code
                  </p>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <code className="text-xl font-bold text-eve-accent tracking-wider bg-eve-panel px-3 py-1.5 rounded-sm border border-eve-border">
                      {banner.code}
                    </code>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        className="h-9 px-4 text-xs"
                        onClick={() => copyCode(banner.code!)}
                      >
                        {copiedCode === banner.code ? (
                          <Check className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="mr-2 h-3.5 w-3.5" />
                        )}
                        {copiedCode === banner.code ? 'Copied' : 'Copy code'}
                      </Button>
                      {banner.redeemPath && (
                        <Link href={banner.redeemPath}>
                          <Button variant="eve" className="h-9 px-4 text-xs">
                            Redeem
                            <ArrowRight className="ml-2 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-3 lg:w-[260px]">
              <div className="rounded-sm border border-eve-border bg-eve-dark p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-eve-border/40 bg-eve-panel">
                    <Gift className="h-4 w-4 text-eve-accent/60" />
                  </div>
                  <div>
                    <p className="text-[11px] text-eve-muted">
                      Status
                    </p>
                    <p className="text-xs text-eve-text mt-0.5 font-medium">
                      {banner.status === 'generated'
                        ? 'Code ready'
                        : 'Available'}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant={banner.status === 'generated' ? 'outline' : 'eve'}
                className="h-11 text-xs"
                disabled={claimingBannerId === banner.id}
                onClick={() => (
                  banner.status === 'generated' && banner.redeemPath
                    ? openRedeemPage(banner.redeemPath)
                    : handleClaim(banner.id)
                )}
              >
                {claimingBannerId === banner.id ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : banner.status === 'generated' && banner.redeemPath ? (
                  <ArrowRight className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Gift className="mr-2 h-3.5 w-3.5" />
                )}
                {banner.status === 'generated' ? 'Redeem now' : banner.buttonText}
              </Button>

              {banner.dismissible && (
                <Button
                  variant="ghost"
                  className="h-9 text-xs text-eve-muted hover:text-eve-text"
                  disabled={dismissingBannerId === banner.id}
                  onClick={() => handleDismiss(banner.id)}
                >
                  {dismissingBannerId === banner.id ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <X className="mr-2 h-3 w-3" />
                  )}
                  Dismiss
                </Button>
              )}
            </div>
          </div>

          <div className="absolute right-0 top-0 h-0.5 w-full bg-gradient-to-l from-eve-accent/10 to-transparent" />
        </div>
      ))}
    </div>
  )
}
