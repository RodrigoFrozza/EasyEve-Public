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
import { cn } from '@/lib/utils'

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

interface UserSearchProps {
  className?: string
  /** Icon button only — opens search dialog without expanding the sidebar */
  variant?: 'field' | 'icon'
}

export function UserSearch({ className, variant = 'field' }: UserSearchProps) {
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
        setResults((data.users || []).filter(Boolean))
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
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-sm border border-transparent text-eve-muted transition-colors hover:border-eve-border hover:bg-eve-dark hover:text-eve-accent',
            className
          )}
          aria-label={t('dashboard.userSearchTitle')}
        >
          <Search className="h-4 w-4" />
        </button>
      ) : (
        <div className={cn('relative w-full max-w-full group', className)}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-eve-muted group-hover:text-eve-text transition-colors" />
          <Input
            placeholder={t('dashboard.userSearchTrigger')}
            className="pl-10 h-9 text-xs cursor-pointer"
            onClick={() => setIsOpen(true)}
            readOnly
          />
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b border-eve-border bg-eve-dark">
            <DialogTitle className="text-sm font-semibold text-eve-text">{t('dashboard.userSearchTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              Search for players in the EasyEve system by character name.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-eve-muted" />
              <Input
                placeholder={t('dashboard.userSearchPlaceholder')}
                className="pl-10 h-11 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            {loading && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-eve-muted" />
              </div>
            )}

            {searchError && !loading && (
              <div className="text-center py-5 text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-sm">
                {t('dashboard.userSearchError')}
              </div>
            )}

            {!loading && !searchError && results.length > 0 && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                {results.map((user) => (
                  <Link
                    key={user.id}
                    href={`/players/${user.id}`}
                    onClick={() => setIsOpen(false)}
                    className="block"
                  >
                    <div className="flex items-center gap-3 p-3 rounded-sm bg-eve-dark border border-eve-border/40 hover:bg-eve-panel-light hover:border-eve-accent/20 cursor-pointer transition-colors group">
                      <Avatar className="h-9 w-9 rounded-sm border border-eve-border/30">
                        <AvatarImage
                          src={
                            user.isPublic
                              ? `https://images.evetech.net/characters/${user.mainCharacterId}/portrait?size=64`
                              : ''
                          }
                          className="rounded-sm object-cover"
                        />
                        <AvatarFallback className="bg-eve-panel text-eve-muted text-sm rounded-sm">
                          {user.mainCharacterName?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-eve-text truncate flex items-center gap-2 group-hover:text-white transition-colors">
                          {user.mainCharacterName}
                          {!user.isPublic && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              Private
                            </Badge>
                          )}
                        </div>
                        {user.corporation && (
                          <div className="text-[11px] text-eve-muted truncate mt-0.5">{user.corporation}</div>
                        )}
                      </div>
                      {user.isOnline && user.isPublic && (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full" />
                          {user.isTester && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
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
              <div className="text-center py-8 border border-eve-border/30 bg-eve-dark rounded-sm">
                <p className="text-xs text-eve-muted">
                  {t('dashboard.userSearchNoResults')}
                </p>
              </div>
            )}

            {query.length < 2 && !loading && !searchError && (
              <div className="text-center py-8 border border-eve-border/30 bg-eve-dark rounded-sm">
                <p className="text-xs text-eve-muted">
                  {t('dashboard.userSearchMinChars')}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
