import { Module, Drone, CargoItem } from '@/types/fit'

export interface ParsedFit {
  shipName: string
  fitName: string
  modules: Module[]
  drones: Drone[]
  cargo: CargoItem[]
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
      const drones: Drone[] = []
      const cargo: CargoItem[] = []

      // Heuristic for slots: EFT usually lists High, then Med, then Low, then Rigs, then Drones/Cargo
      // But since we are overhauling, we will use a more flexible detection
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line || line.toLowerCase() === '[empty high slot]' || line.toLowerCase() === '[empty med slot]' || line.toLowerCase() === '[empty low slot]' || line.toLowerCase() === '[empty rig slot]') continue

        // Detect quantity (for drones/cargo)
        const qtyMatch = line.match(/(.*) x(\d+)/)
        const name = qtyMatch ? qtyMatch[1].trim() : line.trim()
        const quantity = qtyMatch ? parseInt(qtyMatch[2], 10) : 1

        // Detect offline
        const isOffline = name.toLowerCase().endsWith('/offline')
        const cleanName = isOffline ? name.substring(0, name.length - 8).trim() : name

        // Detect charges (name, Charge Name)
        const chargeMatch = cleanName.match(/(.*), (.*)/)
        const actualName = chargeMatch ? chargeMatch[1].trim() : cleanName

        // For now, we put everything in a flat list of modules/drones/cargo
        // The backend/API will resolve these names to typeIds and slots
        
        if (qtyMatch) {
          // If it has quantity and we are late in the fit, it's likely drone or cargo
          // For now, EVE EFT convention: Drones often listed before Cargo
          // We'll let the resolver decide based on Item Group
          drones.push({ id: 0, name: actualName, quantity })
        } else {
          modules.push({
            typeId: 0,
            name: actualName,
            slot: 'high', // Placeholder, resolver will fix
            state: isOffline ? 'passive' : 'active'
          })
        }
      }

      fits.push({
        shipName,
        fitName,
        modules,
        drones,
        cargo
      })
    }

    return fits
  }

  /**
   * Generates EFT format string from a Fit object
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
    
    // Get modules organized by slot type
    const modules = fit.modules || []
    const highModules = modules.filter(m => m.slot === 'high')
    const medModules = modules.filter(m => m.slot === 'med')
    const lowModules = modules.filter(m => m.slot === 'low')
    const rigModules = modules.filter(m => m.slot === 'rig')
    
    const appendSlotSection = (
      mods: Module[],
      emptyLabel: string,
      maxSlots?: number
    ) => {
      for (const mod of mods) {
        const name = mod.name || `Module ${mod.id}`
        lines.push(mod.offline ? `${name} /offline` : name)
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
