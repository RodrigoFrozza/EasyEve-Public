'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { StructureCombobox, ContainerCombobox } from '@/components/ui/combobox'
import { CharacterScopesDialog } from '@/components/character-actions/CharacterScopesDialog'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import type { LocationDiscoveryFailureReason } from '@/lib/esi-location-discovery'

type AutoLootValidation = 'idle' | 'valid' | 'invalid' | 'checking' | 'multiple'

type CharacterOption = {
  id: number
  name: string
}

function discoveryErrorHint(reason: LocationDiscoveryFailureReason | null, t: (key: string) => string): string | null {
  switch (reason) {
    case 'missing_scopes':
      return t('activity.autoLootMissingScopes')
    case 'rate_limited':
      return t('activity.autoLootRateLimited')
    case 'network':
      return t('activity.autoLootNetworkError')
    case 'no_valid_locations':
      return t('activity.autoLootNoValidLocations')
    default:
      return null
  }
}

type AutoLootData = {
  autoLootTrackingEnabled?: boolean
  autoLootCharacterId?: number
  autoLootSourceMode?: 'structure' | 'mtu'
  autoLootStructureId?: number
  autoLootStructureName?: string
  autoLootContainerId?: number
  autoLootContainerName?: string
}

interface AutoLootTrackingPanelProps {
  featureEnabled: boolean
  validation: AutoLootValidation
  characters: CharacterOption[]
  data: AutoLootData
  onHelpClick: () => void
  onChange: (patch: Partial<AutoLootData>) => void
}

