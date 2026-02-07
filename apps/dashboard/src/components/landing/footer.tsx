import Link from 'next/link'
import { ApitollLogo } from '@/components/logo'

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Seller API (Live)', href: 'https://seller-api-production.up.railway.app/health' },
  ],
  Developers: [
    { label: 'x402 Protocol Spec', href: 'https://www.x402.org/' },
    { label: 'GitHub', href: 'https://github.com/TasnidChain/Apitoll' },
    { label: 'npm: @apitoll/seller-sdk', href: 'https://www.npmjs.com/package/@apitoll/seller-sdk' },
    { label: 'npm: @apitoll/buyer-sdk', href: 'https://www.npmjs.com/package/@apitoll/buyer-sdk' },
  ],
  Company: [
    { label: 'Twitter / X', href: '#' },
    { label: 'Discord', href: '#' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <ApitollLogo size={32} id="footer-logo" />
              <span className="text-lg font-bold text-white">Apitoll</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Payment infrastructure for the autonomous agent economy. Built on
              the x402 HTTP payment protocol. Settled on Base with USDC.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-sm font-semibold text-white">{heading}</h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                      {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Apitoll. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-slate-500 hover:text-slate-300">
              Privacy Policy
            </a>
            <a href="#" className="text-xs text-slate-500 hover:text-slate-300">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
