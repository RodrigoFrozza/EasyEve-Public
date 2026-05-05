'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getMarketAppraisalDetailed } from '@/lib/market'
import { parseEVECargo } from '@/lib/parsers/eve-cargo-parser'
import { formatISK } from '@/lib/utils'
import { RattingLootEntryDetailModal } from './RattingLootEntryDetailModal'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface RattingLootHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: any
  onRefresh: () => void
}

type SortColumn = 'name' | 'unitPrice' | 'totalValue'

export function RattingLootHistoryModal({ open, onOpenChange, activity, onRefresh }: RattingLootHistoryModalProps) {
  const [clipboardText, setClipboardText] = useState('')
  const [previewItems, setPreviewItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('totalValue')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null)

  const isAutoLootTrackingEnabled = activity.data?.autoLootTrackingEnabled === true

  const sortedPreview = useMemo(() => {
    const next = [...previewItems]
    next.sort((a, b) => {
      const av = a[sortColumn] || 0
      const bv = b[sortColumn] || 0
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortAsc ? av - bv : bv - av
    })
    return next
  }, [previewItems, sortAsc, sortColumn])

  const historyEntries = useMemo(
    () =>
      ((activity.data?.logs || []) as any[])
        .filter((log) => ['loot', 'loot-auto'].includes(log.type))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [activity.data?.logs]
  )

  const handlePreview = useCallback(async (text: string) => {
    const parsed = parseEVECargo(text)
    const names = Array.from(parsed.keys())
    if (names.length === 0) {
      setPreviewItems([])
      return
    }
    setIsLoading(true)
    try {
      const appraisal = await getMarketAppraisalDetailed(names)
      const items = names.map((name) => {
        const qty = parsed.get(name) || 0
        const lookup = appraisal[name.toLowerCase()] || appraisal[name] || { unitPrice: 0, source: 'not_found', typeId: 0, buyPrice: 0, sellPrice: 0, liquidity: 0 }
        return {
          name,
          quantity: qty,
          typeId: lookup.typeId,
          unitPrice: lookup.unitPrice,
          totalValue: (lookup.unitPrice || 0) * qty,
          source: lookup.source,
          buyPrice: lookup.buyPrice || 0,
          sellPrice: lookup.sellPrice || 0,
          liquidity: lookup.liquidity || 0,
        }
      })
      setPreviewItems(items)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (clipboardText.trim()) {
      const timer = setTimeout(() => {
        handlePreview(clipboardText)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setPreviewItems([])
    }
  }, [clipboardText, handlePreview])

  const handleRegister = async () => {
    if (previewItems.length === 0) return

    if (isAutoLootTrackingEnabled) {
      toast.warning(
        'Auto loot tracking is active',
        {
          description: 'Items may already be tracked automatically. Adding manually could create duplicates.',
        }
      )
    }

    setIsRegistering(true)
    try {
      const amount = previewItems.reduce((sum, item) => sum + (item.totalValue || 0), 0)
      const logs = activity.data?.logs || []
      const updatedData = {
        ...activity.data,
        logs: [
          {
            refId: `loot-${Date.now()}`,
            date: new Date().toISOString(),
            amount,
            type: 'loot',
            charName: 'Loot Register',
            charId: 0,
            items: previewItems,
          },
          ...logs,
        ],
        estimatedLootValue: (activity.data?.estimatedLootValue || 0) + amount,
      }
      const response = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData }),
      })
      if (response.ok) {
        setClipboardText('')
        setPreviewItems([])
        onRefresh()
      }
    } finally {
      setIsRegistering(false)
    }
  }

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortAsc((s) => !s)
    } else {
      setSortColumn(column)
      setSortAsc(false)
    }
  }

  return (
    <>
      <Dialog open={open && !selectedEntry} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl bg-zinc-950 border-red-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
              Loot History
              {isAutoLootTrackingEnabled && (
                <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 bg-red-500/10 text-red-400 border-red-500/30 font-black uppercase">
                  Auto Tracking Active
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View and manage the history of looted items during the activity.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Textarea
                value={clipboardText}
                onChange={(event) => setClipboardText(event.target.value)}
                placeholder="Paste loot content here..."
                className="h-48 bg-zinc-900 border-zinc-800 text-xs font-mono"
              />
              <Button onClick={handleRegister} disabled={isRegistering || previewItems.length === 0} className="w-full">
                {isRegistering ? 'Registering...' : 'Register Loot'}
              </Button>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Preview</p>
                {isLoading && <Loader2 className="h-3 w-3 animate-spin text-red-400" />}
              </div>
              <div className="grid grid-cols-5 gap-2 text-[10px] text-zinc-500 uppercase font-bold px-2 py-1">
                <button type="button" onClick={() => toggleSort('name')} className="text-left col-span-2">Item</button>
                <span>Qty</span>
                <button type="button" onClick={() => toggleSort('unitPrice')} className="text-right">Unit</button>
                <button type="button" onClick={() => toggleSort('totalValue')} className="text-right">Total</button>
              </div>
              <div className="max-h-[250px] overflow-y-auto space-y-1">
                {sortedPreview.map((item, idx) => (
                  <div key={`${item.name}-${idx}`} className="grid grid-cols-5 gap-2 text-xs px-2 py-1 border-b border-zinc-800/60 last:border-0">
                    <div className={cn(
                      "col-span-2 truncate",
                      item.source === 'jita_buy' ? 'text-emerald-300' : item.source === 'jita_sell' ? 'text-yellow-300' : 'text-red-300'
                    )} title={item.source === 'jita_sell' ? 'Price from Jita sell orders (fallback).' : item.source === 'not_found' ? 'No orders found in Jita.' : 'Best Jita buy price.'}>
                      {item.name}
                    </div>
                    <span className="text-zinc-400">{item.quantity}</span>
                    <span className="text-right font-mono text-zinc-300">{formatISK(item.unitPrice)}</span>
                    <span className="text-right font-mono text-red-400">{formatISK(item.totalValue)}</span>
                  </div>
                ))}
                {!isLoading && sortedPreview.length === 0 && (
                  <p className="text-[10px] text-zinc-600 text-center py-4">Paste loot to see preview...</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-2 max-h-[220px] overflow-y-auto">
            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2">History</p>
            <div className="space-y-1">
              {historyEntries.map((entry) => (
                <button
                  key={entry.refId}
                  type="button"
                  onClick={() => setSelectedEntry(entry)}
                  className="w-full text-left flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-zinc-800/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-300">
                       {entry.type === 'loot-auto' ? 'AUTO' : entry.type === 'salvage' || entry.type === 'mtu' ? 'LOOT' : entry.type.toUpperCase()}
                     </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400">{entry.charName || 'Unknown'}</span>
                  </div>
                  <span className="font-mono text-red-400">{formatISK(entry.amount || 0)}</span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RattingLootEntryDetailModal open={!!selectedEntry} onOpenChange={(openState) => !openState && setSelectedEntry(null)} entry={selectedEntry} />
    </>
  )
}

