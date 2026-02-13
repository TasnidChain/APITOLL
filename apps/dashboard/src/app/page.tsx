import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { LiveTicker } from '@/components/landing/live-ticker'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Features } from '@/components/landing/features'
import { DualAudience } from '@/components/landing/dual-audience'
import { RevenueCalculator } from '@/components/landing/revenue-calculator'
import { Comparison } from '@/components/landing/comparison'
import { CodeShowcase } from '@/components/landing/code-showcase'
import { SwarmPitch } from '@/components/landing/swarm-pitch'
import { Integrations } from '@/components/landing/integrations'
import { SocialProof } from '@/components/landing/social-proof'
import { PricingSection } from '@/components/landing/pricing-section'
import { Footer } from '@/components/landing/footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <Hero />
      <LiveTicker />
      <HowItWorks />
      <DualAudience />
      <RevenueCalculator />
      <Features />
      <Comparison />
      <CodeShowcase />
      <SwarmPitch />
      <Integrations />
      <SocialProof />
      <PricingSection />
      <Footer />
    </div>
  )
}
