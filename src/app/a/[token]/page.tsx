import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calculator } from 'lucide-react'
import { getAppraisalByToken, type AppraisalCreator } from '@/lib/appraisal/get-appraisal'
import { AppraisalResultTable } from '@/components/appraisal/AppraisalResultTable'
import { PublicPageChrome } from '@/components/landing/PublicPageChrome'
import { PublicShareFooter, PublicSharePitch } from '@/components/landing/PublicShareSections'
import { PUBLIC_APP_URL } from '@/constants/external-links'
import { formatISK, formatNumber } from '@/lib/utils'
import { getTranslations } from '@/i18n/server'

interface PageProps {
  params: Promise<{ token: string }>
}

const MAX_OG_ITEM_LINES = 12

/** Creator's EVE identity strip — portrait + corp + alliance, all public game info.
 * eslint-disable @next/next/no-img-element: evetech serves these as raw images and a
 * plain <img> keeps this a static server component (no next/image client runtime). */
function CreatorStrip({ creator, sharedByLabel }: { creator: AppraisalCreator; sharedByLabel: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xs border border-eve-border/40 bg-eve-dark/40 px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://images.evetech.net/characters/${creator.characterId}/portrait?size=64`}
        alt={creator.name}
        width={40}
        height={40}
        className="h-10 w-10 rounded-full border border-eve-border/50"
      />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-eve-muted">{sharedByLabel}</p>
        <p className="truncate text-sm font-semibold text-eve-text">{creator.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-eve-muted">
          {creator.corporation ? (
            <span className="flex items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://images.evetech.net/corporations/${creator.corporation.id}/logo?size=32`}
                alt=""
                width={16}
                height={16}
                className="h-4 w-4"
              />
              <span className="truncate">{creator.corporation.name}</span>
            </span>
          ) : null}
          {creator.alliance ? (
            <span className="flex items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://images.evetech.net/alliances/${creator.alliance.id}/logo?size=32`}
                alt=""
                width={16}
                height={16}
                className="h-4 w-4"
              />
              <span className="truncate">{creator.alliance.name}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const appraisal = await getAppraisalByToken(token)
  if (!appraisal) {
    return { title: 'Appraisal Not Found | EasyEve', robots: 'noindex, nofollow' }
  }

  // Reflect the creator's saved price knob so the embed shows the actual asking price.
  const modifiedSplit = appraisal.totalSplit * (appraisal.priceModifierPct / 100)
  const title = `Appraisal @ ${appraisal.marketLabel} — ${formatISK(modifiedSplit)} split | EasyEve`

  const itemLines = appraisal.items
    .slice(0, MAX_OG_ITEM_LINES)
    .map((item) => `${item.name} - ${formatNumber(item.quantity)}`)
  const remaining = appraisal.items.length - itemLines.length
  if (remaining > 0) {
    itemLines.push(`+${remaining} more item${remaining === 1 ? '' : 's'}`)
  }
  const description =
    itemLines.length > 0 ? itemLines.join('\n') : 'A saved EVE Online market appraisal on EasyEve.'

  const url = `${PUBLIC_APP_URL}/a/${token}`

  return {
    title,
    description,
    robots: 'noindex, nofollow',
    openGraph: {
      title,
      description,
      url,
      siteName: 'EasyEve',
      type: 'website',
      // No image — the root layout's generic og-image.png doesn't represent this
      // specific appraisal, and Discord/Slack render a cleaner text-only embed
      // without it. Explicit empty array so it doesn't inherit the layout's default.
      images: [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [],
    },
  }
}

// Public, unauthenticated share page — resolved purely from the secret token via
// getAppraisalByToken (never a session lookup). Deliberately not under /dashboard,
// so middleware.ts's session gate never applies here (same model as /c/[token]).
export default async function PublicAppraisalPage({ params }: PageProps) {
  const { token } = await params
  const appraisal = await getAppraisalByToken(token)
  if (!appraisal) {
    notFound()
  }
  const { t } = await getTranslations()

  return (
    <PublicPageChrome className="font-accent">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 py-10 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex w-fit items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xs border border-eve-accent/35 bg-eve-accent/10">
              <span className="text-sm font-bold text-eve-accent">E</span>
            </div>
            <span className="text-lg font-extrabold text-eve-text">
              Easy<span className="text-eve-accent">Eve</span>
            </span>
          </Link>
          {appraisal.creator ? (
            <CreatorStrip creator={appraisal.creator} sharedByLabel={t('appraisal.sharedBy')} />
          ) : null}
        </div>

        <div className="eve-public-panel space-y-4 rounded-xs p-4 md:p-6">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-eve-accent" />
            <h1 className="text-lg font-semibold text-eve-text">{t('appraisal.title')}</h1>
          </div>
          <AppraisalResultTable
            view={{
              marketLabel: appraisal.marketLabel,
              items: appraisal.items,
              unresolvedNames: appraisal.unresolvedNames,
              totalBuy: appraisal.totalBuy,
              totalSell: appraisal.totalSell,
              totalSplit: appraisal.totalSplit,
              createdAt: appraisal.createdAt,
              itemsLocation: appraisal.itemsLocation,
              priceModifierPct: appraisal.priceModifierPct,
              comments: appraisal.comments,
              rawEntries: appraisal.rawEntries,
            }}
          />
        </div>

        <PublicSharePitch
          tag={t('appraisal.sharePitchTag')}
          loginLabel={t('appraisal.sharePitchLogin')}
          loginCallbackPath="/dashboard/appraisal"
          discordLabel={t('appraisal.sharePitchDiscord')}
          secureLabel={t('appraisal.sharePitchSecure')}
        />

        <PublicShareFooter
          builtByLabel={t('appraisal.footerBuiltBy')}
          disclaimer={t('appraisal.footerDisclaimer')}
        />
      </div>
    </PublicPageChrome>
  )
}
