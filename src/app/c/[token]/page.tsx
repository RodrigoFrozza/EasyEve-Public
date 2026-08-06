import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Github, Heart, LogIn, ShieldCheck } from 'lucide-react'
import { getSharedProfileByToken } from '@/lib/characters/share-profile'
import { CharacterProfileView } from '@/components/characters/profile/CharacterProfileView'
import { PublicPageChrome } from '@/components/landing/PublicPageChrome'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import { Button } from '@/components/ui/button'
import { EXTERNAL_LINKS, PUBLIC_APP_URL } from '@/constants/external-links'
import { getTranslations } from '@/i18n/server'

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const profile = await getSharedProfileByToken(token)

  if (!profile) {
    return {
      title: 'Profile Not Found | EasyEve',
      robots: 'noindex, nofollow',
    }
  }

  const title = `${profile.name} | EasyEve`
  const description = `View ${profile.name}'s EVE Online character profile on EasyEve.`
  const url = `${PUBLIC_APP_URL}/c/${token}`
  const ogImage = `https://images.evetech.net/characters/${profile.characterId}/portrait?size=256`

  return {
    title,
    description,
    robots: 'noindex, nofollow',
    openGraph: {
      title: profile.name,
      description,
      url,
      siteName: 'EasyEve',
      type: 'profile',
      images: [ogImage],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [ogImage],
    },
  }
}

// Public, unauthenticated share page — resolved purely from the secret token
// via getSharedProfileByToken (never a session/user lookup). Deliberately not
// under /dashboard, so middleware.ts's session gate never applies here.
export default async function PublicCharacterProfilePage({ params }: PageProps) {
  const { token } = await params
  const profile = await getSharedProfileByToken(token)

  if (!profile) {
    notFound()
  }
  const { t } = await getTranslations()

  return (
    <PublicPageChrome className="font-accent">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 py-10 md:p-8">
        <Link href="/" className="flex w-fit items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xs border border-eve-accent/35 bg-eve-accent/10">
            <span className="text-sm font-bold text-eve-accent">E</span>
          </div>
          <span className="text-lg font-extrabold text-eve-text">
            Easy<span className="text-eve-accent">Eve</span>
          </span>
        </Link>

        <CharacterProfileView profile={profile} defaultCollapsed disableEntranceAnimation />

        <div className="eve-public-panel space-y-4 rounded-xs p-6 md:p-8">
          <p className="text-xs font-medium text-eve-accent">{t('characterProfile.share.pitchTag')}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="eve" size="lg" className="gap-2">
              <a href="/api/auth/signin?callbackUrl=%2Fdashboard%2Fcharacters">
                <LogIn className="h-4 w-4" />
                {t('characterProfile.share.login')}
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2 border-eve-border">
              <a href={EXTERNAL_LINKS.DISCORD} target="_blank" rel="noopener noreferrer">
                <DiscordIcon className="h-4 w-4" />
                {t('characterProfile.share.discord')}
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2 pt-1 text-xs text-eve-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
            <span>{t('characterProfile.share.secure')}</span>
          </div>
        </div>

        <footer className="flex flex-col items-center gap-3 border-t border-eve-border/30 pt-6 text-center">
          <p className="flex items-center gap-1.5 text-xs text-eve-muted">
            <Heart className="h-3.5 w-3.5 text-eve-accent" />
            {t('characterProfile.share.builtBy')}{' '}
            <span className="font-semibold text-eve-text">Rodrigo Frozza</span>
          </p>
          <div className="flex items-center gap-4 text-xs text-eve-muted">
            <a
              href={EXTERNAL_LINKS.GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-eve-accent"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
            <a
              href={EXTERNAL_LINKS.DISCORD}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-eve-accent"
            >
              <DiscordIcon className="h-3.5 w-3.5" />
              Discord
            </a>
          </div>
          <p className="max-w-md text-[10px] leading-relaxed text-eve-muted/70">
            {t('characterProfile.share.disclaimer')}
          </p>
        </footer>
      </div>
    </PublicPageChrome>
  )
}
