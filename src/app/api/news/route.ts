import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const limit = parseInt(searchParams.get('limit') || '5')

  try {
    const news = await prisma.news.findMany({
      where: {
        published: true,
        ...(category ? { category } : {})
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json(news)
  } catch (error) {
    console.error('Failed to fetch news:', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (user?.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, content, imageUrl, category } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const news = await prisma.news.create({
      data: {
        title,
        content,
        imageUrl,
        category: category || 'news',
        authorId: session.user.id,
        published: true
      }
    })

    return NextResponse.json(news)
  } catch (error) {
    console.error('Failed to create news:', error)
    return NextResponse.json({ error: 'Failed to create news' }, { status: 500 })
  }
}
