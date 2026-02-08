import { Navbar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - API Toll',
  description: 'Privacy Policy for API Toll — how we handle data for humans and AI agents.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Effective: February 7, 2026</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Introduction</h2>
            <p className="mt-3">
              This Privacy Policy explains how Rizq Labs AI LLC (&quot;API Toll&quot;, &quot;we&quot;, &quot;us&quot;)
              collects, uses, and protects information when you use our website (apitoll.com), SDKs, APIs,
              facilitator service, and dashboard (collectively, the &quot;Service&quot;).
            </p>
            <p className="mt-2">
              API Toll serves both human users and autonomous AI agents. This policy covers data handling
              for both categories of users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Information We Collect</h2>

            <h3 className="mt-4 font-medium text-slate-200">2.1 Account Information</h3>
            <p className="mt-2">
              When you create an account via Clerk authentication, we receive:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Email address</li>
              <li>Display name</li>
              <li>Authentication provider identifiers (Google, GitHub, etc.)</li>
            </ul>

            <h3 className="mt-4 font-medium text-slate-200">2.2 Wallet Information</h3>
            <p className="mt-2">
              When you register as a seller or deploy agents, we store:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Public wallet addresses (Base/Solana) — these are public blockchain data</li>
              <li>We <strong>never</strong> store private keys, seed phrases, or signing credentials</li>
            </ul>

            <h3 className="mt-4 font-medium text-slate-200">2.3 Transaction Data</h3>
            <p className="mt-2">
              For each x402 payment processed through the Service, we record:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Transaction hash (public blockchain data)</li>
              <li>Sender and recipient wallet addresses</li>
              <li>Payment amount and currency (USDC)</li>
              <li>Endpoint called, HTTP method, and response status</li>
              <li>Timestamp and latency metrics</li>
              <li>Platform fee amounts</li>
            </ul>
            <p className="mt-2">
              All transaction data is inherently public on the blockchain. We index it for analytics
              and display it on your dashboard.
            </p>

            <h3 className="mt-4 font-medium text-slate-200">2.4 Agent Metadata</h3>
            <p className="mt-2">
              For AI agents using the Service, we collect:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Agent name and configuration (set by the operator)</li>
              <li>Policy configurations (budget limits, vendor ACLs, rate limits)</li>
              <li>Spending history and balance information</li>
              <li>We do <strong>not</strong> collect or store agent prompts, instructions, or internal reasoning</li>
            </ul>

            <h3 className="mt-4 font-medium text-slate-200">2.5 Usage Data</h3>
            <p className="mt-2">
              We automatically collect:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>IP addresses (for rate limiting and security only, not stored long-term)</li>
              <li>Browser/user-agent information</li>
              <li>Pages visited and features used in the dashboard</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. How We Use Information</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li><strong>Service delivery</strong> — process payments, display analytics, enforce policies</li>
              <li><strong>Security</strong> — detect fraud, prevent abuse, verify payment signatures</li>
              <li><strong>Improvement</strong> — understand usage patterns to improve the Service</li>
              <li><strong>Communication</strong> — send account-related notifications (not marketing)</li>
              <li><strong>Legal compliance</strong> — respond to lawful requests from authorities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Information Sharing</h2>
            <p className="mt-3">We do not sell your personal information. We share data only in these cases:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Transaction counterparties</strong> — sellers see buyer wallet addresses and vice versa (this is inherent to blockchain transactions)</li>
              <li><strong>Service providers</strong> — Clerk (authentication), Convex (database), Stripe (fiat deposits), Vercel (hosting)</li>
              <li><strong>Legal requirements</strong> — when required by law, subpoena, or to protect rights and safety</li>
              <li><strong>Business transfers</strong> — in connection with a merger, acquisition, or asset sale</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Blockchain Data</h2>
            <p className="mt-3">
              By using the Service, you acknowledge that blockchain transactions are:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Public</strong> — all on-chain transactions are visible to anyone on the Base blockchain</li>
              <li><strong>Permanent</strong> — blockchain data cannot be deleted or modified</li>
              <li><strong>Pseudonymous</strong> — wallet addresses are not inherently linked to real-world identity, but may be correlated through other means</li>
            </ul>
            <p className="mt-2">
              We cannot delete on-chain transaction data, as it exists on a decentralized public ledger
              outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Data Security</h2>
            <p className="mt-3">
              We implement reasonable security measures including:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Clerk-managed authentication with industry-standard encryption</li>
              <li>Timing-safe API key comparisons to prevent timing attacks</li>
              <li>Webhook signature verification (HMAC-SHA256) for all payment events</li>
              <li>Role-based access controls on all dashboard mutations</li>
              <li>No plaintext storage of secrets or private keys</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. Data Retention</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li><strong>Account data</strong> — retained while your account is active, deleted upon request</li>
              <li><strong>Transaction data</strong> — retained indefinitely for analytics and compliance (on-chain data is permanent regardless)</li>
              <li><strong>Usage logs</strong> — retained for 90 days</li>
              <li><strong>IP addresses</strong> — retained for 30 days (security purposes)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">8. Your Rights</h2>
            <p className="mt-3">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated off-chain data</li>
              <li>Export your data in a portable format</li>
              <li>Object to certain processing activities</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us at{' '}
              <a href="mailto:privacy@apitoll.com" className="text-blue-400 hover:text-blue-300">
                privacy@apitoll.com
              </a>.
              Note that we cannot delete on-chain blockchain data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">9. Cookies</h2>
            <p className="mt-3">
              We use minimal cookies necessary for authentication (Clerk session cookies) and
              basic analytics. We do not use advertising cookies or third-party tracking.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">10. Children</h2>
            <p className="mt-3">
              The Service is not directed at individuals under 18. We do not knowingly collect
              personal information from minors.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">11. International Users</h2>
            <p className="mt-3">
              The Service is operated from the United States. If you access the Service from
              outside the US, your data will be transferred to and processed in the US. By using
              the Service, you consent to this transfer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">12. Changes</h2>
            <p className="mt-3">
              We may update this Privacy Policy periodically. Material changes will be posted
              on this page with an updated effective date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">13. Contact</h2>
            <p className="mt-3">
              For privacy-related questions, contact us at{' '}
              <a href="mailto:privacy@apitoll.com" className="text-blue-400 hover:text-blue-300">
                privacy@apitoll.com
              </a>.
            </p>
            <p className="mt-2 text-slate-500">
              Rizq Labs AI LLC<br />
              Florida, United States
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
