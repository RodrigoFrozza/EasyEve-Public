import { NextResponse } from 'next/server'
import { resolveSkillCatalog } from '@/lib/sde'

/**
 * POST /api/sde/skill-catalog - Public, unauthenticated batch resolver for
 * skill type IDs -> { name, groupId, groupName }. Mirrors /api/sde/resolve-types
 * (also public, also local-SDE-only) but additionally carries the SDE group so
 * the Character Profile UI can group trained skills by category (e.g.
 * "Spaceship Command", "Gunnery") without guessing group membership client-side.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { typeIds } = body as { typeIds?: number[] }

    if (!typeIds || !Array.isArray(typeIds)) {
      return NextResponse.json({ error: 'typeIds array required' }, { status: 400 })
    }

    const catalog = await resolveSkillCatalog(typeIds)
    return NextResponse.json(catalog)
  } catch (error) {
    console.error('Error resolving skill catalog:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
