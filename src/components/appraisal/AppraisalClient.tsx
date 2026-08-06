'use client'

import { useEffect, useRef, useState } from 'react'
import { Calculator, Check, Copy, Link2, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppraisalResultTable, type AppraisalView } from './AppraisalResultTable'

type MarketKind = 'jita' | 'structure'

interface StructureHit {
  structureId: string
  name: string
}

interface AppraisalResponse extends AppraisalView {
  token: string
}

function StructurePicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: StructureHit | null
  onSelect: (s: StructureHit) => void
  onClear: () => void
}) {
  const { t } = useTranslations()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StructureHit[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      fetch(`/api/market/structures?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { structures: [] }))
        .then((d) => {
          if (!cancelled) {
            setResults(d.structures ?? [])
            setOpen(true)
          }
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setSearching(false))
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
        <span className="truncate">{selected.name}</span>
        <button type="button" onClick={onClear} className="ml-auto text-violet-300 hover:text-violet-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('appraisal.structureSearchPlaceholder')}
          className="h-9 w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
        />
        {searching ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : null}
      </div>
      {open && results.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
          {results.map((s) => (
            <li key={s.structureId}>
              <button
                type="button"
                onClick={() => {
                  onSelect(s)
                  setOpen(false)
                  setQuery('')
                }}
                className="block w-full truncate px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-violet-500/10 hover:text-violet-100"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && !searching && query.trim().length >= 3 && results.length === 0 ? (
        <p className="mt-1 px-1 text-xs text-zinc-600">{t('appraisal.structureNoResults')}</p>
      ) : null}
    </div>
  )
}

export function AppraisalClient() {
  const { t } = useTranslations()
  const [text, setText] = useState('')
  const [marketKind, setMarketKind] = useState<MarketKind>('jita')
  const [structure, setStructure] = useState<StructureHit | null>(null)
  const [itemsLocation, setItemsLocation] = useState('')
  const [priceModifierPct, setPriceModifierPct] = useState(100)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AppraisalResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const shareUrl = result ? `${window.location.origin}/a/${result.token}` : ''

  const submit = async () => {
    if (!text.trim()) {
      toast.error(t('appraisal.emptyError'))
      return
    }
    if (marketKind === 'structure' && !structure) {
      toast.error(t('appraisal.pickStructureError'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/appraisal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          marketKind,
          structureId: structure?.structureId,
          structureName: structure?.name,
          itemsLocation: itemsLocation.trim() || undefined,
          priceModifierPct,
          comments: comments.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('appraisal.genericError'))
        return
      }
      setResult(data as AppraisalResponse)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch {
      toast.error(t('appraisal.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked — ignore
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-violet-300" />
        <h1 className="text-lg font-semibold text-eve-text">{t('appraisal.title')}</h1>
      </div>
      <p className="text-sm text-zinc-500">{t('appraisal.subtitle')}</p>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-500">{t('appraisal.market')}</span>
          <div className="flex overflow-hidden rounded-md border border-zinc-800">
            <button
              type="button"
              onClick={() => setMarketKind('jita')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                marketKind === 'jita' ? 'bg-violet-500/20 text-violet-100' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              )}
            >
              {t('appraisal.jita')}
            </button>
            <button
              type="button"
              onClick={() => setMarketKind('structure')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                marketKind === 'structure' ? 'bg-violet-500/20 text-violet-100' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              )}
            >
              {t('appraisal.structure')}
            </button>
          </div>
        </div>

        {marketKind === 'structure' ? (
          <StructurePicker selected={structure} onSelect={setStructure} onClear={() => setStructure(null)} />
        ) : null}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={t('appraisal.pastePlaceholder')}
          className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-zinc-500">{t('appraisal.location')}</span>
            <input
              value={itemsLocation}
              onChange={(e) => setItemsLocation(e.target.value)}
              placeholder={t('appraisal.locationPlaceholder')}
              maxLength={200}
              className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-zinc-500">{t('appraisal.priceModifier')}</span>
            <div className="flex h-9 items-center rounded-md border border-zinc-800 bg-zinc-950">
              <input
                type="number"
                min={1}
                max={1000}
                value={priceModifierPct}
                onChange={(e) => setPriceModifierPct(Number(e.target.value))}
                className="h-full w-full bg-transparent px-3 text-sm tabular-nums text-zinc-200 outline-none"
              />
              <span className="pr-3 text-sm text-zinc-500">%</span>
            </div>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-zinc-500">{t('appraisal.comments')}</span>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={t('appraisal.commentsPlaceholder')}
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-zinc-600">{t('appraisal.pasteHint')}</span>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            {t('appraisal.appraise')}
          </Button>
        </div>
      </div>

      {result ? (
        <div ref={resultRef} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
            <Link2 className="h-4 w-4 text-violet-300" />
            <span className="flex-1 truncate text-xs text-zinc-400">{shareUrl}</span>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200 hover:bg-violet-500/20"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('appraisal.copied') : t('appraisal.copyLink')}
            </button>
          </div>
          <AppraisalResultTable view={result} />
        </div>
      ) : null}
    </div>
  )
}
