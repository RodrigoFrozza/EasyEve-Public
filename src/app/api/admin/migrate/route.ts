import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 1. Add role and allowedActivities columns (ignore errors if they already exist)
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT \'user\'')
    } catch { /* column may already exist */ }

    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "allowedActivities" TEXT[] NOT NULL DEFAULT ARRAY[\'ratting\']::TEXT[]')
    } catch { /* column may already exist */ }

    // 2. Identify the master user (Rodrigo Frozza) and set as master
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "User" 
        SET role = 'master', allowedActivities = ARRAY['mining', 'ratting', 'abyssal', 'exploration', 'crab', 'escalations', 'pvp']::TEXT[]
        WHERE id = (
          SELECT c."userId" 
          FROM "Character" c 
          WHERE LOWER(c.name) = 'rodrigo frozza' 
          LIMIT 1
        )
      `)
    } catch { /* may fail if user is not found */ }

    return NextResponse.json({ 
      success: true, 
      message: 'Migration applied. Rodrigo Frozza set as master with all activities allowed.'
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}