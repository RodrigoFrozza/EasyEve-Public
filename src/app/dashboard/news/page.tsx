'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from '@/i18n/hooks'
import { Badge } from '@/components/ui/badge'
import { TimeAgo } from '@/components/time-ago'
import { Newspaper, Clock, Search, Megaphone, MessageSquare, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

interface NewsItem {
  id: string
  title: string
  content: string
  category: string
  createdAt: string
  imageUrl?: string
  published?: boolean
}

function getCategoryColor(cat: string) {
  switch (cat) {
    case 'patch': return "text-blue-400 bg-blue-400/10 border-blue-400/20"
    case 'forum': return "text-amber-400 bg-amber-400/10 border-amber-400/20"
    default: return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"
  }
}

function getCategoryIcon(cat: string) {
  switch (cat) {
    case 'patch': return <Megaphone className="h-3 w-3" />
    case 'forum': return <MessageSquare className="h-3 w-3" />
    default: return <Newspaper className="h-3 w-3" />
  }
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden animate-pulse">
      <div className="h-36 bg-white/5" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-16 rounded bg-white/5" />
        <div className="h-5 w-3/4 rounded bg-white/5" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-2/3 rounded bg-white/5" />
      </div>
    </div>
  )
}

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all duration-300 hover:shadow-[0_0_30px_-10px_rgba(34,211,238,0.15)]"
    >
      <Link href={`/dashboard/news/${item.id}`} className="block">
        <div className="relative h-36 w-full overflow-hidden bg-zinc-900">
          {item.imageUrl ? (
            <Image 
              src={item.imageUrl}
              alt={item.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
              <Newspaper className="h-12 w-12 text-zinc-800" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3">
            <Badge variant="outline" className={cn("text-[9px] px-2 py-0.5 h-5 border-none font-black uppercase tracking-wider", getCategoryColor(item.category))}>
              {getCategoryIcon(item.category)}
              <span className="ml-1">{item.category}</span>
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
            <Clock className="h-3 w-3" />
            <TimeAgo date={item.createdAt} />
          </div>
          
          <h2 className="text-sm font-black text-zinc-100 group-hover:text-cyan-400 transition-colors truncate uppercase tracking-tight font-outfit line-clamp-2">
            {item.title}
          </h2>
          
          <p className="text-xs text-zinc-500 line-clamp-2 font-inter leading-relaxed">
            {item.content}
          </p>
        </div>
      </Link>
    </motion.article>
  )
}

export default function DashboardNewsArchivePage() {
  const { t } = useTranslations()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news?limit=50')
        if (res.ok) {
          setNews(await res.json())
        }
      } catch (err) {
        console.error('Failed to fetch news:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchNews()
  }, [])

  const filteredNews = news.filter(item => {
    const matchesFilter = filter === 'all' || item.category === filter
    const matchesSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.content.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const categories = ['all', 'news', 'patch', 'forum']

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1200px] mx-auto w-full">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-cyan-400 hover:text-cyan-300 mb-3 inline-flex items-center gap-1 font-medium transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('players.backToDashboard')}
        </Link>
        <h1 className="text-3xl font-bold text-white">{t('dashboard.newsArchiveTitle')}</h1>
        <p className="text-gray-400 mt-1">{t('dashboard.newsArchiveSubtitle')}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={filter === cat ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(cat)}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest h-8 px-3",
                filter === cat 
                  ? "bg-cyan-500 text-black hover:bg-cyan-400" 
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
            >
              {cat === 'all' ? t('common.all') : cat}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search news..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">{t('dashboard.newsEmpty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNews.map((item, index) => (
            <NewsCard key={item.id} item={item} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}