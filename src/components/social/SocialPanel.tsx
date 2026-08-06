'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import type { FriendsSubTab, SocialContact, SocialMainTab } from './social-types'
import { SocialPanelHeader } from './SocialPanelHeader'
import { FriendsSection } from './FriendsSection'
import { NotificationsPanel } from './NotificationsPanel'

interface SocialPanelProps {
  userId: string
  onClose: () => void
}

export function SocialPanel({ userId, onClose }: SocialPanelProps) {
  const { t } = useTranslations()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mainTab, setMainTab] = useState<SocialMainTab>('friends')
  const [friendsSubTab, setFriendsSubTab] = useState<FriendsSubTab>('friends')

  const {
    notifications,
    unreadCount,
    markAllRead,
    markAsRead,
  } = useNotifications()

  const { data: contactData, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const res = await axios.get('/api/players/contacts')
      return res.data
    },
    enabled: !!userId,
    refetchInterval: 60000,
  })

  const contacts = useMemo(
    () => (contactData?.contacts || []) as SocialContact[],
    [contactData?.contacts]
  )
  const pendingReceived = useMemo(
    () => (contactData?.pendingReceived || []) as SocialContact[],
    [contactData?.pendingReceived]
  )
  const pendingSent = useMemo(
    () => (contactData?.pendingSent || []) as SocialContact[],
    [contactData?.pendingSent]
  )

  const handleReviewRequests = () => {
    setMainTab('friends')
    setFriendsSubTab('pending')
  }

  const handleOpenLink = (link: string) => {
    router.push(link)
    onClose()
  }

  return (
    <div
      className={cn(
        'flex w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-sm border border-eve-border',
        'bg-eve-panel/95 shadow-2xl backdrop-blur-md',
        'max-h-[min(85vh,640px)] h-[min(85vh,640px)]'
      )}
    >
      <SocialPanelHeader onClose={onClose} />

      <Tabs
        value={mainTab}
        onValueChange={(v) => setMainTab(v as SocialMainTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="mx-4 mt-2 h-auto w-auto shrink-0 justify-start gap-4 border-b border-eve-border/50 bg-transparent p-0">
          <TabsTrigger value="friends" className="px-1 text-sm">
            {t('social.friends')}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="relative px-1 text-sm">
            {t('social.notifications')}
            {unreadCount > 0 && (
              <span
                className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-sm bg-red-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white"
                aria-live="polite"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="friends"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <FriendsSection
            contacts={contacts}
            pendingReceived={pendingReceived}
            pendingSent={pendingSent}
            isLoading={loadingContacts}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['contacts'] })}
            subTab={friendsSubTab}
            onSubTabChange={setFriendsSubTab}
          />
        </TabsContent>

        <TabsContent
          value="notifications"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <NotificationsPanel
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAllRead={markAllRead}
            onMarkRead={markAsRead}
            onReviewRequests={handleReviewRequests}
            onOpenLink={handleOpenLink}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
