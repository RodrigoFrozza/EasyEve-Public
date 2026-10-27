import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSharedProfileByToken } from '@/lib/characters/share-profile'
import { CharacterProfileView } from '@/components/characters/profile/CharacterProfileView'
import { PublicPageChrome } from '@/components/landing/PublicPageChrome'
import { PublicShareFooter, PublicSharePitch } from '@/components/landing/PublicShareSections'
import { PUBLIC_APP_URL } from '@/constants/external-links'
import { eveCharacterPortraitUrl } from '@/lib/eve-images'
import { getTranslations } from '@/i18n/server'

interface PageProps {
  params: Promise<{ token: string }>
}

// Square portrait for the summary card thumbnail (Discord/Slack/Twitter).
const OG_PORTRAIT_PX = 256

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
  const ogImage = eveCharacterPortraitUrl(profile.characterId, OG_PORTRAIT_PX)

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

        <PublicSharePitch
          tag={t('characterProfile.share.pitchTag')}
          loginLabel={t('characterProfile.share.login')}
          loginCallbackPath="/dashboard/characters"
          discordLabel={t('characterProfile.share.discord')}
          secureLabel={t('characterProfile.share.secure')}
        />

        <PublicShareFooter
          builtByLabel={t('characterProfile.share.builtBy')}
          disclaimer={t('characterProfile.share.disclaimer')}
        />
      </div>
    </PublicPageChrome>
  )
}
