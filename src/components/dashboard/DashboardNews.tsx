/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Newspaper, MessageSquare, ChevronRight, Clock, Megaphone, ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TimeAgo } from '@/components/time-ago'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslations } from '@/i18n/hooks'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface NewsItem {
  id: string
  title: string
  content: string
  category: string
  createdAt: string
  imageUrl?: string
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-2 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-white/5" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 rounded bg-white/5" />
        <div className="h-3 w-32 rounded bg-white/5" />
        <div className="h-2 w-24 rounded bg-white/5" />
      </div>
    </div>
  )
}

function SkeletonDialog() {
  return (
    <div className="sm:max-w-[500px] bg-zinc-950/95 backdrop-blur-xl border border-white/10 text-white rounded-[32px] overflow-hidden shadow-3xl">
      <div className="h-48 bg-white/5 animate-pulse" />
      <div className="p-6 space-y-4">
        <div className="h-6 w-3/4 rounded bg-white/5" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-2/3 rounded bg-white/5" />
      </div>
    </div>
  )
}

export function DashboardNews() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isSliding, setIsSliding] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { t } = useTranslations()

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoadError(false)
        const res = await fetch('/api/news?limit=10')
        if (res.ok) {
          setNews(await res.json())
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
      case 'patch': return "text-blue-400 bg-blue-400/10 border-blue-400/20"
      case 'forum': return "text-amber-400 bg-amber-400/10 border-amber-400/20"
      default: return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"
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
      case 'patch': return "bg-blue-500/10 text-blue-400"
      case 'forum': return "bg-amber-500/10 text-amber-400"
      default: return "bg-cyan-500/10 text-cyan-400"
    }
  }, [])

  const ITEMS_PER_PAGE = 2
  const totalPages = Math.ceil(news.length / ITEMS_PER_PAGE)

  const goToNext = () => {
    if (totalPages > 1 && !isSliding) {
      setIsSliding(true)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % totalPages)
        setIsSliding(false)
      }, 300)
    }
  }

  const goToPrevious = () => {
    if (totalPages > 1 && !isSliding) {
      setIsSliding(true)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages)
        setIsSliding(false)
      }, 300)
    }
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (totalPages <= 1 || isSliding) return
    
    if (e.key === 'ArrowLeft') {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1)
      } else {
        setCurrentIndex(totalPages - 1)
      }
    } else if (e.key === 'ArrowRight') {
      setCurrentIndex(prev => (prev + 1) % totalPages)
    }
  }, [totalPages, isSliding, currentIndex])

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
    <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[24px] overflow-hidden shadow-xl">
      <div className="flex flex-row items-center justify-between p-4 bg-white/[0.02] border-b border-white/5">
        <h3 className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-500 font-outfit flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-cyan-500/50" />
          {t('dashboard.newsTitle')}
        </h3>
        <Link
          href="/dashboard/news"
          className="text-[10px] text-zinc-500 hover:text-white transition-colors flex items-center gap-0.5 uppercase font-black tracking-widest font-outfit"
        >
          {t('dashboard.newsViewAll')} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      
      <div className="p-0 divide-y divide-white/5 relative h-[140px]">
        {loading ? (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : loadError ? (
          <div className="p-8 text-center text-xs text-rose-400/90 font-medium">{t('dashboard.newsLoadError')}</div>
        ) : news.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">{t('dashboard.newsEmpty')}</p>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-3 text-left">
                <div className="p-2 rounded-lg bg-amber-500/10">
                    <MessageSquare className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-white uppercase tracking-tight">{t('dashboard.newsForumSoon')}</p>
                   <p className="text-[9px] text-zinc-500">{t('dashboard.newsForumDesc')}</p>
                </div>
            </div>
          </div>
        ) : (
          <div className="relative h-full group/carousel">
            <div className="relative h-full overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="absolute inset-0 p-3 grid grid-cols-1 md:grid-cols-2 gap-3 items-center"
                >
                  {currentPageItems.map((item) => (
                    <motion.button
                      type="button"
                      key={item.id}
                      className="flex w-full text-left items-center gap-3 cursor-pointer group/item min-w-0 h-full hover:bg-white/[0.02] rounded-xl transition-all p-2 border border-transparent hover:border-white/5"
                      onClick={() => handleNewsClick(item)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {item.imageUrl ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10 group-hover/item:border-cyan-500/30 transition-all">
                          <Image 
                            src={item.imageUrl} 
                            alt={item.title}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                      ) : (
                        <div className={cn("p-2.5 rounded-lg shrink-0 transition-all border border-white/5 group-hover/item:border-cyan-500/30 group-hover/item:shadow-[0_0_15px_-5px_rgba(34,211,238,0.3)]", 
                            getCategoryBgColor(item.category)
                        )}>
                            {getCategoryIcon(item.category)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className={cn("text-[8px] h-3.5 px-1 py-0 border-none font-black uppercase tracking-tighter opacity-70", getCategoryColor(item.category))}>
                            {item.category}
                          </Badge>
                          <span className="text-[9px] text-zinc-600 flex items-center gap-0.5 font-mono">
                            <Clock className="h-2 w-2" />
                            <TimeAgo date={item.createdAt} />
                          </span>
                        </div>
                        <h4 className="text-[11px] font-black text-zinc-100 group-hover/item:text-cyan-400 transition-colors truncate uppercase tracking-tight font-outfit">
                          {item.title}
                        </h4>
                        <p className="text-[9px] text-zinc-500 mt-0.5 line-clamp-1 opacity-60 font-inter">
                          {item.content}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {totalPages > 1 && (
               <div className="absolute bottom-2 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 z-20">
                 <button 
                   onClick={goToPrevious} 
                   className="text-zinc-600 hover:text-white transition-colors p-1"
                   aria-label="Previous news"
                 >
                   <ChevronLeft className="h-3 w-3" />
                 </button>
                 <span className="text-[8px] font-black text-zinc-500 font-mono">{currentIndex + 1}/{totalPages}</span>
                 <button 
                   onClick={goToNext} 
                   className="text-zinc-600 hover:text-white transition-colors p-1"
                   aria-label="Next news"
                 >
                   <ChevronRight className="h-3 w-3" />
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
        <DialogContent className="sm:max-w-[600px] bg-zinc-950/95 backdrop-blur-xl border border-white/10 text-white rounded-[32px] p-0 overflow-hidden shadow-3xl">
          <AnimatePresence>
            {selectedNews && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative h-56 w-full overflow-hidden">
                  {selectedNews.imageUrl ? (
                    <Image 
                      src={selectedNews.imageUrl} 
                      alt={selectedNews.title}
                      fill
                      className="object-cover"
                      sizes="600px"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center">
                      <Newspaper className="h-12 w-12 text-zinc-800" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                  <div className="absolute bottom-4 left-6 right-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={cn("text-[9px] px-2 py-0 h-4 border-none font-black uppercase tracking-widest", getCategoryColor(selectedNews.category))}>
                        {selectedNews.category}
                      </Badge>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {selectedNews.createdAt && <TimeAgo date={selectedNews.createdAt} />}
                      </span>
                    </div>
                    <DialogTitle className="text-xl font-black font-outfit uppercase tracking-tight leading-tight">
                      {selectedNews.title}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      {selectedNews.category} news article: {selectedNews.title}
                    </DialogDescription>
                  </div>
                </div>
                
                <div className="p-6 pt-2">
                  <ScrollArea className="max-h-[40vh] pr-4">
                    <div className="text-sm text-zinc-400 font-inter leading-relaxed whitespace-pre-wrap">
                      {selectedNews.content}
                    </div>
                  </ScrollArea>
                  <div className="mt-6 flex justify-end gap-3">
                    <Link 
                      href="/dashboard/news"
                      onClick={() => setIsDialogOpen(false)}
                      className="text-[10px] text-zinc-500 hover:text-white font-black uppercase tracking-widest px-4 py-2 transition-colors"
                    >
                      View All News
                    </Link>
                    <Button 
                      onClick={() => setIsDialogOpen(false)} 
                      className="bg-white/10 hover:bg-white/20 text-zinc-200 rounded-xl px-6 font-black uppercase tracking-widest text-[10px] h-9"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  )
}