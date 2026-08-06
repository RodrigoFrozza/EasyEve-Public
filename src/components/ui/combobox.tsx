'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, Search, Check, X } from 'lucide-react'
import type { LocationDiscoveryFailureReason } from '@/lib/esi-location-discovery'

function reasonToMessage(reason: LocationDiscoveryFailureReason | null, kind: 'location' | 'container' | 'mtu'): string {
  switch (reason) {
    case 'missing_scopes':
      return 'Missing ESI scope — re-link this character to grant asset access.'
    case 'rate_limited':
      return 'EVE server is rate-limiting requests — try again shortly.'
    case 'network':
      return 'Could not reach EVE servers — try again shortly.'
    case 'no_valid_locations':
      return 'No stations or structures found in this character’s assets.'
    case 'empty':
      return kind === 'mtu' ? 'No MTUs found.' : 'No containers found.'
    default:
      return kind === 'location' ? 'No locations found' : kind === 'mtu' ? 'No MTUs found' : 'No containers found'
  }
}

export interface ComboboxOption<T = string> {
  value: T
  label: string
  description?: string
  icon?: React.ReactNode
  disabled?: boolean
}

interface ComboboxProps<T = string> {
  options: ComboboxOption<T>[]
  value: T | null
  onChange: (value: T | null) => void
  placeholder?: string
  emptyMessage?: string
  loading?: boolean
  disabled?: boolean
  className?: string
  allowClear?: boolean
  onSearch?: (query: string) => void
  searchDelay?: number
  /** Lets the user commit whatever they typed even if it matches no option
   *  (string values only) — for fields where the known-options list is a
   *  best-effort search, not the full set of valid values. */
  allowFreeText?: boolean
  freeTextLabel?: (query: string) => string
}

