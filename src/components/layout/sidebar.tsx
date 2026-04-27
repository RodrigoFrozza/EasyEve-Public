'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut as clientSignOut } from '@/lib/session-client'
import { cn, isPremium } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import {
  Home,
  Users,
  Target,
  Rocket,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Crown,
  Lock,
  Link as LinkIcon,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  TrendingUp,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { useEffect, useState } from 'react'
import { useSidebarStore, MENU_IDS } from '@/lib/stores/sidebar-store'

const DISCORD_LINK = 'https://discord.gg/6Tt7XP3JhH'

interface NavItem {
  name: string
  id?: string
  href?: string
  icon: any
  children?: { name: string; href: string }[]
}

const navigation = (t: (key: string) => string): NavItem[] => [
  { name: t('sidebar.dashboard'), href: '/dashboard', icon: Home },
  { name: t('sidebar.characters'), href: '/dashboard/characters', icon: Users },
  { name: t('sidebar.activityTracker'), href: '/dashboard/activity', icon: Target },
  { 
    name: t('sidebar.fitManagement'), 
    id: MENU_IDS.FIT_MANAGEMENT,
    icon: Rocket,
    children: [{ name: t('sidebar.fits'), href: '/dashboard/fits' }]
  },
  { 
    name: t('sidebar.finance'), 
    id: MENU_IDS.FINANCE,
    icon: TrendingUp,
    children: [
      { name: t('sidebar.eveMarket'), href: '/market' },
    ]
  },
]

const subscriptionItem = (t: (key: string) => string) => ({ name: t('sidebar.subscription'), href: '/dashboard/subscription', icon: Crown })

const quickLinks = (t: (key: string) => string) => [
  { name: t('sidebar.settings'), href: '/dashboard/settings', icon: Settings },
  { name: t('sidebar.discord'), href: DISCORD_LINK, icon: LinkIcon, external: true },
]

const sectionLabels = (t: (key: string) => string) => ({
  main: t('sidebar.navigation'),
  subscription: t('sidebar.account'),
  quickLinks: t('sidebar.quickLinks'),
})

function SidebarTooltip({ children, text, isCollapsed, side = "right" }: { children: React.ReactNode, text: string, isCollapsed: boolean, side?: "top" | "right" | "bottom" | "left" }) {
  if (!isCollapsed) return <>{children}</>;
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent 
        side={side} 
        sideOffset={15} 
        className="bg-[#1a1a24] text-white border-none shadow-[0_0_20px_rgba(0,0,0,0.5)] font-medium text-sm px-3 py-1.5 z-[100]"
      >
        <TooltipPrimitive.Arrow className="fill-[#1a1a24] w-3 h-1.5" />
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { t } = useTranslations()
  const { isCollapsed, toggleCollapsed, setCollapsed, openMenus, toggleMenu } = useSidebarStore()
  const [isMounted, setIsMounted] = useState(false)
  const [moduleConfigs, setModuleConfigs] = useState<{ module: string; isActive: boolean }[]>([])

  const hasPremium = isPremium(session?.user?.subscriptionEnd)

  useEffect(() => {
    setIsMounted(true)
    
    // Fetch module configurations to handle global activation states
    fetch('/api/modules/config')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setModuleConfigs(data)
      })
      .catch(err => console.error('Failed to fetch module configs:', err))
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        if (window.innerWidth < 768) {
          useSidebarStore.getState().setCollapsed(true)
        } else if (window.innerWidth >= 768) {
          useSidebarStore.getState().setCollapsed(false)
        }
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = () => {
    clientSignOut()
  }

  const characterName = session?.user?.characters?.find(c => c.id === session?.user?.characterId)?.name || 'User'
  const labels = sectionLabels(t)
  const currentNav = navigation(t)
  const currentSubscription = subscriptionItem(t)
  const currentQuickLinks = quickLinks(t)

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex h-screen flex-col bg-gradient-to-b from-[#0d1117] via-[#080b10] to-[#050708] border-r border-white/[0.06] relative overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[72px]' : 'w-64'} ${isMounted ? 'animate-fade-in' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-eve-accent/[0.08] via-transparent to-transparent opacity-50 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[200px] bg-gradient-to-b from-eve-accent/[0.03] to-transparent pointer-events-none" />
        
        <div className={cn("relative flex h-16 items-center border-b border-white/[0.06]", isCollapsed ? "justify-center px-0" : "justify-between px-4")}>
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1a1f2e] via-[#151a24] to-[#0d1117] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <span className="text-xl font-black bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent" title="Easy Eve">E</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-white tracking-tight">Easy <span className="text-eve-accent">Eve</span></span>
                <span className="text-[10px] font-medium text-white/40 tracking-widest uppercase">{t('nav.dashboard')}</span>
              </div>
            </div>
          )}
          
          <button
            onClick={toggleCollapsed}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors duration-200",
              isCollapsed && "h-10 w-10"
            )}
          >
            {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className={cn("relative flex-1 p-4 overflow-y-scroll custom-scrollbar", isCollapsed ? "space-y-4" : "space-y-6")}>
          {!isCollapsed && (
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-white/[0.25] tracking-[0.2em] uppercase px-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-eve-accent/60" />
                {labels.main}
              </span>
            </div>
          )}
          <div className={cn("space-y-1.5", isCollapsed && "flex flex-col items-center w-full")}>
            {currentNav.map((item) => {
              const hasChildren = item.children && item.children.length > 0
              const menuId = item.id || item.name
              const isOpen = openMenus.includes(menuId)
              const isActive = item.href ? pathname === item.href : item.children?.some(child => pathname === child.href)

              if (hasChildren) {
                const isActiveContainer = isActive && !isOpen;
                return (
                  <div key={menuId} className="space-y-1.5 w-full">
                    <SidebarTooltip text={item.name} isCollapsed={isCollapsed}>
                      <button
                        onClick={() => {
                          if (isCollapsed) {
                            setCollapsed(false)
                            toggleMenu(menuId)
                          } else {
                            toggleMenu(menuId)
                          }
                        }}
                        className={cn(
                          'group flex w-full items-center justify-between rounded-xl text-sm font-medium transition-all duration-200 ease-out border border-transparent',
                          isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-3',
                          isActiveContainer
                            ? isCollapsed
                              ? "text-eve-accent"
                              : "bg-gradient-to-r from-eve-accent/15 to-transparent text-eve-accent border-l-[2.5px] border-eve-accent ml-[-2px] pl-[13px] shadow-[0_0_25px_-8px_rgba(0,200,255,0.35)]"
                            : "text-white/[0.55] hover:bg-white/[0.06] hover:text-white hover:scale-[1.02] hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.08)]"
                        )}
                      >
                        <div className={cn("flex items-center", isCollapsed ? "justify-center w-full" : "gap-3.5")}>
                          <div className={cn("relative flex items-center justify-center p-1.5 rounded-lg transition-colors", (isActiveContainer && isCollapsed) ? "bg-eve-accent/20" : "")}>
                            <item.icon className={cn("h-[22px] w-[22px] transition-all duration-200", isActiveContainer ? "text-eve-accent" : "group-hover:text-eve-accent/70")} />
                            {isCollapsed && hasChildren && (
                              <span className="absolute -top-[2px] -right-[2px] w-[9px] h-[9px] rounded-full bg-eve-accent border-[2px] border-[#0a0d13]" />
                            )}
                          </div>
                          {!isCollapsed && (
                            <>
                              <span className={cn(
                                "transition-colors duration-200", 
                                (!hasPremium && menuId === MENU_IDS.FIT_MANAGEMENT) && "text-white/[0.3]"
                              )}>
                                {item.name}
                              </span>
                              {!hasPremium && menuId === MENU_IDS.FIT_MANAGEMENT && (
                                <Lock className="h-3.5 w-3.5 text-eve-accent/40" />
                              )}
                            </>
                          )}
                        </div>
                        {!isCollapsed && <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />}
                      </button>
                    </SidebarTooltip>
                    {!isCollapsed && (
                      <div className={cn(
                        "overflow-hidden transition-all duration-300 ease-out",
                        isOpen ? "max-h-48 opacity-100 ml-4 mt-1" : "max-h-0 opacity-0"
                      )}>
                        <div className="space-y-1 border-l border-white/[0.08] ml-2.5 pl-2.5">
                          {item.children?.map((child) => {
                            const isChildActive = pathname === child.href
                            const isRestrictedByPremium = !hasPremium && menuId === MENU_IDS.FIT_MANAGEMENT
                            
                            // Check global activation status
                            let isGloballyDeactivated = false
                            if (child.href === '/dashboard/fits') {
                              const config = moduleConfigs.find(c => c.module === 'fits')
                              if (config && !config.isActive) isGloballyDeactivated = true
                            } else if (child.href === '/market') {
                              const config = moduleConfigs.find(c => c.module === 'market')
                              if (config && !config.isActive) isGloballyDeactivated = true
                            }

                            if (isRestrictedByPremium || isGloballyDeactivated) {
                              return (
                                <div
                                  key={child.name}
                                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-white/[0.25] cursor-not-allowed group/locked"
                                >
                                  <span>{child.name}</span>
                                  <Lock className={cn(
                                    "h-3 w-3 transition-colors",
                                    isGloballyDeactivated ? "text-red-500/50 group-hover/locked:text-red-500" : "text-white/[0.15]"
                                  )} />
                                </div>
                              )
                            }

                            return (
                              <Link
                                key={child.name}
                                href={child.href}
                                className={cn(
                                  "block rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                  isChildActive
                                    ? "text-eve-accent bg-eve-accent/[0.1] border-l-[2px] border-eve-accent ml-[-2px] pl-[14px]"
                                    : "text-white/[0.45] hover:text-white hover:bg-white/[0.05] hover:pl-4"
                                )}
                              >
                                {child.name}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div key={item.name} className="w-full">
                  <SidebarTooltip text={item.name} isCollapsed={isCollapsed}>
                    <Link
                      href={item.href!}
                      className={cn(
                        "group flex items-center rounded-xl text-sm font-medium transition-all duration-200 ease-out border border-transparent",
                        isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-3 gap-3.5',
                        isActive
                          ? isCollapsed
                            ? "text-eve-accent"
                            : "bg-gradient-to-r from-eve-accent/15 to-transparent text-eve-accent border-l-[2.5px] border-eve-accent ml-[-2px] pl-[13px] shadow-[0_0_25px_-8px_rgba(0,200,255,0.35)]"
                          : "text-white/[0.55] hover:bg-white/[0.06] hover:text-white hover:scale-[1.02] hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.08)]"
                      )}
                    >
                      <div className={cn("relative flex items-center justify-center p-1.5 rounded-lg transition-colors", (isActive && isCollapsed) ? "bg-eve-accent/20" : "")}>
                        <item.icon className={cn("h-[22px] w-[22px] transition-all duration-200", isActive ? "text-eve-accent group-hover:text-eve-accent" : "group-hover:text-eve-accent/70")} />
                      </div>
                      {!isCollapsed && item.name}
                    </Link>
                  </SidebarTooltip>
                </div>
              )
            })}
          </div>
        
          {!isCollapsed && (
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-white/[0.25] tracking-[0.2em] uppercase px-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-eve-accent2/60" />
                {labels.subscription}
              </span>
            </div>
          )}
          <div className={cn("space-y-1.5 rounded-xl transition-colors duration-200", isCollapsed ? "flex flex-col items-center px-0 py-1" : "p-2 bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.04]")}>
            <div className="w-full">
              <SidebarTooltip text={currentSubscription.name} isCollapsed={isCollapsed}>
                <Link
                  href={currentSubscription.href}
                  className={cn(
                    "group flex items-center rounded-xl text-sm font-medium transition-all duration-200 ease-out border border-transparent",
                    isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-3 gap-3.5',
                    pathname === currentSubscription.href
                      ? isCollapsed
                        ? "text-eve-accent2"
                        : "bg-gradient-to-r from-eve-accent2/20 to-transparent text-eve-accent2 border-eve-accent2/30 border-l-[2.5px] border-l-eve-accent2 ml-[-2px] pl-[13px] shadow-[0_0_25px_-8px_rgba(255,200,0,0.25)]"
                      : "text-eve-accent2/60 hover:bg-eve-accent2/10 hover:text-eve-accent2 hover:scale-[1.02] hover:shadow-[0_0_20px_-5px_rgba(255,200,0,0.12)]"
                  )}
                >
                  <div className={cn("relative flex items-center justify-center p-1.5 rounded-lg transition-colors", (pathname === currentSubscription.href && isCollapsed) ? "bg-eve-accent2/20" : "")}>
                    <currentSubscription.icon className={cn("h-[22px] w-[22px] transition-all duration-200", pathname === currentSubscription.href ? "text-eve-accent2" : "group-hover:text-eve-accent2/80")} />
                  </div>
                  {!isCollapsed && currentSubscription.name}
                </Link>
              </SidebarTooltip>
            </div>
          </div>

          {session?.user?.role === 'master' && (
            <div className="space-y-3">
              {!isCollapsed && (
                <span className="text-[10px] font-bold text-white/[0.25] tracking-[0.2em] uppercase px-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
                  {t('sidebar.admin')}
                </span>
              )}
              <div className={cn("space-y-1.5", isCollapsed && "flex flex-col items-center w-full")}>
                <div className="w-full">
                  <SidebarTooltip text={t('sidebar.adminPanel')} isCollapsed={isCollapsed}>
                    <Link
                      href="/dashboard/admin"
                      className={cn(
                        "group flex items-center rounded-xl text-sm font-medium transition-all duration-200 ease-out border border-transparent",
                        isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-3 gap-3.5',
                        pathname === '/dashboard/admin'
                          ? isCollapsed
                            ? "text-red-400"
                            : "bg-gradient-to-r from-red-500/15 to-transparent text-red-400 border-l-[2.5px] border-red-400 ml-[-2px] pl-[13px] shadow-[0_0_25px_-8px_rgba(255,50,50,0.25)]"
                          : "text-red-400/60 hover:bg-red-500/10 hover:text-red-400 hover:scale-[1.02] hover:shadow-[0_0_20px_-5px_rgba(255,50,50,0.1)]"
                      )}
                    >
                      <div className={cn("relative flex items-center justify-center p-1.5 rounded-lg transition-colors", (pathname === '/dashboard/admin' && isCollapsed) ? "bg-red-500/20" : "")}>
                        <Shield className={cn("h-[22px] w-[22px] transition-all duration-200", pathname === '/dashboard/admin' ? "text-red-400 group-hover:text-red-400" : "group-hover:text-red-400/80")} />
                      </div>
                      {!isCollapsed && t('sidebar.adminPanel')}
                    </Link>
                  </SidebarTooltip>
                </div>
              </div>
            </div>
          )}
        </nav>

        <div className={cn("relative border-t border-white/[0.06] bg-gradient-to-b from-transparent to-black/20", isCollapsed ? "p-2" : "p-3")}>
          <DropdownMenu>
            <SidebarTooltip text={t('sidebar.myAccount')} isCollapsed={isCollapsed}>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "group flex w-full items-center rounded-xl bg-white/[0.03] text-sm font-medium text-white/80 transition-all duration-200 hover:bg-white/[0.06] hover:text-white hover:scale-[1.01] hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.06)] border border-white/[0.04]",
                  isCollapsed ? 'justify-center p-1' : 'gap-3 p-2.5'
                )}>
                  <Avatar className="h-10 w-10 ring-2 ring-white/[0.08] transition-all duration-200 group-hover:ring-eve-accent/40 group-hover:shadow-[0_0_15px_rgba(0,200,255,0.2)]">
                    <AvatarImage src={session?.user?.characterId ? `https://images.evetech.net/characters/${session.user.characterId}/portrait?size=32` : ''} />
                    <AvatarFallback className="bg-white/[0.08] text-white/[0.6]">{characterName[0]}</AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {characterName}
                      </p>
                      <p className={cn("text-xs font-medium", hasPremium ? "text-amber-400" : "text-zinc-500")}>
                        {hasPremium ? 'Premium' : 'Free'}
                      </p>
                    </div>
                  )}
                  <ChevronDown className={cn("h-4 w-4 text-white/[0.35] group-hover:text-white/[0.6] transition-colors duration-200", isCollapsed && "hidden")} />
                </button>
              </DropdownMenuTrigger>
            </SidebarTooltip>
            <DropdownMenuContent align="end" className="w-56 bg-[#0d1117]/95 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <DropdownMenuLabel className="text-white/[0.5] font-normal">{t('sidebar.myAccount')}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem asChild className="focus:bg-white/[0.08] cursor-pointer">
                <Link href="/dashboard/settings" className="flex items-center text-white/[0.6] hover:text-white">
                  <Settings className="mr-2 h-4 w-4" />
                  {t('sidebar.settings')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-white/[0.08] cursor-pointer">
                <a href={DISCORD_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center text-white/[0.6] hover:text-[#5865F2]">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Discord
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-red-400/70 focus:bg-red-500/[0.1] focus:text-red-400 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('sidebar.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  )
}
