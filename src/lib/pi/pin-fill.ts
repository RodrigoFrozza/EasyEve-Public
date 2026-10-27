import { getCommodityVolume, getPinCapacityM3, getPinRole } from '@/lib/pi/pi-static-data'
import type { PiColonyLayout } from '@/lib/pi/types'

export interface PiPinNode {
  pinId: number
  typeId: number
  role: ReturnType<typeof getPinRole>
  capacityM3: number
  usedM3: number
  contents: Array<{ typeId: number; amount: number }>
}

export type StoreRole = 'storage' | 'launchpad' | 'command_center'

export function isExportStoreRole(role: ReturnType<typeof getPinRole>): role is StoreRole {
  return role === 'launchpad' || role === 'command_center' || role === 'storage'
}

export function buildPinNodes(layout: PiColonyLayout): PiPinNode[] {
  return layout.pins
    .filter((p) => isExportStoreRole(getPinRole(p.type_id)))
    .map((pin) => {
      const role = getPinRole(pin.type_id)
      const capacityM3 = getPinCapacityM3(pin.type_id)
      const contents = (pin.contents ?? []).map((c) => ({
        typeId: c.type_id,
        amount: c.amount,
      }))

      const usedM3 = contents.reduce(
        (sum, c) => sum + c.amount * getCommodityVolume(c.typeId),
        0
      )

      return {
        pinId: pin.pin_id,
        typeId: pin.type_id,
        role,
        capacityM3,
        usedM3,
        contents,
      }
    })
}
