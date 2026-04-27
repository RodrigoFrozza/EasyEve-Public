'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Rocket, Import, ListChecks, Box, Globe2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FitCard } from '@/components/fits/FitCard'
import { Fit } from '@/types/fit'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/lib/session-client'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTranslations } from '@/i18n/hooks'

export default function FitsDashboardPage() {
  const { t } = useTranslations()
  const { data: session, status } = useSession()
  const user = session?.user
  const loadingSession = status === 'loading'
  const [fits, setFits] = useState<Fit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filteredFits, setFilteredFits] = useState<Fit[]>([])

  useEffect(() => {
    const fetchFits = async () => {
      try {
        const res = await fetch('/api/fits')
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            // Keep the page usable for non-premium users and avoid noisy uncaught errors.
            setFits([])
            return
          }
          throw new Error('Failed to fetch fits')
        }
        const data = await res.json()
        setFits(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (user) fetchFits()
  }, [user])

  useEffect(() => {
    setFilteredFits(
      fits.filter(f => 
        f.name.toLowerCase().includes(search.toLowerCase()) || 
        f.ship.toLowerCase().includes(search.toLowerCase()) ||
        f.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      )
    )
  }, [search, fits])

  const publicFitsCount = fits.filter((fit) => fit.visibility === 'PUBLIC').length
  const totalModules = fits.reduce((acc, fit) => acc + fit.modules.length, 0)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fit?')) return
    
    try {
      const res = await fetch(`/api/fits/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setFits(prev => prev.filter(f => f.id !== id))
      toast.success('Fit deleted successfully')
    } catch (err) {
      toast.error('Failed to delete fit')
    }
  }

  if (loadingSession || loading) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-6 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-full md:w-72" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[420px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 md:p-8 animate-in fade-in duration-700">
      <section className="rounded-2xl border border-border/80 bg-card/70 p-5 backdrop-blur-sm md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1.5">
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              <Rocket className="h-7 w-7 text-primary" />
              {t('fits.shipFitsPageTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('global.manageShareFits')}</p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <div className="relative w-full sm:min-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('fits.searchFitsPlaceholder')}
                className="h-10 border-border bg-background/60 pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button asChild className="h-10 bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90">
              <Link href="/dashboard/fits/editor?new=true">
                <Plus className="mr-1.5 h-4 w-4" />
                {t('fits.newFit')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {(fits.length > 0 || search.trim() !== '') && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-card/65 p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" />
              {t('fits.totalFitsMetric')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{fits.length}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card/65 p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Globe2 className="h-3.5 w-3.5" />
              {t('fits.publicFitsMetric')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{publicFitsCount}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card/65 p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Box className="h-3.5 w-3.5" />
              {t('fits.fittedModulesMetric')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{totalModules}</p>
          </div>
        </section>
      )}

      {filteredFits.length > 0 ? (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredFits.map((fit) => (
            <FitCard key={fit.id} fit={fit} onDelete={handleDelete} />
          ))}
        </section>
      ) : (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/30 text-muted-foreground">
            <Filter className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {search ? t('fits.searchNoResults', { query: search }) : t('fits.noFitsCreated')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {search ? t('fits.emptySearchHint') : t('fits.emptyNoFitsHint')}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild variant="default" className="h-10 gap-1.5">
              <Link href="/dashboard/fits/editor?new=true">
                <Plus className="h-4 w-4" />
                {t('fits.createFirstFit')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 gap-1.5">
              <Link href="/dashboard/fits/editor?import=eft">
                <Import className="h-4 w-4" />
                {t('fits.importFromEft')}
              </Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
