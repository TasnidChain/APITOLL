import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
      {/* Glow */}
      <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10">
        <p className="font-mono text-7xl font-bold text-blue-400 sm:text-9xl">404</p>
        <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-700 bg-slate-900/50 px-6 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
