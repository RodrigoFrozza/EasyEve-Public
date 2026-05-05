'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Loader2, X } from 'lucide-react'

interface ChargeOption {
  id: number
  name: string
  groupId: number
  groupName: string
  damage?: {
    em: number
    therm: number
    kin: number
    exp: number
  }
}

interface ChargeSelectorProps {
  moduleId: number
  moduleName: string
  currentCharge?: { id: number; name: string } | null
  onSelect: (charge: { id: number; name: string } | null) => void
}

export function ChargeSelector({
  moduleId,
  moduleName,
  currentCharge,
  onSelect
}: ChargeSelectorProps) {
  const [charges, setCharges] = useState<Record<string, ChargeOption[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCharges() {
      try {
        const res = await fetch(`/api/charges/compatible?moduleTypeId=${moduleId}`)
        const data = await res.json()
        
        if (data.success) {
          setCharges(data.groupedCharges || {})
        } else {
          setError(data.error || 'Failed to load charges')
        }
      } catch {
        setError('Failed to load charges')
      } finally {
        setLoading(false)
      }
    }
    
    fetchCharges()
  }, [moduleId])

  const handleSelectCharge = useCallback((charge: ChargeOption) => {
    onSelect({ id: charge.id, name: charge.name })
  }, [onSelect])

  const handleClearCharge = useCallback(() => {
    onSelect(null)
  }, [onSelect])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-zinc-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="text-[10px]">Loading charges...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-2 py-1.5 text-zinc-400 text-[10px]">
        {error}
      </div>
    )
  }

  const groupEntries = Object.entries(charges)
  
  if (groupEntries.length === 0) {
    return (
      <div className="px-2 py-1.5 text-zinc-400 text-[10px]">
        No compatible charges
      </div>
    )
  }

  return (
    <div className="py-1">
      {currentCharge && (
        <div className="px-2 pb-1.5 border-b border-white/10">
          <button
            onClick={handleClearCharge}
            className="flex items-center gap-1.5 w-full text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
          >
            <X className="w-3 h-3" />
            Remove {currentCharge.name}
          </button>
        </div>
      )}
      
      {groupEntries.map(([groupName, groupCharges]) => {
        const isOpen = openGroup === groupName
        const displayCharges = isOpen ? groupCharges : groupCharges.slice(0, 5)
        
        return (
          <div key={groupName}>
            <button
              onClick={() => setOpenGroup(isOpen ? null : groupName)}
              className={cn(
                "w-full px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-white transition-colors text-left",
                isOpen && "text-white"
              )}
            >
              {groupName}
              <span className="ml-1 text-zinc-600">({groupCharges.length})</span>
            </button>
            
            {isOpen && (
              <div className="pl-2">
                {displayCharges.map((charge) => (
                  <button
                    key={charge.id}
                    onClick={() => handleSelectCharge(charge)}
                    className={cn(
                      "flex items-center gap-1.5 w-full px-2 py-1 text-[10px] hover:bg-white/10 transition-colors",
                      currentCharge?.id === charge.id && "bg-orange-500/20 text-orange-400"
                    )}
                  >
                    <Image
                      src={`https://images.evetech.net/types/${charge.id}/icon?size=16`}
                      alt={charge.name}
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                    />
                    <span className="truncate flex-1 text-left">{charge.name}</span>
                    {charge.damage && (charge.damage.em + charge.damage.therm + charge.damage.kin + charge.damage.exp) > 0 && (
                      <span className="text-[8px] text-zinc-500">
                        {charge.damage.em > 0 && <span className="text-red-400">{charge.damage.em}</span>}
                        {charge.damage.therm > 0 && <span className="text-orange-400">{charge.damage.therm}</span>}
                        {charge.damage.kin > 0 && <span className="text-blue-400">{charge.damage.kin}</span>}
                        {charge.damage.exp > 0 && <span className="text-purple-400">{charge.damage.exp}</span>}
                      </span>
                    )}
                  </button>
                ))}
                {groupCharges.length > 5 && (
                  <div className="px-2 py-0.5 text-[9px] text-zinc-600">
                    +{groupCharges.length - 5} more
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
