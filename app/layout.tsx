import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_HK } from 'next/font/google'

import { DynamicToaster } from '@/components/dynamic-toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { LangSync } from '@/components/eta/lang-sync'
import { env } from '@/lib/env'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  preload: true,
})

const notoSansHK = Noto_Sans_HK({
  variable: '--font-noto-sans-hk',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
})

/* Noto Sans SC removed: Noto Sans HK covers both tc and sc glyphs well
   enough for ETA text, with PingFang/Microsoft YaHei as system fallback.
   Geist Mono removed: ETA numerals use the system mono stack instead. */

const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL)

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#00478d' },
    { media: '(prefers-color-scheme: dark)', color: '#141218' },
  ],
}

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'TimoETA',
    template: '%s | TimoETA',
  },
  description:
    'Fast, clean Hong Kong transit ETAs for buses, MTR trains, and Light Rail. Pin stops, save favorites, and auto-refresh arrivals.',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [{ url: '/icon.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    url: '/',
    title: 'TimoETA',
    description: 'Fast, clean Hong Kong transit ETAs for buses, MTR trains, and Light Rail.',
    siteName: 'TimoETA',
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
    title: 'TimoETA',
    description: 'Fast, clean Hong Kong transit ETAs for buses, MTR trains, and Light Rail.',
    images: ['/timoeta_new.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://data.etabus.gov.hk" />
        <link rel="preconnect" href="https://rt.data.gov.hk" />
        <link rel="preconnect" href="https://data.hkbus.app" />
        <link rel="dns-prefetch" href="https://data.etabus.gov.hk" />
        <link rel="dns-prefetch" href="https://rt.data.gov.hk" />
        <link rel="dns-prefetch" href="https://data.hkbus.app" />
        <link rel="dns-prefetch" href="https://hkbus.github.io" />
        <link rel="dns-prefetch" href="https://opendata.mtr.com.hk" />
        <link rel="dns-prefetch" href="https://www.lrtetas.hk" />
        <link rel="dns-prefetch" href="https://tile.openstreetmap.org" />
        <link rel="dns-prefetch" href="https://router.project-osrm.org" />
      </head>
      <body className={`${inter.variable} ${notoSansHK.variable} min-h-dvh antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LangSync />
          <a
            href="#main-content"
            className="focus:bg-background focus:text-foreground sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
          >
            Skip to content
          </a>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'TimoETA',
                url: siteUrl.toString(),
                description:
                  'Fast, clean Hong Kong transit ETAs for buses, MTR trains, and Light Rail.',
              }),
            }}
          />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <DynamicToaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
