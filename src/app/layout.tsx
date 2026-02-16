import "~/styles/globals.css";

import { type Metadata } from "next";
import { Noto_Sans_HK, Noto_Serif_HK } from "next/font/google";

export const metadata: Metadata = {
  title: "香港巴士到站 | HK Bus ETA",
  description: "跨营办巴士实时到站资讯",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const notoSans = Noto_Sans_HK({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const notoSerif = Noto_Serif_HK({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh"
      className={`${notoSans.variable} ${notoSerif.variable}`}
      data-theme="light"
      data-density="balanced"
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
