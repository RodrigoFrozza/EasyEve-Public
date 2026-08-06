'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut as clientSignOut } from '@/lib/session-client'
import { cn, isPremium } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import {
  Home,
  Users,
  Target,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Crown,
  Lock,
  Link as LinkIcon,
  PanelLeftClose,
  PanelLeft,
  TrendingUp,
  Cpu,
  Factory,
  type LucideIcon,
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
  children?: { name: string; href: string }[]
}

const navigation = (t: (key: string) => string): NavItem[] => [
  { name: t('sidebar.dashboard'), href: '/dashboard' },
  { name: t('sidebar.characters'), href: '/dashboard/characters' },
  { name: t('sidebar.activityTracker'), href: '/dashboard/activity' },
  {
    name: t('sidebar.industry'),
    id: MENU_IDS.INDUSTRY,
    children: [
      { name: t('sidebar.minersRest'), href: '/dashboard/miners-rest' },
      { name: t('sidebar.pi'), href: '/dashboard/pi' },
      { name: t('sidebar.industryCalc'), href: '/dashboard/industry' },
    ],
  },
  { 
    name: t('sidebar.fitManagement'), 
    id: MENU_IDS.FIT_MANAGEMENT,
    children: [{ name: t('sidebar.fits'), href: '/dashboard/fits' }]
  },
  { 
    name: t('sidebar.finance'), 
    id: MENU_IDS.FINANCE,
    children: [
      { name: t('sidebar.eveMarket'), href: '/market' },
      { name: t('sidebar.appraisal'), href: '/dashboard/appraisal' },
    ]
  },
]

const subscriptionItem = (t: (key: string) => string) => ({ name: t('sidebar.subscription'), href: '/dashboard/subscription' })

const sectionLabels = (t: (key: string) => string) => ({
  main: t('sidebar.navigation'),
  subscription: t('sidebar.account'),
  quickLinks: t('sidebar.quickLinks'),
})

const NAV_ICONS: Record<string, LucideIcon> = {
  '/dashboard': Home,
  '/dashboard/characters': Users,
  '/dashboard/activity': Target,
  [MENU_IDS.INDUSTRY]: Factory,
  [MENU_IDS.FIT_MANAGEMENT]: Cpu,
  [MENU_IDS.FINANCE]: TrendingUp,
}

function getNavIcon(item: NavItem): LucideIcon {
  if (item.href && NAV_ICONS[item.href]) return NAV_ICONS[item.href]
  if (item.id && NAV_ICONS[item.id]) return NAV_ICONS[item.id]
  return LinkIcon
}

function isPathActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

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
        className="bg-[#050b11] text-eve-text border border-white/[0.08] rounded-[8px] text-[11px] font-accent px-3 py-1.5 z-[100] shadow-[0_0_15px_rgba(0,0,0,0.6)]"
      >
        <TooltipPrimitive.Arrow className="fill-white/10 w-3 h-1.5" />
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
  }, [])

  const handleSignOut = () => {
    clientSignOut()
  }

  const characterName = session?.user?.characters?.find(c => c?.id === session?.user?.characterId)?.name || 'User'
  const labels = sectionLabels(t)
  const currentNav = navigation(t)
  const currentSubscription = subscriptionItem(t)
  const isAdmin = session?.user?.role === 'master'

  if (!isMounted) {
    return <div className="h-screen w-[72px] shrink-0 border-r border-white/[0.06] bg-ta-sidebar md:relative" />
  }

  const navLinkBase = cn(
    'group flex items-center rounded-[8px] text-[13.5px] font-semibold tracking-[0.02em] transition-all duration-200 relative border',
    isCollapsed ? 'justify-center px-0 py-2.5 border-transparent' : 'gap-3 px-3 py-[9px] border-transparent'
  )

  const navLinkState = (active: boolean) =>
    active
      ? 'bg-eve-accent/[0.09] border-eve-accent/[0.18] text-eve-accent'
      : 'text-ta-secondary hover:bg-white/[0.03] hover:text-white'

  const renderNavIcon = (Icon: LucideIcon, active: boolean) => (
    <Icon
      className={cn(
        'shrink-0',
        isCollapsed ? 'h-4 w-4' : 'h-4 w-4',
        active ? 'text-eve-accent' : 'text-zinc-500 group-hover:text-zinc-200'
      )}
      aria-hidden
    />
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex h-screen shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-ta-sidebar font-accent select-none',
          'relative z-50 transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:shadow-[4px_0_32px_rgba(0,0,0,0.45)]',
          isCollapsed ? 'max-md:-translate-x-full' : 'max-md:translate-x-0',
          'md:relative md:translate-x-0',
          isCollapsed ? 'w-[72px] max-md:w-[min(280px,88vw)]' : 'w-64'
        )}
      >
        {/* Header */}
        <div className={cn(
          "relative flex h-16 items-center border-b border-white/[0.06] z-10 px-4",
          isCollapsed ? "justify-center px-0" : "justify-between"
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              {/* Logo Badge */}
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-eve-accent/25 bg-eve-accent/[0.12]">
                <span className="font-accent text-[18px] font-bold text-eve-accent leading-none">E</span>
              </div>
              <div className="flex flex-col gap-[3px]">
                <div className="flex items-center gap-[7px]">
                  <span className="font-accent text-[16px] font-bold text-white tracking-[0.01em]">Easy<span className="text-eve-accent">Eve</span></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-ta-success-dot animate-ta-pulse" />
                </div>
                <span className="font-accent text-[10px] font-semibold tracking-[0.08em] text-ta-faint leading-none">ONLINE</span>
              </div>
            </div>
          )}
          
          <button
            onClick={toggleCollapsed}
            className={cn(
              "flex items-center justify-center rounded-[9px] border border-white/[0.08] text-ta-secondary hover:text-eve-accent hover:bg-eve-accent/[0.09] hover:border-eve-accent/40 bg-ta-inset transition-all duration-300 group",
              isCollapsed ? "h-9 w-9" : "h-7 w-7"
            )}
            aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          >
            {isCollapsed ? (
              <PanelLeft className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "relative flex-1 p-3 overflow-y-auto custom-scrollbar z-10",
          isCollapsed ? "space-y-4" : "space-y-6"
        )}>
          {/* Main Navigation Section */}
          <div className="space-y-2">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-3">
                <span className="font-accent text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ta-faint">
                  {labels.main}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent ml-3" />
              </div>
            )}
            <div className={cn("space-y-0.5", isCollapsed && "flex flex-col items-center w-full")}>
              {currentNav.map((item) => {
                const hasChildren = item.children && item.children.length > 0
                const menuId = item.id || item.name
                const isOpen = openMenus.includes(menuId)
                const isActive = item.href
                  ? isPathActive(pathname, item.href)
                  : item.children?.some((child) => isPathActive(pathname, child.href))

                if (hasChildren) {
                  const isActiveContainer = Boolean(isActive) && !isOpen
                  const ParentIcon = getNavIcon(item)
                  return (
                    <div key={menuId} className="space-y-0.5 w-full">
                      <SidebarTooltip text={item.name} isCollapsed={isCollapsed}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isCollapsed) {
                              setCollapsed(false)
                              toggleMenu(menuId)
                            } else {
                              toggleMenu(menuId)
                            }
                          }}
                          className={cn(
                            'group flex w-full items-center justify-between rounded-xs transition-all duration-300 relative border overflow-hidden',
                            isCollapsed ? 'justify-center px-0 py-2.5 border-transparent' : 'gap-3 px-3 py-2 border-transparent',
                            navLinkState(isActiveContainer)
                          )}
                        >
                          <div className={cn('flex min-w-0 items-center', isCollapsed ? 'justify-center w-full' : 'gap-3 flex-1')}>
                            {renderNavIcon(ParentIcon, isActiveContainer)}
                            {!isCollapsed && (
                              <span
                                className={cn(
                                  'truncate text-left text-[13px] font-semibold relative z-10',
                                  !hasPremium && menuId === MENU_IDS.FIT_MANAGEMENT && 'text-zinc-600 group-hover:text-zinc-500'
                                )}
                              >
                                {item.name}
                              </span>
                            )}
                          </div>
                          {!isCollapsed && (
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 shrink-0 transition-transform duration-300 text-zinc-500 group-hover:text-zinc-300',
                                isOpen && 'rotate-180 text-eve-accent'
                              )}
                            />
                          )}
                          {isActiveContainer && !isCollapsed && (
                            <div className="absolute left-0 top-[7px] bottom-[7px] w-[3px] rounded-full bg-eve-accent" />
                          )}
                        </button>
                      </SidebarTooltip>
                      {!isCollapsed && isOpen && (
                        <div className="space-y-0.5 border-l border-white/[0.06] ml-5 pl-2.5 mt-1 transition-all duration-300">
                          {item.children?.map((child) => {
                            const isChildActive = isPathActive(pathname, child.href)
                            const isRestrictedByPremium = !hasPremium && menuId === MENU_IDS.FIT_MANAGEMENT
                            
                            let isGloballyDeactivated = false
                            if (child.href === '/dashboard/fits') {
                              const config = moduleConfigs.find(c => c.module === 'fits')
                              if (config && !config.isActive) isGloballyDeactivated = true
                            } else if (child.href === '/market') {
                              const config = moduleConfigs.find(c => c.module === 'market')
                              if (config && !config.isActive) isGloballyDeactivated = true
                            } else if (child.href === '/dashboard/pi') {
                              const config = moduleConfigs.find(c => c.module === 'pi')
                              if (config && !config.isActive) isGloballyDeactivated = true
                            }

                             if (isRestrictedByPremium || isGloballyDeactivated) {
                              return (
                                <div
                                  key={child.name}
                                  className="flex items-center justify-between rounded-xs px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-950/20 border border-transparent cursor-not-allowed"
                                >
                                  <span>{child.name}</span>
                                  <Lock className="w-3 h-3 text-zinc-700 shrink-0" />
                                </div>
                              )
                            }

                            return (
                              <Link
                                key={child.name}
                                href={child.href}
                                className={cn(
                                  "flex items-center rounded-xs px-3 py-1.5 text-xs font-medium transition-all duration-200 border relative overflow-hidden",
                                  isChildActive
                                    ? "text-eve-accent bg-eve-accent/[0.06] border-eve-accent/20 -ml-[11px] pl-[14px]"
                                    : "text-zinc-500 hover:text-white bg-transparent border-transparent hover:bg-eve-accent/[0.01]"
                                )}
                              >
                                {child.name}
                                {isChildActive && (
                                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-eve-accent" />
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                const ItemIcon = getNavIcon(item)
                return (
                  <div key={item.name} className="w-full">
                    <SidebarTooltip text={item.name} isCollapsed={isCollapsed}>
                      <Link
                        href={item.href!}
                        className={cn(navLinkBase, navLinkState(!!isActive))}
                      >
                        {renderNavIcon(ItemIcon, !!isActive)}
                        {!isCollapsed && <span className="relative z-10 truncate">{item.name}</span>}
                        {isActive && !isCollapsed && (
                          <div className="absolute left-0 top-[7px] bottom-[7px] w-[3px] rounded-full bg-eve-accent" />
                        )}
                      </Link>
                    </SidebarTooltip>
                  </div>
                )
              })}
            </div>
          </div>
        
          {/* Subscription Section */}
          <div className="space-y-2 pt-2">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-3">
                <span className="font-accent text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ta-faint">
                  {labels.subscription}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent ml-3" />
              </div>
            )}
            <div className={cn("space-y-0.5", isCollapsed ? "flex flex-col items-center w-full" : "p-1.5 bg-white/[0.02] border border-white/[0.06] rounded-[10px] relative group")}>
              <div className="w-full">
                <SidebarTooltip text={currentSubscription.name} isCollapsed={isCollapsed}>
                  <Link
                    href={currentSubscription.href}
                    className={cn(
                      navLinkBase,
                      navLinkState(isPathActive(pathname, currentSubscription.href))
                    )}
                  >
                    {renderNavIcon(
                      Crown,
                      isPathActive(pathname, currentSubscription.href) || hasPremium
                    )}
                    {!isCollapsed && (
                      <>
                        <span className="relative z-10 flex-1 truncate">{currentSubscription.name}</span>
                        {hasPremium && (
                          <Crown className="h-3.5 w-3.5 shrink-0 text-eve-accent" />
                        )}
                      </>
                    )}
                    {/* Left active line decoration */}
                    {isPathActive(pathname, currentSubscription.href) && !isCollapsed && (
                      <div className="absolute left-0 top-[7px] bottom-[7px] w-[3px] rounded-full bg-eve-accent" />
                    )}
                  </Link>
                </SidebarTooltip>
              </div>
            </div>
          </div>

          {/* Admin Section */}
           {isAdmin && (
            <div className="space-y-2 pt-4 border-t border-white/[0.06]">
              {!isCollapsed && (
                <div className="flex items-center justify-between px-3">
                  <span className="font-accent text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ta-faint">
                    {t('sidebar.admin')}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent ml-3" />
                </div>
              )}
              <div className={cn("space-y-0.5", isCollapsed && "flex flex-col items-center w-full")}>
                <div className="w-full">
                  <SidebarTooltip text={t('sidebar.adminPanel')} isCollapsed={isCollapsed}>
                    <Link
                      href="/dashboard/admin"
                      className={cn(navLinkBase, navLinkState(isPathActive(pathname, '/dashboard/admin')))}
                    >
                      {renderNavIcon(Shield, isPathActive(pathname, '/dashboard/admin'))}
                      {!isCollapsed && (
                        <span className="relative z-10 truncate">{t('sidebar.adminPanel')}</span>
                      )}
                      {isPathActive(pathname, '/dashboard/admin') && !isCollapsed && (
                        <div className="absolute left-0 top-[7px] bottom-[7px] w-[3px] rounded-full bg-eve-accent" />
                      )}
                    </Link>
                  </SidebarTooltip>
                </div>
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="space-y-2 border-t border-white/[0.06] pt-4">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-3">
                <span className="font-accent text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ta-faint">{labels.quickLinks}</span>
                <div className="ml-3 h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
              </div>
            )}
            <div className={cn('space-y-0.5', isCollapsed && 'flex flex-col items-center')}>
              <SidebarTooltip text={t('sidebar.discord')} isCollapsed={isCollapsed}>
                <a
                  href={DISCORD_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(navLinkBase, 'text-zinc-400 hover:bg-white/[0.03] hover:text-white')}
                >
                  <DiscordIcon className="h-4 w-4 shrink-0 text-[#5865F2]" aria-hidden />
                  {!isCollapsed && <span className="truncate">{t('sidebar.discord')}</span>}
                </a>
              </SidebarTooltip>
            </div>
          </div>
        </nav>

        {/* User Footer */}
        <div className={cn(
          "relative border-t border-white/[0.06] bg-ta-sidebar-footer z-10 p-3",
          isCollapsed ? "p-2" : "p-3"
        )}>
          <DropdownMenu>
            <SidebarTooltip text={t('sidebar.myAccount')} isCollapsed={isCollapsed}>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "group flex w-full items-center rounded-[10px] bg-ta-inset border border-white/[0.07] text-sm text-ta-secondary transition-all duration-200 hover:text-white hover:border-eve-accent/30 relative",
                  isCollapsed ? 'justify-center p-1.5' : 'gap-[11px] p-[9px]'
                )}>
                  <Avatar className="h-[34px] w-[34px] rounded-[8px] border border-white/10 transition-all duration-200 group-hover:border-eve-accent/40 shrink-0">
                    <AvatarImage
                      src={session?.user?.characterId ? `https://images.evetech.net/characters/${session.user.characterId}/portrait?size=64` : ''}
                      className="rounded-[8px]"
                    />
                    <AvatarFallback className="bg-gradient-to-br from-[#1a2735] to-[#0d1620] text-ta-secondary rounded-[8px] font-accent font-bold">{characterName[0]}</AvatarFallback>
                  </Avatar>

                  {!isCollapsed && (
                    <div className="flex-1 text-left min-w-0 font-accent">
                      <p className="text-[13px] font-semibold text-white truncate leading-none mb-1">
                        {characterName}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "font-accent text-[9.5px] font-semibold uppercase tracking-[0.08em] px-[7px] py-[2px] rounded-[5px] leading-none",
                          hasPremium
                            ? "bg-eve-accent/[0.09] text-eve-accent border border-eve-accent/20"
                            : "bg-ta-inset text-ta-muted border border-white/[0.08]"
                        )}>
                          {hasPremium ? 'Premium' : 'Standard'}
                        </span>
                      </div>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
            </SidebarTooltip>

            <DropdownMenuContent
              align={isCollapsed ? "center" : "end"}
              side={isCollapsed ? "right" : "top"}
              className="w-56 bg-ta-sidebar border border-white/[0.08] rounded-[10px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-1 text-ta-body font-accent"
            >
              <DropdownMenuLabel className="text-zinc-500 text-xs font-semibold px-3 py-2 border-b border-white/[0.06]">
                {t('sidebar.myAccount')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="hidden" />
              
              <DropdownMenuItem asChild className="focus:bg-eve-accent/8 focus:text-white cursor-pointer rounded-xs px-3 py-2 text-zinc-400 hover:text-white transition-colors duration-200 mt-1">
                <Link href="/dashboard/settings" className="flex items-center text-xs font-medium w-full">
                  <Settings className="mr-3 h-4 w-4 text-zinc-500" />
                  {t('sidebar.settings')}
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem asChild className="focus:bg-eve-accent/8 focus:text-white cursor-pointer rounded-xs px-3 py-2 text-zinc-400 hover:text-white transition-colors duration-200">
                <a href={DISCORD_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center text-xs font-medium w-full">
                  <DiscordIcon className="mr-3 h-4 w-4 text-zinc-500" />
                  Discord
                </a>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-white/[0.06] h-px my-1" />
              
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-red-400/80 focus:bg-red-500/10 focus:text-red-400 cursor-pointer rounded-xs px-3 py-2 text-xs font-medium transition-colors duration-200 mb-1"
              >
                <LogOut className="mr-3 h-4 w-4" />
                {t('sidebar.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  )
}
