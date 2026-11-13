import type { Metadata } from 'next'

import { SchoolClient } from './school-client'

export const metadata: Metadata = {
  title: 'School bus stop ETAs',
  description:
    'Minimal ETA board for school bus stops near Choi Wan Estate, Pak Hung House, Kai Yip Estate and Choi Hing Court, grouped by stop or by destination.',
  alternates: {
    canonical: '/school',
  },
  robots: {
    index: true,
    follow: false,
  },
}

export default function SchoolPage() {
  return <SchoolClient />
}
