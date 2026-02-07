import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Features } from '@/components/landing/features'
import { Comparison } from '@/components/landing/comparison'
import { CodeShowcase } from '@/components/landing/code-showcase'
import { Integrations } from '@/components/landing/integrations'
import { PricingSection } from '@/components/landing/pricing-section'
import { Footer } from '@/components/landing/footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <Comparison />
      <CodeShowcase />
      <Integrations />
      <PricingSection />
      <Footer />
    </div>
  )
}
