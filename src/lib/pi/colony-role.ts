import type { PiColonyLayout, PiColonyRole } from '@/lib/pi/types'
import { getPinRole, type PiPinRole } from '@/lib/pi/pi-static-data'

export type { PiColonyRole }

function isProcessorRole(role: PiPinRole): boolean {
  return (
    role === 'basic_processor' ||
    role === 'advanced_processor' ||
    role === 'high_tech_processor'
  )
}

/** Classify colony specialization from pin roles (layout or routing view). */
export function classifyColonyRoleFromPinRoles(roles: Iterable<PiPinRole>): PiColonyRole {
  let hasExtractor = false
  let hasFactory = false

  for (const role of roles) {
    if (role === 'extractor') hasExtractor = true
    if (isProcessorRole(role)) hasFactory = true
  }

  if (hasExtractor && hasFactory) {
    return 'integrated'
  }
  if (hasFactory && !hasExtractor) {
    return 'factory_only'
  }
  if (hasExtractor && !hasFactory) {
    return 'extraction_only'
  }

  return 'unknown'
}

export function classifyColonyRole(layout: PiColonyLayout): PiColonyRole {
  return classifyColonyRoleFromPinRoles(layout.pins.map((pin) => getPinRole(pin.type_id)))
}

export interface ColonyRoleStageLabels {
  input: string
  production: string
  export: string
  showProduction: boolean
}

export function colonyRoleStageLabels(role: PiColonyRole): ColonyRoleStageLabels {
  switch (role) {
    case 'integrated':
      return {
        input: 'pi.colonyRole.stage.integrated.input',
        production: 'pi.colonyRole.stage.integrated.production',
        export: 'pi.colonyRole.stage.export',
        showProduction: true,
      }
    case 'factory_only':
      return {
        input: 'pi.colonyRole.stage.factoryOnly.input',
        production: 'pi.colonyRole.stage.factoryOnly.production',
        export: 'pi.colonyRole.stage.export',
        showProduction: true,
      }
    case 'extraction_only':
      return {
        input: 'pi.colonyRole.stage.extractionOnly.input',
        production: 'pi.colonyRole.stage.extractionOnly.production',
        export: 'pi.colonyRole.stage.extractionOnly.export',
        showProduction: false,
      }
    case 'unknown':
      return {
        input: 'pi.chain.stageInput',
        production: 'pi.chain.stageProduction',
        export: 'pi.chain.stageExport',
        showProduction: true,
      }
    default: {
      const _exhaustive: never = role
      void _exhaustive
      return {
        input: 'pi.chain.stageInput',
        production: 'pi.chain.stageProduction',
        export: 'pi.chain.stageExport',
        showProduction: true,
      }
    }
  }
}
