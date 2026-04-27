import { NextResponse } from 'next/server'
import { getMarketAppraisal } from '@/lib/market'
import { parseEVECargo } from '@/lib/parsers/eve-cargo-parser'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const parsedMap = parseEVECargo(text)
    const items: { name: string, quantity: number }[] = Array.from(parsedMap.entries()).map(([name, quantity]) => ({
      name,
      quantity
    }))

    if (items.length === 0) {
      return NextResponse.json({ items: [], total: 0 })
    }

    const uniqueNames = Array.from(new Set(items.map(i => i.name)))
    const prices = await getMarketAppraisal(uniqueNames)

    let total = 0
    const detailedItems = items.map(item => {
      const unitPrice = prices[item.name.toLowerCase()] || 0
      const totalPrice = unitPrice * item.quantity
      total += totalPrice
      return {
        ...item,
        unitPrice,
        totalPrice
      }
    })
    
    // Sort by total value descending
    detailedItems.sort((a, b) => b.totalPrice - a.totalPrice)

    return NextResponse.json({ items: detailedItems, total })
  } catch (error) {
    console.error('Error parsing market data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
