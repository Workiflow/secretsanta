import type { Metadata } from "next"
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google"
import "./globals.css"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["400", "600", "800"] })
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], variable: "--font-atkinson", weight: ["400", "700"] })

export const metadata: Metadata = {
  title: { default: "Out of the Hat", template: "%s · Out of the Hat" },
  description: "Secret Santa for families. Start a party, share one link, draw names, and everyone finds out who they're buying for.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${atkinson.variable}`}>
      <body className="min-h-dvh font-sans text-[16px] leading-relaxed antialiased">{children}</body>
    </html>
  )
}
