'use client'

import { useEffect, useState } from 'react'

// PWA Install Button Component
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstallable(false)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log('[PWA] Install outcome:', outcome)
    setDeferredPrompt(null)
    setIsInstallable(false)
  }

  if (isInstalled || !isInstallable) return null

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0"
      title="Install Apitoll as a desktop app"
    >
      <span>📲</span>
      <span>Install App</span>
    </button>
  )
}

// Service Worker Registration Component
export function PWAServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope)

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  console.log('[PWA] New service worker activated - reload for updates')
                }
              })
            }
          })
        })
        .catch((err) => {
          console.log('[PWA] SW registration failed:', err)
        })
    }
  }, [])

  return null
}
