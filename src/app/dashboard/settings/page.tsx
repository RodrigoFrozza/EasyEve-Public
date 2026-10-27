import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { getTranslations } from '@/i18n/server'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsStatusStrip } from '@/components/settings/SettingsStatusStrip'
import { SettingsTabs } from '@/components/settings/SettingsTabs'
import { isValidSettingsTab, type SettingsTabId } from '@/components/settings/settings-types'

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>
}

function resolveDefaultTab(tab: string | undefined): SettingsTabId {
  return isValidSettingsTab(tab) ? tab : 'general'
}

function formatLastSync(date: Date | null): string | null {
  if (!date) return null
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  await getTranslations()
  const session = await getSession()
  const { tab } = await searchParams
  const defaultTab = resolveDefaultTab(tab)

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          profile: true,
          characters: {
            orderBy: { isMain: 'desc' },
            select: {
              id: true,
              name: true,
              isMain: true,
              accessToken: true,
              lastFetchedAt: true,
            },
          },
        },
      })
    : null

  if (!user) {
    return null
  }

  const charactersWithToken = user.characters.filter((c) => !!c.accessToken)
  const latestFetch = user.characters.reduce<Date | null>((latest, c) => {
    if (!c.lastFetchedAt) return latest
    const d = new Date(c.lastFetchedAt)
    return !latest || d > latest ? d : latest
  }, null)

  const settingsUser = {
    ...user,
    characters: user.characters.map((c) => ({
      id: String(c.id),
      name: c.name,
      isMain: c.isMain,
    })),
  }

  const integrations = {
    esiConnected: charactersWithToken.length > 0,
    characterCount: user.characters.length,
    lastSyncLabel: formatLastSync(latestFetch),
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] animate-in space-y-6 p-4 pb-16 fade-in duration-500 md:p-8">
      <SettingsPageHeader />
      <SettingsStatusStrip user={settingsUser} />
      <Suspense fallback={null}>
        <SettingsTabs
          user={settingsUser}
          defaultTab={defaultTab}
          integrations={integrations}
        />
      </Suspense>
    </div>
  )
}
