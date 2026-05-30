import type { Metadata } from 'next'
import { DM_Sans, Noto_Sans_HK, Noto_Sans_SC, Rubik } from 'next/font/google'

import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/toaster'
import { LangSync } from '@/components/eta/lang-sync'
import { env } from '@/lib/env'
import './globals.css'

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const rubik = Rubik({
  variable: '--font-rubik',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const notoSansHK = Noto_Sans_HK({
  variable: '--font-noto-sans-hk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const notoSansSC = Noto_Sans_SC({
  variable: '--font-noto-sans-sc',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

// Geist Mono is loaded via @fontsource in globals.css

const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL)

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
    icon: [{ url: '/timoeta_new.png' }, { url: '/timoeta_new.png', type: 'image/png' }],
    apple: [{ url: '/timoeta_new.png' }],
    shortcut: ['/timoeta_new.png'],
  },
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
        <link rel="preconnect" href="https://data.etabus.gov.hk" />
        <link rel="preconnect" href="https://opendata.mtr.com.hk" />
        <link rel="preconnect" href="https://www.lrtetas.hk" />
        <link rel="dns-prefetch" href="https://data.etabus.gov.hk" />
        <link rel="dns-prefetch" href="https://opendata.mtr.com.hk" />
        <link rel="dns-prefetch" href="https://www.lrtetas.hk" />
      </head>
      <body
        className={`${dmSans.variable} ${rubik.variable} ${notoSansHK.variable} ${notoSansSC.variable} min-h-dvh antialiased`}
      >
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
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
