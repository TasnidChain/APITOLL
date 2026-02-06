import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { ConvexClientProvider } from '@/lib/convex'
import { PWAInstallButton, PWAServiceWorker } from '@/components/pwa'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Apitoll Dashboard',
  description: 'Monitor and manage your x402 agent payments, transactions, and seller ecosystem',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AgentComm',
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
    <html lang="en">
      <body className={inter.className}>
        <ConvexClientProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-muted/30">
              {children}
            </main>
            <PWAInstallButton />
          </div>
        </ConvexClientProvider>
        <PWAServiceWorker />
      </body>
    </html>
  )
}
