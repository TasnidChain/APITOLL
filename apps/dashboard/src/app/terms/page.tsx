import { Navbar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - API Toll',
  description: 'Terms of Service for API Toll — payment infrastructure for AI agents.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Effective: February 7, 2026</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Agreement</h2>
            <p className="mt-3">
              These Terms of Service (&quot;Terms&quot;) govern your use of API Toll, operated by Rizq Labs AI LLC
              (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;). By accessing apitoll.com or using our SDKs, APIs,
              facilitator services, or dashboard (collectively, the &quot;Service&quot;), you agree to these Terms.
              If you do not agree, do not use the Service.
            </p>
            <p className="mt-2">
              &quot;You&quot; refers to any person, entity, or autonomous software agent accessing or using the Service.
              These Terms apply equally to human users and AI agents acting on behalf of their operators.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Description of Service</h2>
            <p className="mt-3">
              API Toll provides payment infrastructure for AI agents to pay for API calls using USDC stablecoins
              on the Base blockchain, built on the x402 HTTP Payment Protocol. The Service includes:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Seller SDK</strong> — middleware for API providers to monetize endpoints with per-request micropayments</li>
              <li><strong>Buyer SDK</strong> — agent wallet with automatic 402 payment handling and policy enforcement</li>
              <li><strong>Facilitator</strong> — custodial payment relay for executing on-chain USDC transfers</li>
              <li><strong>Dashboard</strong> — analytics, agent management, and revenue tracking</li>
              <li><strong>Discovery</strong> — tool registry for agents to find and evaluate paid API endpoints</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Platform Fees</h2>
            <p className="mt-3">
              API Toll charges a <strong>3% platform fee</strong> (300 basis points) on each transaction processed
              through the Service. This fee is deducted automatically from each payment:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>If an agent pays $1.00 USDC, the seller receives $0.97 and API Toll retains $0.03</li>
              <li>Fee breakdowns are included transparently in all 402 responses and payment receipts</li>
              <li>Enterprise customers may negotiate custom fee structures</li>
            </ul>
            <p className="mt-2">
              We reserve the right to modify fee rates with 30 days written notice. Fee changes do not apply
              retroactively to transactions already processed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Payments and Settlement</h2>
            <p className="mt-3">
              All payments are settled on-chain using USDC on the Base blockchain (Coinbase L2) or Solana. By using the Service:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Finality</strong> — transactions settle in approximately 2 seconds and are irreversible once confirmed on-chain</li>
              <li><strong>No chargebacks</strong> — blockchain payments cannot be reversed. There are no chargebacks, refunds are at the seller&apos;s discretion</li>
              <li><strong>Stablecoin only</strong> — the Service exclusively uses USDC, a regulated stablecoin pegged to the US dollar</li>
              <li><strong>Wallet responsibility</strong> — you are solely responsible for the security of your wallet private keys and funds</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Agent Referral Program</h2>
            <p className="mt-3">
              API Toll includes an optional referral system where sellers and agents can earn commissions
              for directing traffic to paid endpoints on the network:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Referral commissions are 0.5% of referred transaction volume for 6 months from first referral</li>
              <li>Referral tracking is on-chain and verifiable</li>
              <li>We reserve the right to modify or terminate the referral program at any time</li>
              <li>Fraudulent or self-referral activity will result in commission forfeiture and possible account termination</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Seller Obligations</h2>
            <p className="mt-3">
              If you use the Service as a seller (API provider), you agree to:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Provide accurate descriptions and pricing for your endpoints</li>
              <li>Deliver the advertised service upon receiving verified payment</li>
              <li>Not engage in price manipulation, bait-and-switch, or deceptive practices</li>
              <li>Comply with all applicable laws regarding the services you offer through your APIs</li>
              <li>Not use the platform to facilitate illegal transactions or money laundering</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. Agent Operator Obligations</h2>
            <p className="mt-3">
              If you deploy AI agents that use the Service, you agree to:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Be responsible for all transactions initiated by your agents</li>
              <li>Configure appropriate budget policies and spending limits</li>
              <li>Monitor agent activity and intervene if agents behave unexpectedly</li>
              <li>Not deploy agents designed to exploit, attack, or defraud sellers or the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">8. Prohibited Uses</h2>
            <p className="mt-3">You may not use the Service to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Violate any applicable law, regulation, or third-party rights</li>
              <li>Launder money, finance terrorism, or evade sanctions</li>
              <li>Distribute malware, conduct DDoS attacks, or exploit vulnerabilities</li>
              <li>Engage in market manipulation or artificial inflation of transaction volumes</li>
              <li>Circumvent rate limits, security measures, or access controls</li>
              <li>Impersonate other users, sellers, or agents</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">9. Intellectual Property</h2>
            <p className="mt-3">
              The API Toll SDKs (<code className="text-blue-400">@apitoll/seller-sdk</code>,{' '}
              <code className="text-blue-400">@apitoll/buyer-sdk</code>,{' '}
              <code className="text-blue-400">@apitoll/mcp-server</code>,{' '}
              <code className="text-blue-400">@apitoll/shared</code>) are open-source under the MIT License.
              The API Toll dashboard, facilitator service, branding, and proprietary algorithms remain
              the property of Rizq Labs AI LLC.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">10. Disclaimers</h2>
            <p className="mt-3">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE
              UNINTERRUPTED SERVICE, TRANSACTION SETTLEMENT TIMES, OR COMPATIBILITY WITH ALL BLOCKCHAIN
              CONDITIONS. USE OF CRYPTOCURRENCY AND STABLECOINS INVOLVES INHERENT RISKS INCLUDING BUT NOT
              LIMITED TO SMART CONTRACT BUGS, NETWORK CONGESTION, AND REGULATORY CHANGES.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">11. Limitation of Liability</h2>
            <p className="mt-3">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, RIZQ LABS AI LLC SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA,
              OR FUNDS ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT
              OF PLATFORM FEES PAID BY YOU IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">12. Governing Law</h2>
            <p className="mt-3">
              These Terms are governed by the laws of the State of Florida, United States. Any disputes
              shall be resolved in the courts of the State of Florida. You waive any objection to venue
              in such courts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">13. Changes to Terms</h2>
            <p className="mt-3">
              We may update these Terms from time to time. Material changes will be posted on this page
              with an updated effective date. Continued use of the Service after changes constitutes
              acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">14. Contact</h2>
            <p className="mt-3">
              For questions about these Terms, contact us at{' '}
              <a href="mailto:legal@apitoll.com" className="text-blue-400 hover:text-blue-300">
                legal@apitoll.com
              </a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
