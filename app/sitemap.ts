import type { MetadataRoute } from 'next'

const lastModified = new Date(process.env.NEXT_PUBLIC_BUILD_TIME ?? Date.now())

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://eta.hkjc.uk',
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
