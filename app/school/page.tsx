import type { Metadata } from 'next'

import SchoolClient from './school-client'

export const metadata: Metadata = {
  title: 'School ETAs',
  description: 'Live bus arrival times for the stops near school.',
  alternates: {
    canonical: '/school',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    url: '/school',
    title: 'School ETAs',
    description: 'Live bus arrival times for the stops near school.',
    images: [
      {
        url: '/timoeta_new.png',
        width: 512,
        height: 512,
        alt: 'TimoETA',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'School ETAs',
    description: 'Live bus arrival times for the stops near school.',
    images: ['/timoeta_new.png'],
  },
}

export default function SchoolPage() {
  return <SchoolClient />
}
