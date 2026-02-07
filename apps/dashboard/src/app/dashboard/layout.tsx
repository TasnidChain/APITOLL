import { Sidebar } from '@/components/sidebar'
import { ConvexClientProvider } from '@/lib/convex'
import { PWAInstallButton } from '@/components/pwa'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexClientProvider>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-muted/30">
          {children}
        </main>
        <PWAInstallButton />
      </div>
    </ConvexClientProvider>
  )
}
