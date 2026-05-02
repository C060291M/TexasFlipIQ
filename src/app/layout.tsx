import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TexasFlipIQ — Real Estate Deal Analyzer',
  description: 'Deal analyzer for Texas real estate investors.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
