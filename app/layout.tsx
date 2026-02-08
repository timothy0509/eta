import type { Metadata } from "next";
import { DM_Sans, Noto_Sans_HK, Noto_Sans_SC, Rubik } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/toaster";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSansHK = Noto_Sans_HK({
  variable: "--font-noto-sans-hk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Geist Mono is loaded via @fontsource in globals.css

const siteUrl = new URL("https://eta.hkjc.uk");

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "TimoETA",
    template: "%s | TimoETA",
  },
  description:
    "Fast, clean Hong Kong transit ETAs for buses, MTR trains, and Light Rail. Pin stops, save favorites, and auto-refresh arrivals.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/timoeta_new.png" },
      { url: "/timoeta_new.png", type: "image/png" },
    ],
    apple: [{ url: "/timoeta_new.png" }],
    shortcut: ["/timoeta_new.png"],
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "TimoETA",
    description:
      "Fast, clean Hong Kong transit ETAs for buses, MTR trains, and Light Rail.",
    siteName: "TimoETA",
    images: [
      {
        url: "/timoeta_new.png",
        width: 512,
        height: 512,
        alt: "TimoETA",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "TimoETA",
    description:
      "Fast, clean Hong Kong transit ETAs for buses, MTR trains, and Light Rail.",
    images: ["/timoeta_new.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${rubik.variable} ${notoSansHK.variable} ${notoSansSC.variable} min-h-dvh antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "TimoETA",
                url: siteUrl.toString(),
                description:
                  "Fast, clean Hong Kong transit ETAs for buses, MTR trains, and Light Rail.",
              }),
            }}
          />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
