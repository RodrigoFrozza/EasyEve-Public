import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { prisma } from '@/lib/prisma'
import { ParsedFit } from './fit-parser'
import { Fit, Module, Drone, Fighter, CargoItem, ShipStats, FitSlot } from '@/types/fit'
import DogmaCalculator from '@/lib/dogma-calculator'

// EVE inventory category ids used to classify a `Name xN` line.
const CATEGORY_DRONE = 18
const CATEGORY_FIGHTER = 87
const CATEGORY_CHARGE = 8

export class FitResolver {
  /** Resolve any published SDE type by exact (case-insensitive) name. */
  private static async resolveTypeByName(
    name: string
  ): Promise<{ id: number; name: string; categoryId: number } | null> {
    const trimmed = name.trim()
    if (!trimmed) return null
    const type = await prisma.eveType.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' }, published: true },
      select: { id: true, name: true, group: { select: { categoryId: true } } },
    })
    if (!type) return null
    return { id: type.id, name: type.name, categoryId: type.group.categoryId }
  }

  /** Resolve a loaded charge name to its typeId, only if it really is a Charge. */
  private static async resolveChargeByName(
    name: string
  ): Promise<{ id: number; name: string } | null> {
    const type = await this.resolveTypeByName(name)
    if (!type || type.categoryId !== CATEGORY_CHARGE) return null
    return { id: type.id, name: type.name }
  }

  /**
   * Resolves raw names from parser to actual EVE Type IDs and organizes them into slots.
   */
  static async resolve(parsed: ParsedFit): Promise<Partial<Fit>> {
    // 1. Resolve Ship
    const shipStats = await DogmaCalculator.getShipByName(parsed.shipName)
    if (!shipStats) {
      throw new AppError(
        ErrorCodes.API_NOT_FOUND,
        `Ship not found: ${parsed.shipName}`,
        404
      )
    }

    const fitSlot: FitSlot = {
      high: [],
      med: [],
      low: [],
      rig: [],
      subsystem: [],
      drone: [],
      cargo: []
    }

    const resolvedModules: Module[] = []
    const resolvedDrones: Drone[] = []
    const resolvedFighters: Fighter[] = []
    const resolvedCargo: CargoItem[] = []

    // 2. Resolve Modules and assign slots
    for (const mod of parsed.modules) {
      const dbMod = await DogmaCalculator.getModuleByName(mod.name || '')
      if (dbMod) {
        const slotType = this.mapSlotType(dbMod.slotType)

        // Resolve the loaded charge (if any) — only attach it if the name really
        // resolves to a Charge, so a stray comma in a module name is ignored.
        const charge = mod.charge?.name ? await this.resolveChargeByName(mod.charge.name) : null
        const chargePayload = charge ? { id: charge.id, name: charge.name, quantity: 1 } : undefined

        // Safety check for slot mapping
        if (slotType && fitSlot[slotType]) {
          const fitMod: Module = {
            typeId: dbMod.typeId,
            name: dbMod.name,
            offline: mod.state === 'passive',
            slot: slotType,
            ...(chargePayload ? { charge: chargePayload } : {}),
          }
          fitSlot[slotType]!.push(fitMod) // Using ! because we know the key exists after mapping
        }

        resolvedModules.push({
          id: String(dbMod.typeId),
          typeId: dbMod.typeId,
          name: dbMod.name,
          slot: slotType as any,
          state: mod.state,
          ...(chargePayload ? { charge: chargePayload } : {}),
        } as any)
      }
    }

    // 3. Resolve drones / fighters / cargo — every `Name xN` line lands here and
    // is classified by the resolved type's category (Pyfa does the same). All
    // three share the EFT syntax, so guessing by position is wrong.
    for (const item of parsed.quantityItems) {
      const type = await this.resolveTypeByName(item.name)
      if (!type) continue

      if (type.categoryId === CATEGORY_DRONE) {
        const dbDrone = await DogmaCalculator.getModuleByName(item.name)
        if (dbDrone) {
          fitSlot.drone?.push({
            typeId: dbDrone.typeId,
            name: dbDrone.name,
            quantity: item.quantity,
            slot: 'drone' as any,
          })
          resolvedDrones.push({ id: dbDrone.typeId, name: dbDrone.name, quantity: item.quantity })
        } else {
          resolvedDrones.push({ id: type.id, name: type.name, quantity: item.quantity })
        }
      } else if (type.categoryId === CATEGORY_FIGHTER) {
        // Fighters are not modelled by the engine yet (see Brain), but keep them
        // for round-trip so a carrier fit doesn't silently lose its fighters.
        resolvedFighters.push({ id: type.id, name: type.name, quantity: item.quantity })
      } else {
        resolvedCargo.push({ id: type.id, name: type.name, quantity: item.quantity })
      }
    }

    // 4. Calculate Snapshot Stats
    const calculated = await DogmaCalculator.calculateFitStats(shipStats, fitSlot)
    
    // 5. Build ShipStats Snapshot
    const snapshot: ShipStats = {
      groupId: shipStats.groupId,
      rigSize: shipStats.rigSize,
      cpu: {
        total: calculated.cpu.total,
        used: calculated.cpu.used,
        remaining: calculated.cpu.remaining,
        percent: (calculated.cpu.used / calculated.cpu.total) * 100,
        overflow: calculated.cpu.overflow
      },
      power: {
        total: calculated.power.total,
        used: calculated.power.used,
        remaining: calculated.power.remaining,
        percent: (calculated.power.used / calculated.power.total) * 100,
        overflow: calculated.power.overflow
      },
      powergrid: {
        total: calculated.power.total,
        used: calculated.power.used,
        remaining: calculated.power.remaining,
        percent: (calculated.power.used / calculated.power.total) * 100
      },
      calibration: {
        total: (calculated.slots.rig.total || 0) * 100,
        used: (calculated.slots.rig.used || 0) * 100,
        remaining: ((calculated.slots.rig.total || 0) - (calculated.slots.rig.used || 0)) * 100,
        percent: calculated.slots.rig.total > 0 ? (calculated.slots.rig.used / calculated.slots.rig.total) * 100 : 0,
        overflow: calculated.slots.rig.overflow
      },
      slots: {
        high: { used: calculated.slots.high.used, total: calculated.slots.high.total, overflow: calculated.slots.high.overflow },
        med: { used: calculated.slots.med.used, total: calculated.slots.med.total, overflow: calculated.slots.med.overflow },
        low: { used: calculated.slots.low.used, total: calculated.slots.low.total, overflow: calculated.slots.low.overflow },
        rig: { used: calculated.slots.rig.used, total: calculated.slots.rig.total, overflow: calculated.slots.rig.overflow }
      },
      capacitor: {
        capacity: calculated.capacitor.capacity,
        rechargeRate: calculated.capacitor.rechargeRate,
        peakDelta: calculated.capacitor.deltaPerSecond,
        stable: calculated.capacitor.stable,
        percent: calculated.capacitor.percent,
        usePerSecond: calculated.capacitor.usePerSecond,
        deltaPerSecond: calculated.capacitor.deltaPerSecond,
        timeToEmpty: calculated.capacitor.timeToEmpty
      },
      tank: {
        shield: { 
          hp: calculated.tank.shield.hp, 
          regen: calculated.tank.shield.regen, 
          maxRegen: calculated.tank.shield.maxRegen 
        },
        armor: { 
          hp: calculated.tank.armor.hp, 
          repair: calculated.tank.armor.repair 
        },
        hull: { 
          hp: calculated.tank.hull.hp, 
          repair: calculated.tank.hull.repair 
        }
      },
      resistance: {
        shield: { 
          em: calculated.resistance.shield.em, 
          therm: calculated.resistance.shield.therm, 
          kin: calculated.resistance.shield.kin, 
          exp: calculated.resistance.shield.exp 
        },
        armor: { 
          em: calculated.resistance.armor.em, 
          therm: calculated.resistance.armor.therm, 
          kin: calculated.resistance.armor.kin, 
          exp: calculated.resistance.armor.exp 
        },
        hull: { 
          em: calculated.resistance.hull.em, 
          therm: calculated.resistance.hull.therm, 
          kin: calculated.resistance.hull.kin, 
          exp: calculated.resistance.hull.exp 
        }
      },
      ehp: { 
        shield: calculated.ehp.shield, 
        armor: calculated.ehp.armor, 
        hull: calculated.ehp.hull, 
        total: calculated.ehp.total 
      },
      dps: { 
        total: calculated.dps.total, 
        turret: calculated.dps.turret, 
        missile: calculated.dps.missile, 
        drone: calculated.dps.drone 
      },
      targeting: {
        maxTargets: calculated.targeting.maxTargets,
        range: calculated.targeting.range,
        scanRes: calculated.targeting.scanRes,
        sensorStrength: 0, // Not yet implemented in calculator
        signature: 0      // Not yet implemented in calculator
      },
      velocity: {
        maxSpeed: 0,   // Not yet implemented
        alignTime: calculated.velocity.alignTime,
        warpSpeed: calculated.velocity.warpSpeed
      },
      mass: calculated.mass,
      agility: calculated.agility,
      cost: 0,
      hardpoints: {
        turrets: { used: calculated.hardpoints?.turrets?.used || 0, total: calculated.hardpoints?.turrets?.total || 0, overflow: calculated.hardpoints?.turrets?.overflow || false },
        launchers: { used: calculated.hardpoints?.launchers?.used || 0, total: calculated.hardpoints?.launchers?.total || 0, overflow: calculated.hardpoints?.launchers?.overflow || false }
      },
      volley: { total: calculated.volley?.total || 0 },
      range: { optimal: calculated.range?.optimal || 0, falloff: calculated.range?.falloff || 0 },
      slotHistory: {},
      history: {},
      validation: calculated.validation
    }

    const slotIndexByType: Record<string, number> = {}
    for (const m of resolvedModules) {
      const s = (m.slot || 'low') as string
      const idx = slotIndexByType[s] ?? 0
      slotIndexByType[s] = idx + 1
      m.slotIndex = idx
    }

    return {
      name: parsed.fitName,
      ship: parsed.shipName,
      shipId: shipStats.typeId,
      modules: resolvedModules,
      drones: resolvedDrones,
      fighters: resolvedFighters,
      cargo: resolvedCargo,
      esiData: snapshot
    }
  }

  private static mapSlotType(
    slotType: string | null | undefined
  ): 'high' | 'med' | 'low' | 'rig' | 'subsystem' | undefined {
    if (!slotType) return 'low'
    const low = slotType.toLowerCase()
    if (low.includes('subsystem')) return 'subsystem'
    if (low.includes('high')) return 'high'
    if (low.includes('med')) return 'med'
    if (low.includes('low')) return 'low'
    if (low.includes('rig')) return 'rig'
    return 'low'
  }
}

