import { MetadataRoute } from 'next'
import { PUBLIC_APP_URL } from '@/constants/external-links'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = PUBLIC_APP_URL

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}