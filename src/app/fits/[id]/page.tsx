import type { Metadata } from 'next'
import FitClient from './FitClient'
import { PUBLIC_APP_URL } from '@/constants/external-links'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getFit(id: string) {
  const baseUrl = PUBLIC_APP_URL
  try {
    const res = await fetch(`${baseUrl}/api/fits/${id}`, { 
      next: { revalidate: 60 } // Cache for 1 minute
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('[FitPage] Error fetching fit:', err)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const fit = await getFit(id)
  
  if (!fit) {
    return { title: 'Fit Not Found | EasyEve' }
  }
  
  return {
    title: `${fit.name} - ${fit.ship} | EasyEve Fit`,
    description: fit.description || `View ${fit.name} fit for ${fit.ship} on EasyEve`,
    openGraph: {
      title: `${fit.name} - ${fit.ship}`,
      description: fit.description || `EVE Online fit for ${fit.ship}`,
      type: 'website',
      images: [`https://images.evetech.net/types/${fit.shipId}/render?size=512`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${fit.name} - ${fit.ship}`,
      description: fit.description || `EVE Online fit for ${fit.ship}`,
    },
  }
}

export default async function PublicFitPage({ params }: PageProps) {
  const { id } = await params
  const fit = await getFit(id)

  return <FitClient fit={fit} />
}
