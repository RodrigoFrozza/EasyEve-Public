/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Newspaper, MessageSquare, ChevronRight, Clock, Megaphone, ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TimeAgo } from '@/components/time-ago'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslations } from '@/i18n/hooks'
import Image from 'next/image'
import { Skeleton } from '@/components/ui/skeleton'

interface NewsItem {
  id: string
  title: string
  content: string
  category: string
  createdAt: string
  imageUrl?: string
}

export function DashboardNews() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { t } = useTranslations()

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoadError(false)
        const res = await fetch('/api/news?limit=10')
        if (res.ok) {
          const data = await res.json()
          setNews(Array.isArray(data) ? data.filter(Boolean) : [])
        } else {
          setLoadError(true)
        }
      } catch (err) {
        console.error('Failed to fetch news:', err)
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchNews()
  }, [])

  const getCategoryColor = useCallback((cat: string) => {
    switch (cat) {
      case 'patch': return "text-eve-accent"
      case 'forum': return "text-eve-muted"
      default: return "text-eve-text"
    }
  }, [])

  const getCategoryIcon = useCallback((cat: string) => {
    switch (cat) {
      case 'patch': return <Megaphone className="h-3 w-3" />
      case 'forum': return <MessageSquare className="h-3 w-3" />
      default: return <Newspaper className="h-3 w-3" />
    }
  }, [])

  const getCategoryBgColor = useCallback((cat: string) => {
    switch (cat) {
      case 'patch': return "bg-eve-panel border-eve-border/40"
      case 'forum': return "bg-eve-dark border-eve-border/40"
      default: return "bg-eve-panel border-eve-border/30"
    }
  }, [])

  const ITEMS_PER_PAGE = 2
  const totalPages = Math.ceil(news.length / ITEMS_PER_PAGE)

  const goToNext = useCallback(() => {
    if (totalPages > 1) {
      setCurrentIndex((prev) => (prev + 1) % totalPages)
    }
  }, [totalPages])

  const goToPrevious = useCallback(() => {
    if (totalPages > 1) {
      setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages)
    }
  }, [totalPages])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (totalPages <= 1) return
    
    if (e.key === 'ArrowLeft') {
      goToPrevious()
    } else if (e.key === 'ArrowRight') {
      goToNext()
    }
  }, [totalPages, goToPrevious, goToNext])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleNewsClick = (item: NewsItem) => {
    setSelectedNews(item)
    setIsDialogOpen(true)
  }

  const currentPageItems = news.slice(
    currentIndex * ITEMS_PER_PAGE,
    (currentIndex + 1) * ITEMS_PER_PAGE
  )

  return (
    <div className="ta-panel overflow-hidden font-accent">
      <div className="flex flex-row items-center justify-between py-[13px] px-5 bg-ta-inset border-b border-white/[0.06]">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ta-body flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-eve-accent" />
          {t('dashboard.newsTitle')}
        </h3>
        <Link
          href="/dashboard/news"
          className="text-xs font-semibold text-eve-accent hover:text-eve-accent/80 transition-colors flex items-center gap-1"
        >
          {t('dashboard.newsViewAll')} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="p-0 relative h-[160px]">
        {loading ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 h-full items-center">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : loadError ? (
          <div className="p-8 text-center text-xs text-eve-muted h-full flex items-center justify-center">
            {t('dashboard.newsLoadError')}
          </div>
        ) : news.length === 0 ? (
          <div className="p-5 text-center h-full flex flex-col justify-center">
            <p className="text-xs text-eve-muted">{t('dashboard.newsEmpty')}</p>
            <div className="mt-3 pt-3 border-t border-eve-border/30 flex items-center gap-3 text-left">
                <div className="p-2 bg-eve-dark border border-eve-border/30 rounded-sm">
                    <MessageSquare className="h-4 w-4 text-eve-muted" />
                </div>
                <div>
                   <p className="text-xs font-medium text-eve-text">{t('dashboard.newsForumSoon')}</p>
                   <p className="text-[11px] text-eve-muted">{t('dashboard.newsForumDesc')}</p>
                </div>
            </div>
          </div>
        ) : (
          <div className="relative h-full">
            <div className="relative h-full overflow-hidden">
              <div className="absolute inset-0 p-3 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                {currentPageItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="flex w-full text-left items-center gap-3 cursor-pointer group/item min-w-0 h-full bg-eve-dark hover:bg-eve-panel-light border border-eve-border/40 transition-colors p-3 rounded-sm"
                    onClick={() => handleNewsClick(item)}
                  >
                    {item.imageUrl ? (
                      <div className="w-12 h-12 rounded-sm overflow-hidden shrink-0 border border-eve-border/30 transition-colors">
                        <Image 
                          src={item.imageUrl} 
                          alt={item.title}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover opacity-60 group-hover/item:opacity-80 transition-opacity"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    ) : (
                      <div className={cn("w-12 h-12 rounded-sm shrink-0 border transition-colors flex items-center justify-center", 
                          getCategoryBgColor(item.category)
                      )}>
                          {getCategoryIcon(item.category)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 py-0 border-eve-border/30", getCategoryColor(item.category))}>
                          {item.category}
                        </Badge>
                        <span className="text-[10px] text-eve-muted flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          <TimeAgo date={item.createdAt} />
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-eve-text group-hover/item:text-eve-accent transition-colors truncate">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-eve-muted mt-0.5 line-clamp-1">
                        {item.content}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {totalPages > 1 && (
               <div className="absolute bottom-2 right-3 flex items-center gap-2 bg-eve-dark border border-eve-border p-1 z-20 rounded-sm">
                 <button 
                   onClick={goToPrevious} 
                   className="text-eve-muted hover:text-eve-accent transition-colors p-0.5"
                   aria-label="Previous news"
                 >
                   <ChevronLeft className="h-3.5 w-3.5" />
                 </button>
                 <span className="text-[10px] text-eve-muted min-w-[24px] text-center">{currentIndex + 1}/{totalPages}</span>
                 <button 
                   onClick={goToNext} 
                   className="text-eve-muted hover:text-eve-accent transition-colors p-0.5"
                   aria-label="Next news"
                 >
                   <ChevronRight className="h-3.5 w-3.5" />
                 </button>
               </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) setSelectedNews(null)
      }}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
          {selectedNews && (
            <div>
              <div className="relative h-56 w-full overflow-hidden border-b border-eve-border">
                {selectedNews.imageUrl ? (
                  <Image 
                    src={selectedNews.imageUrl} 
                    alt={selectedNews.title}
                    fill
                    className="object-cover opacity-30"
                    sizes="700px"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-eve-dark flex items-center justify-center">
                    <Newspaper className="h-12 w-12 text-eve-border" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-eve-dark via-eve-dark/50 to-transparent" />
                <div className="absolute bottom-5 left-6 right-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 h-5 border-eve-border/30", getCategoryColor(selectedNews.category))}>
                      {selectedNews.category}
                    </Badge>
                    <span className="text-[11px] text-eve-muted flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {selectedNews.createdAt && <TimeAgo date={selectedNews.createdAt} />}
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-bold text-eve-text leading-tight">
                    {selectedNews.title}
                  </DialogTitle>
                </div>
              </div>
              
              <div className="p-6">
                <ScrollArea className="max-h-[50vh] pr-4">
                  <div className="text-sm text-eve-text/80 leading-relaxed whitespace-pre-wrap">
                    {selectedNews.content}
                  </div>
                </ScrollArea>
                <div className="mt-6 pt-4 border-t border-eve-border/30 flex justify-end items-center gap-4">
                  <Link 
                    href="/dashboard/news"
                    onClick={() => setIsDialogOpen(false)}
                    className="text-xs text-eve-accent hover:text-eve-accent/80 transition-colors"
                  >
                    View all news →
                  </Link>
                  <Button 
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)} 
                    className="text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-3 bg-eve-dark border border-eve-border/30 rounded-sm h-full">
      <Skeleton className="w-12 h-12 rounded-sm" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}