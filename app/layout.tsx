import type React from "react"
import type { Metadata } from "next"
import { Suspense } from "react"
import "./globals.css"

const fontGeist = V0_Font_Geist({
  subsets: ["latin"],
  variable: "--font-geist",
import { Geist as V0_Font_Geist, Geist_Mono as V0_Font_Geist_Mono, Source_Serif_4 as V0_Font_Source_Serif_4 } from 'next/font/google'

// Initialize fonts
V0_Font_Geist({ weight: ["100","200","300","400","500","600","700","800","900"] })
V0_Font_Geist_Mono({ weight: ["100","200","300","400","500","600","700","800","900"] })
V0_Font_Source_Serif_4({ weight: ["200","300","400","500","600","700","800","900"] })

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
  description:
    "Advanced vessel tracking and maritime logistics management system with real-time simulation, weather integration, and AI-powered analytics",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${fontGeist.variable} ${fontGeistMono.variable} ${fontSourceSerif.variable}`}>
      <body className="font-sans antialiased">
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
      </body>
    </html>
  )
}
