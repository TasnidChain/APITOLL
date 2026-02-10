import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ClerkClientProvider } from '@/components/clerk-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'API Toll - Payment Infrastructure for AI Agents',
  description: 'Enable AI agents to autonomously pay for API calls with USDC micropayments. Built on the x402 protocol.',
  icons: {
    icon: [
      { url: '/icons/icon-96x96.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/icons/icon-96x96.svg',
    apple: '/icons/icon-192x192.svg',
  },
  openGraph: {
    title: 'API Toll - Payment Infrastructure for AI Agents',
    description: 'Enable AI agents to autonomously pay for API calls with USDC micropayments on Base. 3-line SDK integration.',
    url: 'https://apitoll.com',
    siteName: 'API Toll',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@apitoll',
    title: 'API Toll - Payment Infrastructure for AI Agents',
    description: 'Enable AI agents to autonomously pay for API calls with USDC micropayments on Base. 3-line SDK integration.',
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
        <ClerkClientProvider>
          {children}
        </ClerkClientProvider>
      </body>
    </html>
  )
}
