import type { Metadata } from 'next'
import { Suspense } from 'react'
import MarketClient from './MarketClient'

export const metadata: Metadata = {
  title: 'Market Browser - EVE Online Price Checker | EasyEve',
  description: 'Browse EVE Online market prices, check sell and buy orders across all regions. Find the best deals on ships, modules, minerals and more.',
  keywords: [
    'EVE Online market',
    'EVE Online prices',
    'EVE Online market browser',
    'EVE Online item prices',
    'EVE Online sell orders',
    'EVE Online buy orders',
    'EVE Online trade',
    'Jita prices',
    'Amarr prices'
  ],
  openGraph: {
    title: 'Market Browser - EVE Online Price Checker',
    description: 'Real-time EVE Online market data. Check orders in Jita, Amarr, Dodixie and more.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Browser - EVE Online Price Checker',
    description: 'Real-time EVE Online market data. Check orders in Jita, Amarr, Dodixie and more.',
  },
}

// MarketClient reads useSearchParams (deep link from the Industry scanner), which
// Next requires under a Suspense boundary at build time.
export default function MarketPage() {
  return (
    <Suspense fallback={null}>
      <MarketClient />
    </Suspense>
  )
}