import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await prisma.modulePrice.upsert({
      where: { module: 'fits' },
      update: { isActive: true },
      create: { 
        module: 'fits', 
        price: 0, 
        isActive: true 
      }
    })
    return NextResponse.json({ success: true, message: 'Fits module activated', result })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
