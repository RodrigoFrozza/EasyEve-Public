'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/i18n/hooks'

interface SearchResult {
  id: string
  name: string
  mainCharacterId: number
  mainCharacterName: string
  corporation?: string
  isOnline: boolean
  isPublic: boolean
  isTester: boolean
}

const SEARCH_DEBOUNCE_MS = 350

export function UserSearch() {
  const { t } = useTranslations()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const runSearch = useCallback(async (searchQuery: string) => {
    abortRef.current?.abort()
    if (searchQuery.length < 2) {
      setResults([])
      setSearchError(false)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setSearchError(false)

    try {
      const res = await fetch(
        `/api/players/search?q=${encodeURIComponent(searchQuery)}`,
        { signal: controller.signal }
      )
      if (res.ok) {
        const data = await res.json()
        setResults(data.users || [])
      } else {
        setResults([])
        setSearchError(true)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error('Search error:', err)
      setSearchError(true)
      setResults([])
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    void runSearch(debouncedQuery)
  }, [debouncedQuery, isOpen, runSearch])

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort()
      setQuery('')
      setDebouncedQuery('')
      setResults([])
      setSearchError(false)
    }
  }, [isOpen])

  return (
    <>
      <div className="relative w-64 group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
        <Input
          placeholder={t('dashboard.userSearchTrigger')}
          className="pl-10 bg-zinc-950/40 border-white/5 backdrop-blur-md rounded-xl h-10 text-[11px] font-black uppercase tracking-widest font-outfit focus:bg-white/[0.05] focus:border-white/10 cursor-pointer"
          onClick={() => setIsOpen(true)}
          readOnly
        />
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-zinc-950/95 border-white/10 max-w-md rounded-[32px] shadow-2xl backdrop-blur-2xl p-0 overflow-hidden">
          <DialogHeader className="p-8 border-b border-white/5">
            <DialogTitle className="text-xl font-black text-white uppercase tracking-tight font-outfit">{t('dashboard.userSearchTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              Search for players in the EasyEve system by character name.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
              <Input
                placeholder={t('dashboard.userSearchPlaceholder')}
                className="pl-11 h-12 bg-white/5 border-white/5 rounded-2xl text-sm font-medium text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-white/10 transition-all"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
              </div>
            )}

            {searchError && !loading && (
              <div className="text-center py-4 text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 font-outfit">{t('dashboard.userSearchError')}</div>
            )}

            {!loading && !searchError && results.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                {results.map((user) => (
                  <Link
                    key={user.id}
                    href={`/players/${user.id}`}
                    onClick={() => setIsOpen(false)}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 cursor-pointer transition-all group">
                      <Avatar className="h-12 w-12 border-2 border-white/5 group-hover:border-cyan-500/30 transition-all">
                        <AvatarImage
                          src={
                            user.isPublic
                              ? `https://images.evetech.net/characters/${user.mainCharacterId}/portrait?size=64`
                              : ''
                          }
                        />
                        <AvatarFallback className="bg-zinc-900 text-cyan-400 font-outfit text-lg font-black uppercase">
                          {user.mainCharacterName?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-black uppercase tracking-tight truncate flex items-center gap-2 font-outfit">
                          {user.mainCharacterName}
                          {!user.isPublic && (
                            <span className="text-[10px] text-zinc-600 flex items-center gap-1 font-black uppercase tracking-widest">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                              PRIVATE
                            </span>
                          )}
                        </div>
                        {user.corporation && (
                          <div className="text-[10px] text-zinc-500 truncate uppercase font-bold tracking-widest mt-1 font-outfit">{user.corporation}</div>
                        )}
                      </div>
                      {user.isOnline && user.isPublic && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40 animate-pulse" />
                          {user.isTester && (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50 text-[9px] px-1.5 py-0 font-bold uppercase">
                              Tester
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {!loading && !searchError && query.length >= 2 && results.length === 0 && (
              <div className="text-center py-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-outfit">{t('dashboard.userSearchNoResults')}</div>
            )}

            {query.length < 2 && !loading && !searchError && (
              <div className="text-center py-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-outfit">{t('dashboard.userSearchMinChars')}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
