'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Store, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StructurePicker, type StructureHit } from '@/components/market/StructurePicker'
import type {
  IndustryHub,
  IndustryConfigData,
  FactoryConfig,
  FactoryRig,
  StructureSecurity,
} from '@/lib/industry/config-types'

function hubKey(h: IndustryHub): string {
  return `${h.kind}:${h.id}`
}

const SECURITIES: StructureSecurity[] = ['HIGH_SEC', 'LOW_SEC', 'NULL_SEC']

function SectionHeading({ title }: { title: string }) {
  return <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300">{title}</h3>
}

function FactorySection({
  factory,
  setFactory,
}: {
  factory: FactoryConfig | null
  setFactory: (f: FactoryConfig | null) => void
}) {
  const { t } = useTranslations()
  const [facilities, setFacilities] = useState<{ typeId: number; name: string }[]>([])
  const [rigQuery, setRigQuery] = useState('')
  const [rigResults, setRigResults] = useState<FactoryRig[]>([])
  const [systemQuery, setSystemQuery] = useState('')
  const [systemResults, setSystemResults] = useState<{ systemId: number; name: string }[]>([])

  useEffect(() => {
    fetch('/api/industry/facilities')
      .then((r) => (r.ok ? r.json() : { facilities: [] }))
      .then((d) => setFacilities(d.facilities ?? []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const q = rigQuery.trim()
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`/api/industry/rig-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { rigs: [] }))
        .then((d) => !cancelled && setRigResults(d.rigs ?? []))
        .catch(() => undefined)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [rigQuery])

  useEffect(() => {
    const q = systemQuery.trim()
    if (q.length < 3) {
      setSystemResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`/api/industry/system-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { systems: [] }))
        .then((d) => !cancelled && setSystemResults(d.systems ?? []))
        .catch(() => undefined)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [systemQuery])

  const enabled = factory?.structureTypeId != null
  const current: FactoryConfig = factory ?? {
    structureTypeId: null,
    structureName: '',
    rigs: [],
    security: 'HIGH_SEC',
    solarSystemId: null,
    solarSystemName: '',
    facilityTaxPct: 0,
  }

  const setStructure = (typeId: number, name: string) => setFactory({ ...current, structureTypeId: typeId, structureName: name })
  const clearStructure = () => setFactory(null)
  const setSecurity = (security: StructureSecurity) => setFactory({ ...current, security })
  const addRig = (rig: FactoryRig) => {
    if (current.rigs.some((r) => r.typeId === rig.typeId) || current.rigs.length >= 3) return
    setFactory({ ...current, rigs: [...current.rigs, rig] })
    setRigQuery('')
  }
  const removeRig = (typeId: number) => setFactory({ ...current, rigs: current.rigs.filter((r) => r.typeId !== typeId) })
  const setSystem = (systemId: number, name: string) => {
    setFactory({ ...current, solarSystemId: systemId, solarSystemName: name })
    setSystemQuery('')
  }
  const clearSystem = () => setFactory({ ...current, solarSystemId: null, solarSystemName: '' })
  const setFacilityTaxPct = (pct: number) => setFactory({ ...current, facilityTaxPct: Math.max(0, Math.min(15, pct)) })

  return (
    <div className="space-y-2">
      <SectionHeading title={t('industry.settings.factory')} />
      <p className="text-[11px] text-zinc-500">{t('industry.settings.factoryHint')}</p>

      {enabled ? (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-100">
          {current.structureName}
          <button type="button" onClick={clearStructure} className="text-violet-300 hover:text-violet-100">
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {facilities.length === 0 ? (
            <span className="text-xs text-zinc-600">{t('industry.settings.facilitiesEmpty')}</span>
          ) : (
            facilities.map((f) => (
              <button
                key={f.typeId}
                type="button"
                onClick={() => setStructure(f.typeId, f.name)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-violet-500/40 hover:text-violet-100"
              >
                <Plus className="h-3 w-3" />
                {f.name}
              </button>
            ))
          )}
        </div>
      )}

      {enabled ? (
        <>
          {/* Security */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-zinc-500">{t('industry.settings.security')}</span>
            <div className="flex overflow-hidden rounded-md border border-zinc-800">
              {SECURITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSecurity(s)}
                  className={
                    current.security === s
                      ? 'bg-violet-500/20 px-2 py-1 text-[11px] text-violet-100'
                      : 'bg-zinc-950 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200'
                  }
                >
                  {t(`industry.settings.sec.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Rigs */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] text-zinc-500">{t('industry.settings.rigs')}</span>
            <div className="flex flex-wrap gap-1.5">
              {current.rigs.map((r) => (
                <span key={r.typeId} className="inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-100">
                  {r.name}
                  <button type="button" onClick={() => removeRig(r.typeId)} className="text-violet-300 hover:text-violet-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {current.rigs.length === 0 ? <span className="text-[11px] text-zinc-600">{t('industry.settings.none')}</span> : null}
            </div>
            {current.rigs.length < 3 ? (
              <div className="relative">
                <Input
                  value={rigQuery}
                  onChange={(e) => setRigQuery(e.target.value)}
                  placeholder={t('industry.settings.rigSearch')}
                  className="h-8 border-zinc-800 bg-zinc-900 text-xs"
                />
                {rigQuery.trim() && rigResults.length > 0 ? (
                  <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
                    {rigResults.map((r) => (
                      <li key={r.typeId}>
                        <button
                          type="button"
                          onClick={() => addRig(r)}
                          className="block w-full truncate px-2 py-1 text-left text-[11px] text-zinc-300 hover:bg-violet-500/10 hover:text-violet-100"
                        >
                          {r.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Manufacturing system (job cost) */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] text-zinc-500">{t('industry.settings.manufacturingSystem')}</span>
            <p className="text-[11px] text-zinc-600">{t('industry.settings.manufacturingSystemHint')}</p>
            {current.solarSystemId != null ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-100">
                {current.solarSystemName}
                <button type="button" onClick={clearSystem} className="text-violet-300 hover:text-violet-100">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <div className="relative">
                <Input
                  value={systemQuery}
                  onChange={(e) => setSystemQuery(e.target.value)}
                  placeholder={t('industry.settings.systemSearch')}
                  className="h-8 border-zinc-800 bg-zinc-900 text-xs"
                />
                {systemQuery.trim() && systemResults.length > 0 ? (
                  <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
                    {systemResults.map((s) => (
                      <li key={s.systemId}>
                        <button
                          type="button"
                          onClick={() => setSystem(s.systemId, s.name)}
                          className="block w-full truncate px-2 py-1 text-left text-[11px] text-zinc-300 hover:bg-violet-500/10 hover:text-violet-100"
                        >
                          {s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>

          {/* Facility tax */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-zinc-500">{t('industry.settings.facilityTax')}</span>
            <Input
              type="number"
              min={0}
              max={15}
              step={0.1}
              value={current.facilityTaxPct}
              onChange={(e) => setFacilityTaxPct(Number(e.target.value) || 0)}
              className="h-8 w-20 border-zinc-800 bg-zinc-900 text-xs"
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

function SalesTaxesSection({
  salesTaxPct,
  setSalesTaxPct,
  brokerFeePct,
  setBrokerFeePct,
}: {
  salesTaxPct: number | null
  setSalesTaxPct: (v: number | null) => void
  brokerFeePct: number | null
  setBrokerFeePct: (v: number | null) => void
}) {
  const { t } = useTranslations()

  const toPct = (raw: string): number | null => {
    if (raw.trim() === '') return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return Math.max(0, Math.min(20, n))
  }

  return (
    <div className="space-y-2">
      <SectionHeading title={t('industry.settings.salesTaxes')} />
      <p className="text-[11px] text-zinc-500">{t('industry.settings.salesTaxesHint')}</p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[11px] text-zinc-500">
          {t('industry.settings.salesTax')}
          <Input
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={salesTaxPct ?? ''}
            onChange={(e) => setSalesTaxPct(toPct(e.target.value))}
            className="h-8 w-20 border-zinc-800 bg-zinc-900 text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-zinc-500">
          {t('industry.settings.brokerFee')}
          <Input
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={brokerFeePct ?? ''}
            onChange={(e) => setBrokerFeePct(toPct(e.target.value))}
            className="h-8 w-20 border-zinc-800 bg-zinc-900 text-xs"
          />
        </label>
      </div>
    </div>
  )
}

export function IndustrySettingsModal({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [buyHubs, setBuyHubs] = useState<IndustryHub[]>([])
  const [sellHub, setSellHub] = useState<IndustryHub | null>(null)
  const [defaultMe, setDefaultMe] = useState(0)
  const [npcHubs, setNpcHubs] = useState<IndustryHub[]>([])
  const [factory, setFactory] = useState<FactoryConfig | null>(null)
  const [monitoredStations, setMonitoredStations] = useState<IndustryHub[]>([])
  const [salesTaxPct, setSalesTaxPct] = useState<number | null>(null)
  const [brokerFeePct, setBrokerFeePct] = useState<number | null>(null)
  const [industryCharacterId, setIndustryCharacterId] = useState<number | null>(null)
  const [characters, setCharacters] = useState<{ id: number; name: string; isMain: boolean }[]>([])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/industry/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        const c: IndustryConfigData = d.config
        setBuyHubs(c.buyHubs)
        setSellHub(c.sellHub)
        setDefaultMe(c.defaultMe)
        setNpcHubs(d.npcHubs ?? [])
        setFactory(c.factory)
        setMonitoredStations(c.monitoredStations ?? [])
        setSalesTaxPct(c.salesTaxPct ?? null)
        setBrokerFeePct(c.brokerFeePct ?? null)
        setIndustryCharacterId(c.industryCharacterId ?? null)
        setCharacters(d.characters ?? [])
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [open])

  const addBuyHub = (hub: IndustryHub) => {
    setBuyHubs((prev) => (prev.some((h) => hubKey(h) === hubKey(hub)) ? prev : [...prev, hub]))
  }
  const removeBuyHub = (hub: IndustryHub) => {
    setBuyHubs((prev) => prev.filter((h) => hubKey(h) !== hubKey(hub)))
  }

  const availableNpc = npcHubs.filter((h) => !buyHubs.some((b) => hubKey(b) === hubKey(h)))

  const save = async () => {
    if (buyHubs.length === 0) {
      toast.error(t('industry.settings.needBuyHub'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/industry/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyHubs, sellHub, defaultMe, factory, monitoredStations, salesTaxPct, brokerFeePct, industryCharacterId }),
      })
      if (!res.ok) {
        toast.error(t('industry.settings.saveError'))
        return
      }
      toast.success(t('industry.settings.saved'))
      onSaved?.()
      onOpenChange(false)
    } catch {
      toast.error(t('industry.settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-eve-text">
            <Store className="h-4 w-4 text-violet-300" />
            {t('industry.settings.title')}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Buy hubs */}
            <div className="space-y-2">
              <SectionHeading title={t('industry.settings.buyHubs')} />
              <p className="text-[11px] text-zinc-500">{t('industry.settings.buyHubsHint')}</p>
              <div className="flex flex-wrap gap-2">
                {buyHubs.map((h) => (
                  <span
                    key={hubKey(h)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-100"
                  >
                    {h.name}
                    <button type="button" onClick={() => removeBuyHub(h)} className="text-violet-300 hover:text-violet-100">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {buyHubs.length === 0 ? <span className="text-xs text-zinc-600">{t('industry.settings.none')}</span> : null}
              </div>
              {availableNpc.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {availableNpc.map((h) => (
                    <button
                      key={hubKey(h)}
                      type="button"
                      onClick={() => addBuyHub(h)}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-violet-500/40 hover:text-violet-100"
                    >
                      <Plus className="h-3 w-3" />
                      {h.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="pt-1">
                <p className="mb-1 text-[11px] text-zinc-500">{t('industry.settings.addStructure')}</p>
                <StructurePicker
                  selected={null}
                  onSelect={(s: StructureHit) => addBuyHub({ kind: 'structure', id: s.structureId, name: s.name })}
                  onClear={() => undefined}
                />
              </div>
            </div>

            {/* Sell hub */}
            <div className="space-y-2">
              <SectionHeading title={t('industry.settings.sellHub')} />
              <p className="text-[11px] text-zinc-500">{t('industry.settings.sellHubHint')}</p>
              {sellHub ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-100">
                  {sellHub.name}
                  <button type="button" onClick={() => setSellHub(null)} className="text-violet-300 hover:text-violet-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {npcHubs.map((h) => (
                      <button
                        key={hubKey(h)}
                        type="button"
                        onClick={() => setSellHub(h)}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-violet-500/40 hover:text-violet-100"
                      >
                        <Plus className="h-3 w-3" />
                        {h.name}
                      </button>
                    ))}
                  </div>
                  <div className="pt-1">
                    <StructurePicker
                      selected={null}
                      onSelect={(s: StructureHit) => setSellHub({ kind: 'structure', id: s.structureId, name: s.name })}
                      onClear={() => undefined}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Factory (rigs) */}
            <FactorySection factory={factory} setFactory={setFactory} />

            {/* Monitored stations (deficit scanner) */}
            <div className="space-y-2">
              <SectionHeading title={t('industry.settings.monitored')} />
              <p className="text-[11px] text-zinc-500">{t('industry.settings.monitoredHint')}</p>
              <div className="flex flex-wrap gap-2">
                {monitoredStations.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-100">
                    {s.name}
                    <button
                      type="button"
                      onClick={() => setMonitoredStations((prev) => prev.filter((h) => h.id !== s.id))}
                      className="text-violet-300 hover:text-violet-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {monitoredStations.length === 0 ? <span className="text-xs text-zinc-600">{t('industry.settings.none')}</span> : null}
              </div>
              <StructurePicker
                selected={null}
                endpoint="/api/industry/market-structures"
                onSelect={(s: StructureHit) =>
                  setMonitoredStations((prev) =>
                    prev.some((h) => h.id === s.structureId) ? prev : [...prev, { kind: 'structure', id: s.structureId, name: s.name }]
                  )
                }
                onClear={() => undefined}
              />
            </div>

            {/* Default ME */}
            <div className="space-y-2">
              <SectionHeading title={t('industry.settings.defaultMe')} />
              <Input
                type="number"
                min={0}
                max={10}
                value={defaultMe}
                onChange={(e) => setDefaultMe(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                className="h-8 w-20 border-zinc-800 bg-zinc-900 text-xs"
              />
            </div>

            {/* Sales taxes (net profit) */}
            <SalesTaxesSection
              salesTaxPct={salesTaxPct}
              setSalesTaxPct={setSalesTaxPct}
              brokerFeePct={brokerFeePct}
              setBrokerFeePct={setBrokerFeePct}
            />

            {/* Industry character — its skills feed the ISK/h build time */}
            <div className="space-y-2">
              <SectionHeading title={t('industry.settings.industryCharacter')} />
              <p className="text-[11px] text-zinc-500">{t('industry.settings.industryCharacterHint')}</p>
              <select
                value={industryCharacterId ?? ''}
                onChange={(e) => setIndustryCharacterId(e.target.value ? Number(e.target.value) : null)}
                className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-200"
              >
                <option value="">{t('industry.settings.industryCharacterNone')}</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isMain ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('industry.settings.cancel')}
              </Button>
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('industry.settings.save')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
