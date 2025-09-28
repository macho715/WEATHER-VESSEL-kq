import type { Metadata } from "next"
import "./globals.css"

import type React from "react"

// ✅ 모듈 최상단에서 const로 폰트 할당
const fontGeist = V0_Font_Geist({
  subsets: ["latin"],
import { Geist as V0_Font_Geist, Geist_Mono as V0_Font_Geist_Mono, Source_Serif_4 as V0_Font_Source_Serif_4 } from 'next/font/google'

// Initialize fonts
V0_Font_Geist({ weight: ["100","200","300","400","500","600","700","800","900"] })
V0_Font_Geist_Mono({ weight: ["100","200","300","400","500","600","700","800","900"] })
V0_Font_Source_Serif_4({ weight: ["200","300","400","500","600","700","800","900"] })

  variable: "--font-geist",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
})

const fontGeistMono = V0_Font_Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
})

const fontSourceSerif = V0_Font_Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif-4",
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
})

export const metadata: Metadata = {
  title: "Logistics Control Tower v2.5",
  description: "Weather-aware vessel schedule dashboard",
    generator: 'v0.app'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontGeist.variable} ${fontGeistMono.variable} ${fontSourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  )
}
