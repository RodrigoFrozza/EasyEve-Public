import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { getSession } from '@/lib/session'

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}
import { getTranslations } from '@/i18n/server'
import { SettingsTabs } from '@/components/settings/SettingsTabs'

export default async function SettingsPage() {
  const { t } = await getTranslations()
  const session = await getSession()

  const user = session?.user ? await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      characters: {
        orderBy: { isMain: 'desc' },
        select: { id: true, name: true, isMain: true }
      }
    }
  }) : null

  if (!user) {
    return null
  }

  return (
    <div className="space-y-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">{t('settings.title')}</h1>
        <p className="text-gray-400 mt-1">{t('settings.manageAccount')}</p>
      </header>

      <SettingsTabs
        user={{
          ...user,
          characters: user.characters.map((c) => ({
            id: String(c.id),
            name: c.name,
            isMain: c.isMain,
          })),
        }}
      />
    </div>
  )
}