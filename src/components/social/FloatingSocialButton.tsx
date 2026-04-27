import { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslations } from '@/i18n/hooks'
import { useSession } from '@/lib/session-client'
import { useRouter } from 'next/navigation'
import { useNotifications, Notification } from '@/lib/hooks/use-notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { 
  Bell, X, Check, Trash2, Clock, CheckCircle2, 
  Loader2, User, ChevronUp, MessageSquare, Activity,
  Search, Shield, Zap, Globe, HardDrive, Filter
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { Input } from '@/components/ui/input'

interface Contact {
  id: string
  contactId: string
  name: string
  isOnline: boolean
  mainCharacterId?: string
  activeActivity?: {
    type: string
  }
  updatedAt: string
}

export function FloatingSocialButton() {
  const { t } = useTranslations()
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [isOpen, setIsOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'sent'>('friends')
  const [searchQuery, setSearchQuery] = useState('')

  const { 
    notifications, 
    unreadCount, 
    hasNewNotification, 
    setHasNewNotification,
    markAllRead,
    markAsRead
  } = useNotifications()

  const { data: contactData, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const res = await axios.get('/api/players/contacts')
      return res.data
    },
    enabled: !!(session?.user as any)?.id && isOpen,
    refetchInterval: 60000,
  })

  const contacts = useMemo(() => contactData?.contacts || [], [contactData?.contacts])
  const pendingReceived = useMemo(() => contactData?.pendingReceived || [], [contactData?.pendingReceived])
  const pendingSent = useMemo(() => contactData?.pendingSent || [], [contactData?.pendingSent])

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts
    return contacts.filter((c: Contact) => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [contacts, searchQuery])

  const categorizedNotifications = useMemo(() => {
    const groups: Record<string, Notification[]> = {
      SOCIAL: [],
      ACTIVITY: [],
      SYSTEM: [],
      OTHER: []
    }
    
    notifications.forEach(n => {
      const type = n.type?.toUpperCase()
      if (type.includes('FRIEND') || type.includes('SOCIAL')) groups.SOCIAL.push(n)
      else if (type.includes('ACTIVITY') || type.includes('FLEET')) groups.ACTIVITY.push(n)
      else if (type.includes('SYSTEM')) groups.SYSTEM.push(n)
      else groups.OTHER.push(n)
    })
    
    return groups
  }, [notifications])

  const handleHandleRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await axios.put('/api/players/contacts/request', { requestId, action })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    } catch (err) {
      console.error('Error handling request:', err)
    }
  }

  const handleCancelRequest = async (userId: string) => {
    try {
      await axios.delete(`/api/players/${userId}/contact`)
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    } catch (err) {
      console.error('Error cancelling request:', err)
    }
  }

  if (status === 'loading') return null

  const onlineFriends = filteredContacts.filter((c: Contact) => c.isOnline)
  const offlineFriends = filteredContacts.filter((c: Contact) => !c.isOnline)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
            className="absolute bottom-20 right-0 w-[380px] max-h-[85vh] bg-eve-panel/95 backdrop-blur-xl border border-eve-border/50 rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
          >
            {/* Tactical Header */}
            <div className="relative p-5 border-b border-white/5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-eve-accent/10 to-transparent opacity-50" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {session?.user ? (
                    <>
                      {(() => {
                        const user = session.user as any
                        const mainChar = user.characters?.find((c: any) => c.isMain) || user.characters?.[0]
                        return (
                          <>
                            <div className="relative">
                              <Avatar className="h-12 w-12 border-2 border-eve-accent/30 ring-2 ring-eve-panel">
                                <AvatarImage src={mainChar ? `https://images.evetech.net/characters/${mainChar.id}/portrait?size=64` : ''} />
                                <AvatarFallback className="bg-eve-accent/20 text-eve-accent font-bold">
                                  {mainChar?.name?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-eve-panel shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                            </div>
                            <div>
                              <div className="text-white font-bold text-sm tracking-tight flex items-center gap-2">
                                {mainChar?.name || 'Player'}
                                <span className="px-1.5 py-0.5 rounded-sm bg-eve-accent/10 border border-eve-accent/20 text-[9px] text-eve-accent uppercase">Command</span>
                              </div>
                              <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5 mt-0.5">
                                <Shield className="h-3 w-3 text-eve-accent/60" />
                                Security Status Level 1
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </>
                  ) : (
                    <div className="text-gray-400 text-sm font-medium">{t('social.visitor')}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {session?.user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-10 w-10 p-0 rounded-xl transition-all relative border border-transparent",
                        showNotifications ? "bg-eve-accent/20 border-eve-accent/30 text-eve-accent" : "hover:bg-white/5 text-gray-400 hover:text-white"
                      )}
                      onClick={() => {
                        setShowNotifications(!showNotifications)
                        if (!showNotifications) setHasNewNotification(false)
                      }}
                    >
                      <Bell className={cn(
                        "h-5 w-5", 
                        hasNewNotification && "animate-pulse"
                      )} />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 rounded-full text-[9px] text-white flex items-center justify-center font-black ring-2 ring-eve-panel">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto min-h-[400px] scrollbar-thin scrollbar-thumb-white/10">
              <AnimatePresence mode="wait">
                {showNotifications ? (
                  <motion.div 
                    key="notifications"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col h-full"
                  >
                    <div className="px-5 py-4 flex items-center justify-between bg-white/[0.02] border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-eve-accent" />
                        <span className="text-white text-xs font-bold uppercase tracking-widest">{t('social.notifications')}</span>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllRead()}
                          className="text-[10px] font-bold text-eve-accent hover:text-eve-accent/80 flex items-center gap-1.5 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t('social.markAllRead')}
                        </button>
                      )}
                    </div>
                    
                    <div className="p-2 space-y-4">
                      {Object.entries(categorizedNotifications).map(([category, items]) => {
                        if (items.length === 0) return null;
                        return (
                          <div key={category} className="space-y-1">
                            <div className="px-3 py-1 flex items-center gap-2">
                              {category === 'SOCIAL' && <User className="h-3 w-3 text-blue-400" />}
                              {category === 'ACTIVITY' && <Activity className="h-3 w-3 text-rose-400" />}
                              {category === 'SYSTEM' && <HardDrive className="h-3 w-3 text-amber-400" />}
                              {category === 'OTHER' && <Globe className="h-3 w-3 text-emerald-400" />}
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">{category}</span>
                            </div>
                            <div className="space-y-1">
                              {items.map((notif) => (
                                <motion.div
                                  layout
                                  key={notif.id}
                                  className={cn(
                                    "px-4 py-3 rounded-xl cursor-pointer transition-all border border-transparent",
                                    notif.isRead 
                                      ? "hover:bg-white/5 opacity-70" 
                                      : "bg-eve-accent/5 border-eve-accent/10 hover:bg-eve-accent/10 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                                  )}
                                  onClick={() => {
                                    if (!notif.isRead) markAsRead(notif.id)
                                    if (notif.link) router.push(notif.link)
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <span className={cn(
                                      "text-xs font-bold leading-tight",
                                      notif.isRead ? "text-gray-300" : "text-white"
                                    )}>
                                      {notif.title}
                                    </span>
                                    {!notif.isRead && (
                                      <span className="w-2 h-2 rounded-full bg-eve-accent shadow-[0_0_8px_rgba(255,184,0,0.6)] shrink-0 mt-1" />
                                    )}
                                  </div>
                                  {notif.content && (
                                    <div className="text-gray-400 text-[11px] mt-1.5 leading-relaxed line-clamp-2">{notif.content}</div>
                                  )}
                                  <div className="flex items-center justify-between mt-3">
                                    <div className="text-gray-600 text-[9px] flex items-center gap-1.5 font-medium">
                                      <Clock className="h-2.5 w-2.5" />
                                      <FormattedDate date={notif.createdAt} />
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-5 text-[9px] hover:bg-white/10 px-2">Details</Button>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      
                      {notifications.length === 0 && (
                        <div className="py-20 text-center">
                          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                            <Bell className="h-6 w-6 text-gray-600" />
                          </div>
                          <p className="text-gray-500 text-xs italic font-medium">
                            {t('social.noNotifications')}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="social"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex flex-col h-full"
                  >
                    {/* Search & Filters */}
                    <div className="p-4 space-y-3 bg-white/[0.02] border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
                      <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-eve-accent transition-colors" />
                        <Input 
                          placeholder="Search transmission IDs..." 
                          className="pl-10 h-10 bg-black/40 border-white/5 focus-visible:border-eve-accent/50 focus-visible:ring-eve-accent/10 rounded-xl text-xs transition-all"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1 p-1 bg-black/20 rounded-xl border border-white/5">
                        <TabButton 
                          active={activeTab === 'friends'} 
                          onClick={() => setActiveTab('friends')}
                          label={t('social.onlineFriends')}
                          count={contacts.length}
                        />
                        <TabButton 
                          active={activeTab === 'pending'} 
                          onClick={() => setActiveTab('pending')}
                          label="Pending"
                          count={pendingReceived.length}
                          isAlert={pendingReceived.length > 0}
                        />
                        <TabButton 
                          active={activeTab === 'sent'} 
                          onClick={() => setActiveTab('sent')}
                          label="Outgoing"
                        />
                      </div>
                    </div>

                    <div className="p-2">
                      {loadingContacts ? (
                        <div className="py-20 text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-eve-accent/40" />
                          <p className="text-[10px] text-gray-500 mt-4 font-bold tracking-widest uppercase">Initializing Feed...</p>
                        </div>
                      ) : (
                        <div className="space-y-1 px-1">
                          {activeTab === 'friends' && (
                            <div className="space-y-1">
                              {onlineFriends.length > 0 && (
                                <div className="space-y-1">
                                  {onlineFriends.map((contact: Contact) => (
                                    <ContactItem key={contact.id} contact={contact} t={t} router={router} />
                                  ))}
                                </div>
                              )}
                              
                              {offlineFriends.length > 0 && (
                                <div className="mt-6">
                                  <div className="px-3 py-2 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Inactive Nodes</span>
                                    <span className="h-px flex-1 mx-3 bg-white/5" />
                                    <span className="text-[9px] font-black text-gray-600">{offlineFriends.length}</span>
                                  </div>
                                  {offlineFriends.map((contact: Contact) => (
                                    <ContactItem key={contact.id} contact={contact} t={t} router={router} />
                                  ))}
                                </div>
                              )}

                              {contacts.length === 0 && (
                                <div className="py-20 text-center">
                                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                                    <User className="h-6 w-6 text-gray-600" />
                                  </div>
                                  <p className="text-gray-500 text-xs italic font-medium">
                                    {t('social.noContacts')}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {activeTab === 'pending' && (
                            <div className="space-y-2 py-1">
                              {pendingReceived.length > 0 ? (
                                pendingReceived.map((req: any) => (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={req.id} 
                                    className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-eve-accent/20 transition-all group"
                                  >
                                    <Avatar className="h-10 w-10 border border-white/10 group-hover:border-eve-accent/30 transition-colors">
                                      <AvatarImage src={`https://images.evetech.net/characters/${req.mainCharacterId}/portrait?size=64`} />
                                      <AvatarFallback>?</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-white text-xs font-bold truncate tracking-tight">{req.name}</div>
                                      <div className="text-[9px] text-gray-500 font-medium uppercase tracking-tighter mt-0.5">Connection Request</div>
                                    </div>
                                    <div className="flex gap-1.5">
                                      <Button
                                        size="icon"
                                        className="h-8 w-8 rounded-lg bg-green-600/20 hover:bg-green-600 text-green-500 hover:text-white border border-green-600/30 transition-all"
                                        onClick={() => handleHandleRequest(req.id, 'accept')}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        className="h-8 w-8 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-600/30 transition-all"
                                        onClick={() => handleHandleRequest(req.id, 'reject')}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </motion.div>
                                ))
                              ) : (
                                <div className="py-20 text-center opacity-40">
                                  <Filter className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Zero Pending Signals</p>
                                </div>
                              )}
                            </div>
                          )}

                          {activeTab === 'sent' && (
                            <div className="space-y-2 py-1">
                              {pendingSent.length > 0 ? (
                                pendingSent.map((req: any) => (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={req.id} 
                                    className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-2xl border border-white/5 opacity-80 group"
                                  >
                                    <Avatar className="h-10 w-10 grayscale-[0.5] group-hover:grayscale-0 transition-all border border-white/5">
                                      <AvatarImage src={`https://images.evetech.net/characters/${req.mainCharacterId}/portrait?size=64`} />
                                      <AvatarFallback>?</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-white text-xs font-bold truncate tracking-tight">{req.name}</div>
                                      <div className="text-[9px] text-eve-accent/60 font-bold uppercase tracking-widest mt-0.5 animate-pulse">Establishing Bridge...</div>
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 rounded-lg text-gray-500 hover:text-rose-500 hover:bg-rose-500/10"
                                      onClick={() => handleCancelRequest(req.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </motion.div>
                                ))
                              ) : (
                                <div className="py-20 text-center opacity-40">
                                  <Filter className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">No Active Transmissions</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tactical Footer */}
            {session?.user && (
              <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-xl">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-white/5 text-[10px] h-9 bg-white/[0.03] hover:bg-eve-accent hover:text-black font-bold uppercase tracking-widest transition-all rounded-xl"
                    onClick={() => router.push('/dashboard/settings')}
                  >
                    <User className="h-3.5 w-3.5 mr-2" />
                    Profile Registry
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-white/5 bg-white/[0.03] hover:bg-white/10 rounded-xl"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['contacts'] })}
                  >
                    <Zap className={cn("h-4 w-4 text-eve-accent", loadingContacts && "animate-spin")} />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Command Trigger */}
      <div className="relative">
        <motion.button
          className={cn(
            "w-16 h-16 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] flex items-center justify-center relative",
            "transition-all duration-500",
            "border border-white/10 backdrop-blur-md group",
            isOpen ? "bg-white text-black rotate-90" : "bg-eve-panel text-eve-accent",
            hasNewNotification && !isOpen && "shadow-[0_0_20px_rgba(255,184,0,0.4)]"
          )}
          whileHover={{ scale: 1.05, y: -4 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsOpen(!isOpen)
            if (!isOpen && hasNewNotification) {
              setHasNewNotification(false)
            }
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isOpen ? 'open' : 'closed'}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              {isOpen ? (
                <X className="h-7 w-7" />
              ) : (
                <div className="relative">
                  <MessageSquare className="h-7 w-7" />
                  {unreadCount > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-4 -right-4 min-w-[22px] h-5.5 bg-red-600 rounded-lg text-[10px] text-white flex items-center justify-center font-black border-2 border-eve-panel px-1 shadow-lg"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          
          {/* Active Status Pulse */}
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-eve-panel" />
        </motion.button>

        {/* Global Alert Pulse */}
        {hasNewNotification && !isOpen && (
          <motion.div 
            className="absolute inset-0 rounded-2xl bg-eve-accent/20 z-[-1]"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label, count, isAlert }: { active: boolean, onClick: () => void, label: string, count?: number, isAlert?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all flex items-center justify-center gap-1.5 relative",
        active 
          ? "bg-eve-accent text-black shadow-lg" 
          : "text-gray-500 hover:text-white hover:bg-white/5"
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn(
          "px-1.5 py-0.5 rounded-md text-[8px] font-black",
          active ? "bg-black/20 text-black" : "bg-white/5 text-gray-400"
        )}>
          {count}
        </span>
      )}
      {isAlert && !active && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  )
}

function ContactItem({ contact, t, router }: { contact: Contact, t: any, router: any }) {
  return (
    <motion.div
      layout
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] cursor-pointer transition-all border border-transparent hover:border-white/5 group",
        !contact.isOnline && "opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
      )}
      onClick={() => router.push(`/players/${contact.id}`)}
    >
      <div className="relative">
        <Avatar className="h-10 w-10 border border-white/5 group-hover:border-eve-accent/40 transition-colors">
          <AvatarImage src={`https://images.evetech.net/characters/${contact.mainCharacterId}/portrait?size=64`} />
          <AvatarFallback className="bg-eve-dark text-gray-500">
            <User className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-eve-panel shadow-sm transition-all",
          contact.isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-gray-600"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-xs truncate font-bold tracking-tight",
          contact.isOnline ? "text-white" : "text-gray-400"
        )}>
          {contact.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {contact.isOnline ? (
            contact.activeActivity ? (
              <div className="text-[9px] text-eve-accent flex items-center gap-1 font-black uppercase tracking-tighter">
                <Activity className="h-2.5 w-2.5" />
                {contact.activeActivity.type}
              </div>
            ) : (
              <div className="text-[9px] text-green-500/80 font-bold uppercase tracking-tighter">Standby</div>
            )
          ) : (
            <div className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">Offline</div>
          )}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronUp className="h-4 w-4 text-gray-500 rotate-90" />
      </div>
    </motion.div>
  )
}