import { readFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const filename = params.filename
  
  // Try multiple possible paths to find the uploaded image
  // This helps handle differences between local dev, Docker, and standalone builds
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'uploads', 'carousel', filename),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'uploads', 'carousel', filename),
    path.join('/app', 'public', 'uploads', 'carousel', filename) // Fallback for docker
  ]

  let filePath = ''
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      filePath = p
      break
    }
  }

  // If we still can't find it, fallback to the standard path and let it throw
  if (!filePath) {
    filePath = possiblePaths[0]
  }

  try {
    const buffer = await readFile(filePath)
    
    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'image/jpeg'
    if (ext === '.png') contentType = 'image/png'
    else if (ext === '.webp') contentType = 'image/webp'
    else if (ext === '.gif') contentType = 'image/gif'
    else if (ext === '.svg') contentType = 'image/svg+xml'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error(`[Carousel Media API] Image not found or read error: ${filePath}`, error)
    return new NextResponse('Not Found', { status: 404 })
  }
}
