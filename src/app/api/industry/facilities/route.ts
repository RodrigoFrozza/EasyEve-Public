export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Engineering Complex (Raitaru/Azbel/Sotiyo) + Refinery (Athanor/Tatara) — the
// industry facilities EVE Ref accepts as structure_type_id. Group ids verified
// against the SDE (groups.jsonl) on 2026-07-15.
const FACILITY_GROUP_IDS = [1404, 1406]

/**
 * The manufacturing structure types the user can pick as their factory. Read from
 * the SDE (never a hardcoded id list) so it stays correct across CCP changes.
 * Empty until the SDE types are populated.
 */
export async function GET() {
  const types = await prisma.eveType.findMany({
    where: { published: true, groupId: { in: FACILITY_GROUP_IDS } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ facilities: types.map((t) => ({ typeId: t.id, name: t.name })) })
}
