'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { useClerkReady } from '@/components/clerk-provider'
import { ApiTollLogo } from '@/components/logo'

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const clerkReady = useClerkReady()

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <ApiTollLogo size={32} />
          <span className="text-lg font-bold text-white">API Toll</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden items-center gap-4 md:flex">
          {clerkReady ? (
            <>
              <SignedOut>
                <SignInButton>
                  <button className="text-sm font-medium text-slate-400 transition-colors hover:text-white cursor-pointer">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-200 cursor-pointer">
                    Get Started
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-200"
                >
                  Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </>
          ) : (
            <Link
              href="/dashboard"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-200"
            >
              Get Started
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-slate-400 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-800 bg-slate-950 px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
            {clerkReady ? (
              <>
                <SignedOut>
                  <SignInButton>
                    <button className="mt-2 rounded-lg border border-slate-700 px-4 py-2 text-center text-sm font-semibold text-white cursor-pointer">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton>
                    <button className="rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-slate-950 cursor-pointer">
                      Get Started
                    </button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <Link
                    href="/dashboard"
                    className="mt-2 rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-slate-950"
                  >
                    Dashboard
                  </Link>
                </SignedIn>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="mt-2 rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-slate-950"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