export function Combobox<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  emptyMessage = 'No results found.',
  loading = false,
  disabled = false,
  className,
  allowClear = false,
  onSearch,
  searchDelay = 300,
  allowFreeText = false,
  freeTextLabel = (query) => `Use "${query}"`,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [filteredOptions, setFilteredOptions] = useState(options)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (inputValue) {
      setFilteredOptions(options.filter(opt => 
        opt.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        opt.description?.toLowerCase().includes(inputValue.toLowerCase())
      ))
    } else {
      setFilteredOptions(options)
    }
  }, [options, inputValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setInputValue('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const handleSearch = (query: string) => {
    setInputValue(query)
    
    if (onSearch) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        onSearch(query)
      }, searchDelay)
    }
  }

  const handleSelect = (optValue: T) => {
    onChange(optValue)
    setOpen(false)
    setInputValue('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setInputValue('')
  }

  const selectedOption = options.find(opt => opt.value === value)
  const selectedLabel = selectedOption?.label ?? (allowFreeText && value ? String(value) : undefined)

  const trimmedQuery = inputValue.trim()
  const showFreeTextOption =
    allowFreeText &&
    trimmedQuery.length > 0 &&
    !filteredOptions.some((opt) => String(opt.value).toLowerCase() === trimmedQuery.toLowerCase())

  const handleCommitFreeText = () => {
    if (!trimmedQuery) return
    handleSelect(trimmedQuery as unknown as T)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm',
          'ring-offset-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-eve-accent focus:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'ring-1 focus:ring-eve-accent'
        )}
      >
        <span className={cn('truncate', !selectedLabel && 'text-zinc-500')}>
          {selectedLabel || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {allowClear && value && (
            <X
              className="h-4 w-4 text-zinc-500 hover:text-zinc-300"
              onClick={handleClear}
            />
          )}
          <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 shadow-lg">
          <div className="flex items-center border-b border-zinc-800 px-3">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search..."
              className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-zinc-500"
            />
          </div>

          <div className="max-h-[250px] overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-zinc-500">
                Loading...
              </div>
            ) : (
              <>
                {showFreeTextOption && (
                  <button
                    type="button"
                    onClick={handleCommitFreeText}
                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-eve-accent outline-none hover:bg-zinc-800"
                  >
                    <span className="truncate">{freeTextLabel(trimmedQuery)}</span>
                  </button>
                )}
                {filteredOptions.length === 0 && !showFreeTextOption && (
                  <div className="py-6 text-center text-sm text-zinc-500">
                    {emptyMessage}
                  </div>
                )}
              </>
            )}
            {!loading &&
              filteredOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  disabled={opt.disabled}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                    opt.disabled && 'cursor-not-allowed opacity-50',
                    opt.value === value && 'bg-eve-accent/10 text-eve-accent',
                    !opt.disabled && 'hover:bg-zinc-800'
                  )}
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate">{opt.label}</span>
                    {opt.description && (
                      <span className="truncate text-[10px] text-zinc-500">{opt.description}</span>
                    )}
                  </div>
                  {opt.value === value && (
                    <Check className="h-4 w-4 flex-shrink-0 text-eve-accent" />
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface StructureOption {
  id: number
  name: string
  solarSystem: string
  assetCount: number
}

interface ContainerOption {
  itemId: number
  typeId: number
  typeName: string
  customName: string
  locationId: number
  locationName: string
}

export function StructureCombobox({
  characterId,
  value,
  onChange,
  onError,
  disabled,
}: {
  characterId: number | null
  value: StructureOption | null
  onChange: (structure: StructureOption | null) => void
  onError?: (reason: LocationDiscoveryFailureReason) => void
  disabled?: boolean
}) {
  const [allStructures, setAllStructures] = useState<StructureOption[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [failureReason, setFailureReason] = useState<LocationDiscoveryFailureReason | null>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    setSearchQuery('')

    if (!characterId) {
      setAllStructures([])
      setFailureReason(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchStructures = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/characters/${characterId}/structures`,
          { signal: controller.signal }
        )

        if (!response.ok) {
          if (!cancelled) {
            setAllStructures([])
            setFailureReason('network')
            onErrorRef.current?.('network')
          }
          return
        }

        const result = await response.json() as
          | { ok: true; data: StructureOption[] }
          | { ok: false; reason: LocationDiscoveryFailureReason }

        if (cancelled) return

        if (result.ok) {
          setAllStructures(result.data)
          setFailureReason(null)
        } else {
          setAllStructures([])
          setFailureReason(result.reason)
          onErrorRef.current?.(result.reason)
        }
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          console.error('Failed to fetch structures:', error)
          if (!cancelled) {
            setAllStructures([])
            setFailureReason('network')
            onErrorRef.current?.('network')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStructures()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [characterId])

  const filteredStructures = searchQuery
    ? allStructures.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.solarSystem.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allStructures

  const options: ComboboxOption<number>[] = filteredStructures.map(s => ({
    value: s.id,
    label: s.name,
    description: `${s.solarSystem} · ${s.assetCount} items`,
  }))

  const handleChange = (val: number | null) => {
    if (!val) {
      onChange(null)
      return
    }
    const found = allStructures.find(s => s.id === val)
    if (found) {
      onChange(found)
    }
  }

  return (
    <Combobox
      options={options}
      value={value?.id ?? null}
      onChange={handleChange}
      placeholder="Select location"
      emptyMessage={loading ? 'Loading...' : reasonToMessage(failureReason, 'location')}
      loading={loading}
      disabled={disabled || !characterId}
      allowClear
      onSearch={setSearchQuery}
    />
  )
}

export function ContainerCombobox({
  characterId,
  structureId,
  mode = 'container',
  value,
  onChange,
  onError,
  disabled,
}: {
  characterId: number | null
  structureId: number | null
  mode?: 'container' | 'mtu'
  value: ContainerOption | null
  onChange: (container: ContainerOption | null) => void
  onError?: (reason: LocationDiscoveryFailureReason) => void
  disabled?: boolean
}) {
  const [allContainers, setAllContainers] = useState<ContainerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [failureReason, setFailureReason] = useState<LocationDiscoveryFailureReason | null>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const ready = mode === 'mtu' ? !!characterId : !!characterId && !!structureId

  useEffect(() => {
    setSearchQuery('')

    if (!ready || !characterId) {
      setAllContainers([])
      setFailureReason(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchContainers = async () => {
      setLoading(true)
      try {
        // Add timestamp to avoid caching
        const timestamp = Date.now()
        const params = new URLSearchParams()
        if (mode === 'mtu') {
          params.set('mtuMode', 'true')
        } else {
          params.set('containerMode', 'true')
          params.set('locationId', String(structureId))
        }
        params.set('_t', String(timestamp))
        const response = await fetch(
          `/api/characters/${characterId}/assets?${params}`,
          { signal: controller.signal }
        )

        if (!response.ok) {
          if (!cancelled) {
            setAllContainers([])
            setFailureReason('network')
            onErrorRef.current?.('network')
          }
          return
        }

        const result = await response.json() as
          | { ok: true; data: ContainerOption[] }
          | { ok: false; reason: LocationDiscoveryFailureReason }

        if (cancelled) return

        if (result.ok) {
          setAllContainers(result.data)
          setFailureReason(null)
        } else {
          setAllContainers([])
          setFailureReason(result.reason)
          onErrorRef.current?.(result.reason)
        }
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          console.error('Failed to fetch containers:', error)
          if (!cancelled) {
            setAllContainers([])
            setFailureReason('network')
            onErrorRef.current?.('network')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchContainers()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [characterId, structureId, mode, ready])

  const filteredContainers = searchQuery
    ? allContainers.filter(c =>
        c.customName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.typeName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allContainers

  const options: ComboboxOption<number>[] = filteredContainers.map(c => ({
    value: c.itemId,
    label: c.customName,
    description: c.typeName,
  }))

  const handleChange = (val: number | null) => {
    if (!val) {
      onChange(null)
      return
    }
    const found = allContainers.find(c => c.itemId === val)
    if (found) {
      onChange(found)
    }
  }

  return (
    <Combobox
      options={options}
      value={value?.itemId ?? null}
      onChange={handleChange}
      placeholder={mode === 'mtu' ? 'Select MTU' : 'Select container'}
      emptyMessage={loading ? 'Loading...' : reasonToMessage(failureReason, mode)}
      loading={loading}
      disabled={disabled || !ready}
      allowClear
      onSearch={setSearchQuery}
    />
  )
}