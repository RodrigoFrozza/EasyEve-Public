import { Module, Drone, CargoItem } from '@/types/fit'

/**
 * A line carrying `x{qty}` — a drone, fighter, or cargo item. EFT gives no
 * syntactic hint which one it is (all three use the same `Name xN` form), so
 * the parser keeps them together and the resolver classifies each by the
 * resolved type's category (the way Pyfa does it).
 */
export interface ParsedQuantityItem {
  name: string
  quantity: number
}

export interface ParsedFit {
  shipName: string
  fitName: string
  modules: Module[]
  quantityItems: ParsedQuantityItem[]
}

/**
 * Advanced EFT Parser (v2)
 * Supports multiple fits, drones, cargo and charges.
 */
export class FitParser {
  static parse(text: string): ParsedFit[] {
    const fits: ParsedFit[] = []
    const blocks = text.split(/\r?\n\r?\n(?=\[)/) // Split by double newline followed by [

    for (const block of blocks) {
      if (!block.trim().startsWith('[')) continue
      
      const lines = block.trim().split(/\r?\n/)
      if (lines.length === 0) continue

      // Parse Header: [Ship Name, Fit Name]
      const headerMatch = lines[0].match(/\[(.*),(.*)\]/)
      if (!headerMatch) continue

      const shipName = headerMatch[1].trim()
      const fitName = headerMatch[2].trim()

      const modules: Module[] = []
      const quantityItems: ParsedQuantityItem[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        const lower = line.toLowerCase()
        if (
          !line ||
          lower === '[empty high slot]' ||
          lower === '[empty med slot]' ||
          lower === '[empty low slot]' ||
          lower === '[empty rig slot]' ||
          lower === '[empty subsystem slot]'
        ) {
          continue
        }

        // A `Name xN` line is a drone, fighter, or cargo item — the resolver
        // decides which by the resolved type's category, so keep them together.
        const qtyMatch = line.match(/^(.*) x(\d+)$/)
        if (qtyMatch) {
          quantityItems.push({ name: qtyMatch[1].trim(), quantity: parseInt(qtyMatch[2], 10) })
          continue
        }

        // Detect offline (`/OFFLINE` or `/offline` suffix).
        const isOffline = line.toLowerCase().endsWith('/offline')
        const cleanName = isOffline ? line.slice(0, line.length - '/offline'.length).trim() : line

        // Split the loaded charge: `Module Name, Charge Name` (first comma wins;
        // the resolver validates the second half really is a Charge).
        const chargeMatch = cleanName.match(/^(.*?), (.*)$/)
        const actualName = chargeMatch ? chargeMatch[1].trim() : cleanName
        const chargeName = chargeMatch ? chargeMatch[2].trim() : undefined

        modules.push({
          typeId: 0,
          name: actualName,
          slot: 'high', // Placeholder, resolver assigns the real slot from the item.
          state: isOffline ? 'passive' : 'active',
          ...(chargeName ? { charge: { id: 0, name: chargeName, quantity: 1 } } : {}),
        })
      }

      fits.push({
        shipName,
        fitName,
        modules,
        quantityItems,
      })
    }

    return fits
  }

  /**
   * A single EFT module line: `Name`, `Name, Charge`, `Name /offline`, or
   * `Name, Charge /offline`. The loaded charge/ammo lives on `mod.charge.name`
   * — omitting it (the old behaviour) exported every weapon with no ammo, so a
   * pasted fit lost its loadout in-game and in Pyfa.
   */
  private static moduleToLine(mod: Module): string {
    let line = mod.name || `Module ${mod.id ?? mod.typeId}`
    if (mod.charge?.name) line += `, ${mod.charge.name}`
    if (mod.offline) line += ' /offline'
    return line
  }

  /**
   * Generates EFT format string from a Fit object.
   */
  static toEFT(fit: {
    ship: string
    shipId: number
    name?: string
    modules?: Module[]
    drones?: Drone[]
    cargo?: CargoItem[]
    slotLayout?: { high?: number; med?: number; low?: number; rig?: number }
  }): string {
    const lines: string[] = []

    // Header: [Ship Name, Fit Name]
    const fitName = fit.name || 'EasyEve Fit'
    lines.push(`[${fit.ship}, ${fitName}]`)

    // Get modules organized by slot type, preserving slot order within a rack.
    const modules = fit.modules || []
    const bySlot = (slot: Module['slot']) =>
      modules
        .filter(m => m.slot === slot)
        .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0))
    const highModules = bySlot('high')
    const medModules = bySlot('med')
    const lowModules = bySlot('low')
    const rigModules = bySlot('rig')
    const subsystemModules = bySlot('subsystem')

    const appendSlotSection = (
      mods: Module[],
      emptyLabel: string,
      maxSlots?: number
    ) => {
      for (const mod of mods) {
        lines.push(this.moduleToLine(mod))
      }

      // Only add empty-slot lines when caller explicitly provides slot capacity.
      // This avoids exporting a fixed padded layout for all hulls.
      if (typeof maxSlots === 'number' && Number.isFinite(maxSlots) && maxSlots > mods.length) {
        for (let i = mods.length; i < maxSlots; i++) {
          lines.push(emptyLabel)
        }
      }
    }

    // High slots
    appendSlotSection(highModules, '[Empty High Slot]', fit.slotLayout?.high)

    // Medium slots
    appendSlotSection(medModules, '[Empty Med Slot]', fit.slotLayout?.med)

    // Low slots
    appendSlotSection(lowModules, '[Empty Low Slot]', fit.slotLayout?.low)

    // Rigs
    appendSlotSection(rigModules, '[Empty Rig Slot]', fit.slotLayout?.rig)

    // Subsystems (T3 cruisers) — no empty-slot padding, they are always filled.
    if (subsystemModules.length > 0) {
      for (const mod of subsystemModules) lines.push(this.moduleToLine(mod))
    }

    // Drones
    const drones = fit.drones || []
    if (drones.length > 0) {
      lines.push('')
      for (const drone of drones) {
        const name = drone.name || `Drone ${drone.id}`
        lines.push(drone.quantity > 1 ? `${name} x${drone.quantity}` : name)
      }
    }

    // Cargo
    const cargo = fit.cargo || []
    if (cargo.length > 0) {
      lines.push('')
      for (const item of cargo) {
        const name = item.name || `Item ${item.id}`
        lines.push(item.quantity > 1 ? `${name} x${item.quantity}` : name)
      }
    }

    return lines.join('\n')
  }
}
