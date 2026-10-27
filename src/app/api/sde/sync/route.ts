import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'
import { syncFilamentTypes } from '@/lib/sde/filaments'

export async function POST() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'master') {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'Admin access required', 403)
  }
  
  try {
    await syncFilamentTypes()
    
    return NextResponse.json({ 
      success: true, 
      message: 'SDE data synchronized successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to sync SDE:', error)
    return NextResponse.json({ 
      error: 'Failed to sync SDE data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
