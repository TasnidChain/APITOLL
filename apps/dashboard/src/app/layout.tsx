import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PWAServiceWorker } from '@/components/pwa'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Apitoll - Payment Infrastructure for AI Agents',
  description: 'Enable AI agents to autonomously pay for API calls with USDC micropayments. Built on the x402 protocol.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Apitoll',
  },
  icons: {
    icon: '/icons/icon-96x96.svg',
    apple: '/icons/icon-192x192.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        {children}
        <PWAServiceWorker />
      </body>
    </html>
  )
}
