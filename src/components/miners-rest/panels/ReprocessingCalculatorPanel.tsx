'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ORE_YIELDS,
  MINERALS,
  getReprocessingYield,
} from '@/lib/mining-reprocessing-yields'
import { REPROCESSING_NOTES } from '@/lib/constants/mining-knowledge'
import { formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { MinersRestSection } from '../MinersRestSection'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMinersRestPriceRows } from '../MinersRestPricesContext'

const MINERAL_LABELS: Record<number, string> = {
  [MINERALS.TRITANIUM]: 'Tritanium',
  [MINERALS.PYERITE]: 'Pyerite',
  [MINERALS.MEXALLON]: 'Mexallon',
  [MINERALS.ISOGEN]: 'Isogen',
  [MINERALS.NOCXIUM]: 'Nocxium',
  [MINERALS.ZYDRINE]: 'Zydrine',
  [MINERALS.MEGACYTE]: 'Megacyte',
  [MINERALS.MORPHITE]: 'Morphite',
}

const STRUCTURE_BASE: Record<string, number> = {
  npc50: 50,
  citadel: 50,
  citadelT1: 52,
  citadelT2: 54,
}

const SECURITY_MOD: Record<string, number> = {
  highsec: 0,
  lowsec: 0.06,
  nullsec: 0.12,
}

function calcYieldPct(params: {
  baseFacility: number
  reprocessing: number
  efficiency: number
  oreSkill: number
  implantPct: number
  securityMod: number
}): number {
  const skillFactor =
    (1 + params.reprocessing * 0.03) *
    (1 + params.efficiency * 0.02) *
    (1 + params.oreSkill * 0.02) *
    (1 + params.implantPct / 100)
  const securityFactor = 1 + params.securityMod
  return params.baseFacility * skillFactor * securityFactor
}

export function ReprocessingCalculatorPanel() {
  const { t } = useTranslations()
  const oreNames = useMemo(() => Object.keys(ORE_YIELDS).sort(), [])
  const [oreName, setOreName] = useState(oreNames[0] ?? 'Veldspar')
  const [structure, setStructure] = useState('citadelT2')
  const [security, setSecurity] = useState('nullsec')
  const [reprocessing, setReprocessing] = useState(5)
  const [efficiency, setEfficiency] = useState(5)
  const [oreSkill, setOreSkill] = useState(5)
  const [implant, setImplant] = useState(4)

  const { items, load } = useMinersRestPriceRows('Ore')
  useEffect(() => {
    void load()
  }, [load])

  const priceRow = useMemo(
    () => items.find((row) => row.name.toLowerCase() === oreName.toLowerCase()),
    [items, oreName]
  )

  const yieldPct = calcYieldPct({
    baseFacility: STRUCTURE_BASE[structure] ?? 50,
    reprocessing,
    efficiency,
    oreSkill,
    implantPct: implant,
    securityMod: SECURITY_MOD[security] ?? 0,
  })

  const yields = getReprocessingYield(oreName)
  const batchSize = REPROCESSING_NOTES.batchSizeOre

  const rawBatchValue = priceRow ? priceRow.raw.price * batchSize : null
  const refinedBatchValue = priceRow
    ? priceRow.refined.price * batchSize * (yieldPct / 100)
    : null
  const bestOption =
    rawBatchValue != null && refinedBatchValue != null
      ? refinedBatchValue >= rawBatchValue
        ? 'refine'
        : 'sell'
      : null

  return (
    <MinersRestSection title={t('minersRest.tools.reprocessing')}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-400">{t('minersRest.tools.selectOre')}</Label>
            <Select value={oreName} onValueChange={setOreName}>
              <SelectTrigger className="border-zinc-800 bg-zinc-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900 max-h-64">
                {oreNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-zinc-400">{t('minersRest.tools.structure')}</Label>
              <Select value={structure} onValueChange={setStructure}>
                <SelectTrigger className="border-zinc-800 bg-zinc-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  <SelectItem value="npc50">NPC 50%</SelectItem>
                  <SelectItem value="citadel">Citadel 50%</SelectItem>
                  <SelectItem value="citadelT1">Citadel T1 Rig 52%</SelectItem>
                  <SelectItem value="citadelT2">Citadel T2 Rig 54%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">{t('minersRest.tools.security')}</Label>
              <Select value={security} onValueChange={setSecurity}>
                <SelectTrigger className="border-zinc-800 bg-zinc-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  <SelectItem value="highsec">Highsec</SelectItem>
                  <SelectItem value="lowsec">Lowsec</SelectItem>
                  <SelectItem value="nullsec">Nullsec</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ['reprocessing', reprocessing, setReprocessing],
                ['efficiency', efficiency, setEfficiency],
                ['oreSkill', oreSkill, setOreSkill],
                ['implant', implant, setImplant],
              ] as const
            ).map(([key, val, setter]) => (
              <div key={key} className="space-y-1">
                <Label className="text-zinc-500 text-xs">
                  {t(
                    key === 'reprocessing'
                      ? 'minersRest.tools.reprocessingSkill'
                      : `minersRest.tools.${key}`
                  )}
                </Label>
                <Select value={String(val)} onValueChange={(v) => setter(Number(v))}>
                  <SelectTrigger className="h-8 border-zinc-800 bg-zinc-900 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t('minersRest.tools.netYield')}
            </p>
            <p className="mt-1 text-2xl font-bold text-cyan-200">{yieldPct.toFixed(2)}%</p>
            <p className="mt-2 text-xs text-zinc-500">
              {t('minersRest.tools.batchNote', { size: batchSize })}
            </p>
          </div>

          {priceRow ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className={cn(
                  'rounded-lg border p-3',
                  bestOption === 'sell'
                    ? 'border-emerald-400/40 bg-emerald-400/10'
                    : 'border-white/10 bg-black/20'
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {t('minersRest.tools.sellRaw')}
                </p>
                <p className="mt-1 font-mono text-lg text-zinc-200">
                  {rawBatchValue != null ? formatCurrencyValue(rawBatchValue) : '—'}
                </p>
              </div>
              <div
                className={cn(
                  'rounded-lg border p-3',
                  bestOption === 'refine'
                    ? 'border-emerald-400/40 bg-emerald-400/10'
                    : 'border-white/10 bg-black/20'
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {t('minersRest.tools.refineBatch')}
                </p>
                <p className="mt-1 font-mono text-lg text-zinc-200">
                  {refinedBatchValue != null
                    ? formatCurrencyValue(refinedBatchValue)
                    : '—'}
                </p>
              </div>
            </div>
          ) : null}

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                <th className="pb-2">{t('minersRest.tools.mineral')}</th>
                <th className="pb-2 text-right">{t('minersRest.tools.perBatch')}</th>
              </tr>
            </thead>
            <tbody>
              {yields.map((y) => {
                const qty = Math.floor(y.quantity * (yieldPct / 100))
                return (
                  <tr key={y.mineralId} className="border-b border-white/5">
                    <td className="py-2 text-zinc-300">
                      {MINERAL_LABELS[y.mineralId] ?? `ID ${y.mineralId}`}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-cyan-100">
                      {qty.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </MinersRestSection>
  )
}
