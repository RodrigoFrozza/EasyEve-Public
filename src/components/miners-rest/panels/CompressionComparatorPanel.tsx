'use client'

import { useEffect, useMemo } from 'react'
import { COMPRESSION_NOTES } from '@/lib/constants/mining-knowledge'
import { formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { MinersRestEmpty, MinersRestSection, minersRestTheme } from '../MinersRestSection'
import { Loader2 } from 'lucide-react'
import { useMinersRestPriceRows } from '../MinersRestPricesContext'

type Props = {
  space?: string
}

export function CompressionComparatorPanel({ space }: Props) {
  const { t } = useTranslations()
  const { items, loading, error, load } = useMinersRestPriceRows('Ore', space)

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    return items
      .filter((item) => item.volume > 0)
      .map((item) => {
        const rawPerM3 = item.raw.price / item.volume
        const compressedVolume =
          item.compressed.volume && item.compressed.volume > 0
            ? item.compressed.volume
            : item.volume / COMPRESSION_NOTES.oreUnitsPerCompressed
        const compressedPerM3 =
          compressedVolume > 0 ? item.compressed.price / compressedVolume : 0
        const rawBatchVolume = item.volume * COMPRESSION_NOTES.oreUnitsPerCompressed
        const savingsPct =
          rawBatchVolume > 0
            ? ((rawBatchVolume - compressedVolume) / rawBatchVolume) * 100
            : 0
        return {
          id: item.id,
          name: item.name,
          rawPrice: item.raw.price,
          compressedPrice: item.compressed.price,
          rawPerM3,
          compressedPerM3,
          savingsPct,
        }
      })
      .sort((a, b) => b.compressedPerM3 - a.compressedPerM3)
      .slice(0, 20)
  }, [items])

  return (
    <MinersRestSection title={t('minersRest.tools.compression')}>
      <p className="mb-4 text-xs text-zinc-500">{COMPRESSION_NOTES.summary}</p>

      {loading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader2 className={cn('h-6 w-6 animate-spin', minersRestTheme.text)} />
        </div>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : rows.length === 0 ? (
        <MinersRestEmpty message={t('minersRest.empty.noOres')} />
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
              <th className="pb-2">{t('activity.intel.item')}</th>
              <th className="pb-2 text-right">{t('minersRest.tools.rawUnit')}</th>
              <th className="pb-2 text-right">{t('minersRest.tools.compressedUnit')}</th>
              <th className="pb-2 text-right">{t('minersRest.tools.rawIskPerM3')}</th>
              <th className="pb-2 text-right">{t('minersRest.tools.compressedIskPerM3')}</th>
              <th className="pb-2 text-right">{t('minersRest.tools.volumeSaved')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-white/5">
                <td className={cn('py-2 font-medium uppercase', minersRestTheme.textMuted)}>
                  {row.name}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-zinc-400">
                  {formatCurrencyValue(row.rawPrice)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-zinc-400">
                  {formatCurrencyValue(row.compressedPrice)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-cyan-200">
                  {formatCurrencyValue(row.rawPerM3)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-emerald-300">
                  {formatCurrencyValue(row.compressedPerM3)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-emerald-400/90">
                  {row.savingsPct.toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </MinersRestSection>
  )
}
