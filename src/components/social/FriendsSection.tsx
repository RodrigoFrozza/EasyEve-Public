'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Activity, Filter, Loader2, RefreshCw, Search, User, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import type { FriendsSubTab, PlayerSearchUser, SocialContact } from './social-types'
import { ContactListItem } from './ContactListItem'
import { PendingRequestItem } from './PendingRequestItem'
import { SentRequestItem } from './SentRequestItem'
import { PlayerSearchResults } from './PlayerSearchResults'
import { useSocialMutations } from './use-social-mutations'

interface FriendsSectionProps {
  contacts: SocialContact[]
  pendingReceived: SocialContact[]
  pendingSent: SocialContact[]
  isLoading: boolean
  onRefresh: () => void
  onSendRequestSuccess?: () => void
  subTab?: FriendsSubTab
  onSubTabChange?: (tab: FriendsSubTab) => void
}

function sortContacts(list: SocialContact[]): SocialContact[] {
  return [...list].sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function EmptyState({ icon: Icon, message }: { icon: typeof Users; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-eve-muted">
      <Icon className="h-10 w-10 opacity-30" />
      <p className="text-center text-sm">{message}</p>
    </div>
  )
}

export function FriendsSection({
  contacts,
  pendingReceived,
  pendingSent,
  isLoading,
  onRefresh,
  onSendRequestSuccess,
  subTab: controlledSubTab,
  onSubTabChange,
}: FriendsSectionProps) {
  const { t } = useTranslations()
  const router = useRouter()
  const mutations = useSocialMutations()
  const [internalSubTab, setInternalSubTab] = useState<FriendsSubTab>('friends')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const activeSubTab = controlledSubTab ?? internalSubTab
  const setActiveSubTab = (tab: FriendsSubTab) => {
    onSubTabChange?.(tab)
    if (controlledSubTab === undefined) setInternalSubTab(tab)
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data: globalSearchData, isLoading: searchingGlobal } = useQuery({
    queryKey: ['player-search', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return { users: [] as PlayerSearchUser[] }
      const res = await axios.get(
        `/api/players/search?q=${encodeURIComponent(debouncedSearch)}`
      )
      return res.data as { users: PlayerSearchUser[] }
    },
    enabled: debouncedSearch.length >= 2 && activeSubTab === 'search',
  })

  const sortedContacts = useMemo(() => sortContacts(contacts), [contacts])

  const filterBySearch = (list: SocialContact[]) => {
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter((item) => item.name.toLowerCase().includes(q))
  }

  const friendsList = filterBySearch(sortedContacts)
  const pendingList = filterBySearch(pendingReceived)
  const sentList = filterBySearch(pendingSent)

  const handleSendRequest = async (userId: string) => {
    await mutations.sendRequest(userId)
    setActiveSubTab('sent')
    onSendRequestSuccess?.()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as FriendsSubTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="mx-3 mt-2 h-auto w-auto shrink-0 flex-wrap justify-start gap-0 border-b border-eve-border/50 bg-transparent p-0">
          <TabsTrigger value="friends" className="text-xs">
            {t('social.friends')}
            {contacts.length > 0 && (
              <span className="ml-1.5 rounded-sm bg-eve-dark px-1.5 py-0.5 text-[10px] text-eve-muted">
                {contacts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="relative text-xs">
            {t('social.pending')}
            {pendingReceived.length > 0 && (
              <>
                <span className="ml-1.5 rounded-sm bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">
                  {pendingReceived.length}
                </span>
                {activeSubTab !== 'pending' && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="text-xs">
            {t('social.sent')}
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs">
            {t('social.search')}
          </TabsTrigger>
        </TabsList>

        <div className="shrink-0 border-b border-eve-border/40 px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-eve-muted" />
            <Input
              type="search"
              placeholder={t('social.searchPlayers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 border-eve-border/60 bg-eve-dark/50 pl-9 text-sm"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {isLoading && activeSubTab !== 'search' ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-eve-accent" />
              <span className="text-sm text-eve-muted">{t('common.loading')}</span>
            </div>
          ) : (
            <>
              <TabsContent value="friends" className="mt-0 px-3 pb-3">
                {friendsList.length > 0 ? (
                  <div className="space-y-1">
                    {friendsList.map(
                      (contact) =>
                        contact && (
                          <ContactListItem
                            key={contact.id}
                            contact={contact}
                            onRemove={() => mutations.removeContact(contact.id)}
                            isRemoving={mutations.isPending(contact.id)}
                          />
                        )
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={searchQuery ? Filter : Users}
                    message={searchQuery ? t('social.searchNoMatches') : t('social.noContacts')}
                  />
                )}
              </TabsContent>

              <TabsContent value="pending" className="mt-0 space-y-2 px-3 pb-3">
                {pendingList.length > 0 ? (
                  pendingList.map(
                    (req) =>
                      req && (
                        <PendingRequestItem
                          key={req.id}
                          request={req}
                          onAccept={() => mutations.handleRequest(req.id, 'accept')}
                          onReject={() => mutations.handleRequest(req.id, 'reject')}
                          isAccepting={mutations.isPending(`${req.id}-accept`)}
                          isRejecting={mutations.isPending(`${req.id}-reject`)}
                        />
                      )
                  )
                ) : (
                  <EmptyState
                    icon={searchQuery ? Filter : User}
                    message={searchQuery ? t('social.searchNoMatches') : t('social.noPending')}
                  />
                )}
              </TabsContent>

              <TabsContent value="sent" className="mt-0 space-y-2 px-3 pb-3">
                {sentList.length > 0 ? (
                  sentList.map(
                    (req) =>
                      req && (
                        <SentRequestItem
                          key={req.id}
                          request={req}
                          onCancel={() => mutations.cancelRequest(req.id)}
                          isCancelling={mutations.isPending(req.id)}
                        />
                      )
                  )
                ) : (
                  <EmptyState
                    icon={searchQuery ? Filter : Activity}
                    message={searchQuery ? t('social.searchNoMatches') : t('social.noSent')}
                  />
                )}
              </TabsContent>

              <TabsContent value="search" className="mt-0 px-3 pb-3">
                <PlayerSearchResults
                  debouncedSearch={debouncedSearch}
                  isSearching={searchingGlobal}
                  users={globalSearchData?.users ?? []}
                  contacts={contacts}
                  pendingSent={pendingSent}
                  onSendRequest={handleSendRequest}
                  isPending={mutations.isPending}
                />
              </TabsContent>
            </>
          )}
        </ScrollArea>
      </Tabs>

      <div className="shrink-0 border-t border-eve-border/50 p-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-2 border-eve-border text-eve-muted hover:text-eve-text"
            onClick={() => router.push('/dashboard/settings')}
          >
            <User className="h-3.5 w-3.5" />
            {t('social.mySettings')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 border-eve-border"
            onClick={onRefresh}
            aria-label={t('social.refresh')}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>
    </div>
  )
}
