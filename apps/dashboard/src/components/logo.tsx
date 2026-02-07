/** Shared API Toll "402" logo component used across navbar, footer, sidebar */
export function ApiTollLogo({ size = 32, id = 'logo' }: { size?: number; id?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="API Toll logo"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={`${id}-accent`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="102" fill={`url(#${id}-bg)`} />
      <rect
        x="36"
        y="36"
        width="440"
        height="440"
        rx="78"
        fill="none"
        stroke={`url(#${id}-accent)`}
        strokeWidth="3"
        opacity="0.3"
      />
      <text
        x="50%"
        y="55%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="system-ui,-apple-system,Arial,sans-serif"
        fontSize="220"
        fontWeight="800"
        fill="white"
        letterSpacing="-8"
      >
        402
      </text>
    </svg>
  )
}

/** @deprecated Use ApiTollLogo instead */
export const ApitollLogo = ApiTollLogo