export function AutoLootTrackingPanel({
  featureEnabled,
  validation,
  characters,
  data,
  onHelpClick,
  onChange,
}: AutoLootTrackingPanelProps) {
  const { t } = useTranslations()
  const [discoveryError, setDiscoveryError] = useState<LocationDiscoveryFailureReason | null>(null)
  const [scopesDialogOpen, setScopesDialogOpen] = useState(false)
  const [characterScopes, setCharacterScopes] = useState<string[]>([])
  const [characterEsiApp, setCharacterEsiApp] = useState('main')

  const clearAutoLootFields = (): Partial<AutoLootData> => ({
    autoLootTrackingEnabled: false,
    autoLootCharacterId: undefined,
    autoLootSourceMode: undefined,
    autoLootContainerId: undefined,
    autoLootContainerName: undefined,
    autoLootStructureId: undefined,
    autoLootStructureName: undefined,
  })

  const sourceMode = data.autoLootSourceMode || 'structure'

  const handleDiscoveryError = (reason: LocationDiscoveryFailureReason) => {
    setDiscoveryError(reason)
    if (reason !== 'missing_scopes' || !data.autoLootCharacterId) return

    fetch(`/api/characters/${data.autoLootCharacterId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((character: { scopes?: string[]; esiApp?: string } | null) => {
        if (!character) return
        setCharacterScopes(character.scopes || [])
        setCharacterEsiApp(character.esiApp || 'main')
      })
      .catch(() => {})
  }

  return (
    <div className="space-y-2 col-span-1 sm:col-span-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-[10px] font-bold uppercase tracking-tight text-zinc-400">
            {t('activity.tracker.launch.autoLootTracking')}
          </Label>
          {!featureEnabled && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 leading-none bg-red-500/10 text-red-400 border-red-500/20 font-black uppercase">
              Disabled
            </Badge>
          )}
          {featureEnabled && (
            <>
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 leading-none bg-blue-500/10 text-blue-400 border-blue-500/20 font-black uppercase">
                New
              </Badge>
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 leading-none bg-orange-500/10 text-orange-400 border-orange-500/20 font-black uppercase">
                Beta
              </Badge>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onHelpClick}
            className="h-5 w-5 rounded-full border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-[10px] font-bold"
            aria-label="Auto loot tracking help"
          >
            ?
          </button>
          <Switch
            disabled={!featureEnabled}
            checked={!!data.autoLootTrackingEnabled}
            onCheckedChange={(checked) => {
              if (!featureEnabled) return
              onChange(checked ? { autoLootTrackingEnabled: true } : clearAutoLootFields())
            }}
          />
        </div>
      </div>

      {data.autoLootTrackingEnabled && (
        <div
          className={cn(
            'space-y-3 rounded-xl border p-3',
            validation === 'valid'
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : validation === 'invalid'
                ? 'border-red-500/40 bg-red-500/5'
                : 'border-zinc-800 bg-zinc-900/40'
          )}
        >
          <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 w-fit">
            {(['structure', 'mtu'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={!featureEnabled}
                onClick={() => {
                  if (!featureEnabled || mode === sourceMode) return
                  onChange({
                    autoLootSourceMode: mode,
                    autoLootStructureId: undefined,
                    autoLootStructureName: undefined,
                    autoLootContainerId: undefined,
                    autoLootContainerName: undefined,
                  })
                }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight transition-colors',
                  sourceMode === mode
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {mode === 'structure' ? t('activity.autoLootSourceStructure') : t('activity.autoLootSourceMtu')}
              </button>
            ))}
          </div>

          <div className={cn('grid grid-cols-1 gap-3', sourceMode === 'mtu' ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
            <div className="space-y-1">
              <Label className="text-[10px] text-zinc-500 uppercase font-bold">Character</Label>
              <Select
                value={String(data.autoLootCharacterId || '')}
                onValueChange={(value) => {
                  if (!featureEnabled) return
                  onChange({
                    autoLootCharacterId: Number(value),
                    autoLootContainerId: undefined,
                    autoLootContainerName: undefined,
                    autoLootStructureId: undefined,
                    autoLootStructureName: undefined,
                  })
                }}
                disabled={!featureEnabled}
              >
                <SelectTrigger className="h-9 bg-zinc-900 border-zinc-800">
                  <SelectValue placeholder={t('activity.selectCharacter')} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {characters.map((char) => (
                    <SelectItem key={char.id} value={String(char.id)} className="text-xs">
                      {char.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sourceMode === 'structure' && (
              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-500 uppercase font-bold">Location</Label>
                <StructureCombobox
                  characterId={data.autoLootCharacterId || null}
                  value={
                    data.autoLootStructureId
                      ? {
                          id: data.autoLootStructureId,
                          name: data.autoLootStructureName || '',
                          solarSystem: '',
                          assetCount: 0,
                        }
                      : null
                  }
                  onChange={(structure) => {
                    setDiscoveryError(null)
                    if (!structure) {
                      onChange({
                        autoLootStructureId: undefined,
                        autoLootStructureName: undefined,
                        autoLootContainerId: undefined,
                        autoLootContainerName: undefined,
                      })
                    } else {
                      onChange({
                        autoLootStructureId: structure.id,
                        autoLootStructureName: structure.name,
                        autoLootContainerId: undefined,
                        autoLootContainerName: undefined,
                      })
                    }
                  }}
                  onError={handleDiscoveryError}
                  disabled={!featureEnabled || !data.autoLootCharacterId}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[10px] text-zinc-500 uppercase font-bold">
                {sourceMode === 'mtu' ? 'MTU' : 'Container'}
              </Label>
              <ContainerCombobox
                mode={sourceMode === 'mtu' ? 'mtu' : 'container'}
                characterId={data.autoLootCharacterId || null}
                structureId={data.autoLootStructureId || null}
                value={
                  data.autoLootContainerId
                    ? {
                        itemId: data.autoLootContainerId,
                        typeId: 0,
                        typeName: data.autoLootContainerName || '',
                        customName: data.autoLootContainerName || '',
                        locationId: data.autoLootStructureId || 0,
                        locationName: data.autoLootStructureName || '',
                      }
                    : null
                }
                onChange={(container) => {
                  setDiscoveryError(null)
                  if (!container) {
                    onChange({
                      autoLootContainerId: undefined,
                      autoLootContainerName: undefined,
                    })
                  } else {
                    onChange({
                      autoLootContainerId: container.itemId,
                      autoLootContainerName: container.customName,
                    })
                  }
                }}
                onError={handleDiscoveryError}
                disabled={
                  !data.autoLootCharacterId || (sourceMode === 'structure' && !data.autoLootStructureId)
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                'text-[10px] uppercase font-bold tracking-tight',
                validation === 'valid'
                  ? 'text-emerald-400'
                  : validation === 'invalid'
                    ? 'text-red-400'
                    : 'text-zinc-500'
              )}
            >
              {validation === 'checking' && t('common.loading')}
              {validation === 'valid' &&
                `${t('activity.trackingLabel')}: ${data.autoLootContainerName || t('common.unknown')}`}
              {validation === 'invalid' &&
                (discoveryErrorHint(discoveryError, t) || t('activity.noContainersFound'))}
              {validation === 'idle' &&
                (discoveryErrorHint(discoveryError, t) ||
                  (sourceMode === 'mtu' ? t('activity.selectMtuHint') : t('activity.selectStructureContainerHint')))}
            </p>
            {discoveryError === 'missing_scopes' && (
              <button
                type="button"
                onClick={() => setScopesDialogOpen(true)}
                className="text-[10px] font-bold uppercase tracking-tight text-cyan-400 underline hover:text-cyan-300"
              >
                {t('activity.autoLootViewScopes')}
              </button>
            )}
          </div>
        </div>
      )}

      <CharacterScopesDialog
        open={scopesDialogOpen}
        onOpenChange={setScopesDialogOpen}
        scopes={characterScopes}
        esiApp={characterEsiApp}
        hideTrigger
      />
    </div>
  )
}
