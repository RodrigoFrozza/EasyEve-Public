'use client'

import { useState } from 'react'
import { ChevronRight, Hammer, Loader2, ShoppingBag } from 'lucide-react'
import { cn, formatISK, formatNumber } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

interface NodeMaterial {
  typeId: number
  name: string
  quantity: number
  buyCost: number
  buyUnitPrice: number
  manufacturable: boolean
  noOrders: boolean
}

interface NodeData {
  manufacturable: boolean
  typeId: number
  name: string
  quantity: number
  runs: number
  materials: NodeMaterial[]
  makeCost: number
  buyCost: number
  buyUnitPrice: number
  buildVsBuy: 'make' | 'buy' | 'neutral'
  buyNoOrders: boolean
}

function BuildVsBuyBadge({ verdict }: { verdict: 'make' | 'buy' | 'neutral' }) {
  const { t } = useTranslations()
  if (verdict === 'make') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300" title={t('industry.deficit.makeHint')}>
        <Hammer className="h-3 w-3" />
        {t('industry.deficit.make')}
      </span>
    )
  }
  if (verdict === 'buy') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400" title={t('industry.deficit.buyHint')}>
        <ShoppingBag className="h-3 w-3" />
        {t('industry.deficit.buy')}
      </span>
    )
  }
  return null
}

function ItemIcon({ typeId }: { typeId: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://images.evetech.net/types/${typeId}/icon?size=32`}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      className="shrink-0 rounded"
    />
  )
}

/**
 * One expandable node in the production tree. Fetches its recipe lazily on first
 * expand; each manufacturable material is itself a RecipeNode, so the user can
 * drill in level by level (build-vs-buy shown at each). Depth guards runaway
 * recursion on cyclic/very deep chains.
 */
export function RecipeNode({
  typeId,
  name,
  quantity,
  depth = 0,
}: {
  typeId: number
  name: string
  quantity: number
  depth?: number
}) {
  const { t } = useTranslations()
  const [expanded, setExpanded] = useState(false)
  const [node, setNode] = useState<NodeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const toggle = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }
    if (!node && !failed) {
      setLoading(true)
      try {
        const res = await fetch('/api/industry/recipe-node', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ typeId, quantity }),
        })
        const data = await res.json()
        if (res.ok && data.manufacturable) setNode(data as NodeData)
        else setFailed(true)
      } catch {
        setFailed(true)
      } finally {
        setLoading(false)
      }
    }
    setExpanded(true)
  }

  const tooDeep = depth >= 6

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={tooDeep}
        className="flex w-full items-center gap-1.5 py-1 text-left text-sm hover:bg-zinc-900/60"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform', expanded && 'rotate-90')} />
        <ItemIcon typeId={typeId} />
        <span className="truncate text-zinc-200">{name}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">×{formatNumber(quantity)}</span>
        {loading ? <Loader2 className="h-3 w-3 animate-spin text-zinc-500" /> : null}
        {node ? <span className="ml-auto shrink-0"><BuildVsBuyBadge verdict={node.buildVsBuy} /></span> : null}
      </button>

      {expanded && node ? (
        <div className="ml-3 border-l border-zinc-800 pl-3">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 py-1 text-[11px] text-zinc-500">
            <span>
              {t('industry.tree.make')}: <span className="tabular-nums text-zinc-300">{formatISK(node.makeCost)}</span>
            </span>
            <span>
              {t('industry.tree.buy')}:{' '}
              <span className="tabular-nums text-zinc-300">{node.buyNoOrders ? t('industry.noOrders') : formatISK(node.buyCost)}</span>
            </span>
          </div>
          {node.materials.map((m) =>
            m.manufacturable ? (
              <RecipeNode key={m.typeId} typeId={m.typeId} name={m.name} quantity={m.quantity} depth={depth + 1} />
            ) : (
              <div key={m.typeId} className="flex items-center gap-1.5 py-1 text-sm">
                <span className="w-3.5 shrink-0" />
                <ItemIcon typeId={m.typeId} />
                <span className="truncate text-zinc-300">{m.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">×{formatNumber(m.quantity)}</span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-zinc-400">
                  {m.noOrders ? t('industry.noOrders') : formatISK(m.buyCost)}
                </span>
              </div>
            )
          )}
        </div>
      ) : null}

      {expanded && failed ? (
        <div className="ml-6 py-1 text-[11px] text-zinc-600">{t('industry.tree.notBuildable')}</div>
      ) : null}
    </div>
  )
}
