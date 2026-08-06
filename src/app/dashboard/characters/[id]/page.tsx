import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { CharacterProfileOwnerClient } from './CharacterProfileOwnerClient'

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CharacterProfileOwnerPage({ params }: PageProps) {
  const { id } = await params
  const characterId = parseInt(id, 10)

  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  if (!Number.isFinite(characterId)) notFound()

  const [character, user] = await Promise.all([
    prisma.character.findFirst({
      where: { id: characterId, userId: session.user.id },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { accountCode: true },
    }),
  ])

  if (!character) notFound()

  return (
    <CharacterProfileOwnerClient characterId={character.id} accountCode={user?.accountCode || ''} />
  )
}
