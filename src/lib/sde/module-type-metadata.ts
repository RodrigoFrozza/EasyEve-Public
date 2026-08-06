/**
 * Module type metadata resolution: SDE (EveType/EveGroup) > ESI type payload > EVE Ref > Adam4EVE.
 * Dogma attrs/effects remain ESI-only elsewhere; this resolver is for catalog / display fields only.
 */

import { prisma } from '@/lib/prisma'
import type { IdentitySource } from '@/lib/sde/type-identity-external'
import {
  asNullableInt,
  fetchAdam4EveTypeIdentity,
  fetchEverefTypeIdentity,
} from '@/lib/sde/type-identity-external'

export type ModuleEveTypeRow = {
  id: number
  name: string
  groupId: number
  group: { name: string; categoryId: number }
} | null

export const MODULE_METADATA_QUALITY_WARNING =
  'Module catalog data was partially resolved via SDE and/or external fallbacks (EVE Ref / Adam4EVE). Fitting may not match the EVE client until re-synced from ESI.'

export type ModuleMetadataResolution = {
  name: string
  nameSource: IdentitySource
  groupId: number | null
  groupIdSource: IdentitySource
  categoryId: number | null
  categoryIdSource: IdentitySource
  groupName: string
  qualityWarning?: string
}

export async function resolveModuleTypeMetadata(params: {
  typeId: number
  esiType: {
    name?: string
    group_id?: number | null
    category_id?: number | null
  }
  eveType: ModuleEveTypeRow
  esiWalkGroupName: string | null | undefined
}): Promise<ModuleMetadataResolution> {
  const { typeId, esiType, eveType, esiWalkGroupName } = params
  const everef = await fetchEverefTypeIdentity(typeId)
  const adam = await fetchAdam4EveTypeIdentity(typeId)

  let nameSource: IdentitySource = 'unknown'
  let name: string
  if (eveType?.name) {
    name = eveType.name
    nameSource = 'sde'
  } else if (esiType.name && String(esiType.name).trim()) {
    name = String(esiType.name)
    nameSource = 'esi'
  } else {
    name = `Type ${typeId}`
    nameSource = 'unknown'
  }

  const sdeG = eveType ? asNullableInt(eveType.groupId) : null
  const esiG = asNullableInt(esiType.group_id)
  const efG = asNullableInt(everef?.group_id)
  const adG = asNullableInt(adam?.group_id)

  let groupId: number | null
  let groupIdSource: IdentitySource
  if (sdeG != null) {
    groupId = sdeG
    groupIdSource = 'sde'
  } else if (esiG != null) {
    groupId = esiG
    groupIdSource = 'esi'
  } else if (efG != null) {
    groupId = efG
    groupIdSource = 'everef'
  } else if (adG != null) {
    groupId = adG
    groupIdSource = 'adam4eve'
  } else {
    groupId = null
    groupIdSource = 'unknown'
  }

  const sdeCat =
    eveType?.group?.categoryId != null ? asNullableInt(eveType.group.categoryId) : null
  const esiCat = asNullableInt(esiType.category_id)
  const adCat = asNullableInt(adam?.category_id)

  let categoryId: number | null
  let categoryIdSource: IdentitySource
  if (sdeCat != null) {
    categoryId = sdeCat
    categoryIdSource = 'sde'
  } else if (esiCat != null) {
    categoryId = esiCat
    categoryIdSource = 'esi'
  } else if (adCat != null) {
    categoryId = adCat
    categoryIdSource = 'adam4eve'
  } else {
    categoryId = null
    categoryIdSource = 'unknown'
  }

  if (categoryId == null && groupId != null) {
    const row = await prisma.eveGroup.findUnique({
      where: { id: groupId },
      select: { categoryId: true },
    })
    const derived = row?.categoryId != null ? asNullableInt(row.categoryId) : null
    if (derived != null) {
      categoryId = derived
      categoryIdSource = 'sde'
    }
  }

  let groupName = (esiWalkGroupName ?? '').trim()
  if (!groupName && eveType?.group?.name) groupName = eveType.group.name.trim()
  if (!groupName && groupId != null) {
    const row = await prisma.eveGroup.findUnique({
      where: { id: groupId },
      select: { name: true },
    })
    groupName = row?.name?.trim() ?? ''
  }
  if (!groupName) groupName = 'Unknown'

  const needsExternalGroupWarning =
    groupIdSource === 'everef' || groupIdSource === 'adam4eve' || groupIdSource === 'unknown'
  const needsCategoryWarning =
    categoryIdSource === 'adam4eve' || categoryIdSource === 'unknown'
  const qualityWarning =
    needsExternalGroupWarning || needsCategoryWarning || nameSource === 'unknown'
      ? MODULE_METADATA_QUALITY_WARNING
      : undefined

  return {
    name,
    nameSource,
    groupId,
    groupIdSource,
    categoryId,
    categoryIdSource,
    groupName,
    qualityWarning,
  }
}
