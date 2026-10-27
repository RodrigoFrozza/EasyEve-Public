import { classifyColonyRole, classifyColonyRoleFromPinRoles } from '@/lib/pi/colony-role'
import type { PiColonyLayout } from '@/lib/pi/types'

function layoutWithPins(
  specs: Array<{ pin_id: number; type_id: number; factory_details?: { schematic_id: number } }>
): PiColonyLayout {
  return { links: [], routes: [], pins: specs }
}

describe('colony-role', () => {
  it('classifies integrated extract-and-manufacture planets', () => {
    const layout = layoutWithPins([
      { pin_id: 1, type_id: 3060 },
      { pin_id: 2, type_id: 2541 },
      { pin_id: 3, type_id: 2469, factory_details: { schematic_id: 126 } },
      { pin_id: 4, type_id: 2256 },
    ])
    expect(classifyColonyRole(layout)).toBe('integrated')
  })

  it('classifies factory-only planets', () => {
    const layout = layoutWithPins([
      { pin_id: 1, type_id: 2256 },
      { pin_id: 2, type_id: 2472, factory_details: { schematic_id: 73 } },
      { pin_id: 3, type_id: 2541 },
    ])
    expect(classifyColonyRole(layout)).toBe('factory_only')
  })

  it('classifies extraction-only planets', () => {
    const layout = layoutWithPins([
      { pin_id: 1, type_id: 3060 },
      { pin_id: 2, type_id: 2541 },
      { pin_id: 3, type_id: 2256 },
    ])
    expect(classifyColonyRole(layout)).toBe('extraction_only')
  })

  it('returns unknown when no extractors or factories', () => {
    expect(classifyColonyRoleFromPinRoles(['launchpad', 'storage'])).toBe('unknown')
  })
})
