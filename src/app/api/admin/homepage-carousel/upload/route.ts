import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: NextRequest) => {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Only images are allowed (JPG, PNG, WEBP, GIF).' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Generate unique filename
  const fileExtension = path.extname(file.name) || `.${file.type.split('/')[1]}`
  const hash = crypto.randomBytes(8).toString('hex')
  const fileName = `${Date.now()}-${hash}${fileExtension}`
  
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'carousel')
  const filePath = path.join(uploadDir, fileName)

  // Ensure directory exists (just in case)
  try {
    await mkdir(uploadDir, { recursive: true })
  } catch (err) {
    // Directory might already exist
  }

  await writeFile(filePath, buffer)

  return NextResponse.json({ 
    success: true, 
    url: `/uploads/carousel/${fileName}` 
  })
}))
