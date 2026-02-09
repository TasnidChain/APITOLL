'use client'

import { Badge, Section } from './shared'
import {
  DollarSign,
  Globe,
  Zap,
  Shield,
  Package,
  Server,
} from 'lucide-react'

export function PlatformTab() {
  return (
    <div className="space-y-6">
      <Section title="Platform Configuration">
        <div className="space-y-4">
          {[
            { label: 'Platform Fee', value: '250 bps (2.5%)', icon: DollarSign },
            { label: 'Default Chain', value: 'Base (Mainnet)', icon: Globe },
            { label: 'Supported Chains', value: 'Base, Solana', icon: Zap },
            { label: 'Payment Currency', value: 'USDC', icon: DollarSign },
            { label: 'Protocol', value: 'x402 HTTP Payment Protocol', icon: Shield },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{item.label}</span>
              </div>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="NPM Packages">
        <div className="space-y-3">
          {[
            { name: '@apitoll/shared', version: '0.1.0-beta.3', description: 'Shared types & utilities' },
            { name: '@apitoll/seller-sdk', version: '0.1.0-beta.3', description: 'Express/Hono middleware for sellers' },
            { name: '@apitoll/buyer-sdk', version: '0.1.0-beta.3', description: 'Agent wallet & payment SDK' },
          ].map((pkg) => (
            <div
              key={pkg.name}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-mono text-sm font-medium">{pkg.name}</p>
                  <p className="text-xs text-muted-foreground">{pkg.description}</p>
                </div>
              </div>
              <Badge variant="info">v{pkg.version}</Badge>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Infrastructure">
        <div className="space-y-3">
          {[
            { label: 'Dashboard', url: 'https://apitoll.com', status: 'Live' },
            { label: 'Convex Backend', url: 'https://cheery-parrot-104.convex.cloud', status: 'Live' },
            { label: 'Facilitator', url: 'https://facilitator-production-fbd7.up.railway.app', status: 'Live' },
            { label: 'Discovery API', url: 'https://apitoll.com/api/discovery', status: 'Live' },
          ].map((svc) => (
            <div
              key={svc.label}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Server className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{svc.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{svc.url}</p>
                </div>
              </div>
              <Badge variant="success">{svc.status}</Badge>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
