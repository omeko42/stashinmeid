export function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-md"
    >
      <defs>
        <linearGradient id="stashinmeGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="mintHighlight" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A7F3D0" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#stashinmeGrad)" />
      {/* Geometric Folded S Ribbon + Upward Growth Arrow */}
      <path
        d="M20 42C20 45.3137 22.6863 48 26 48H36C41.5228 48 46 43.5228 46 38C46 32.4772 41.5228 28 36 28H28C25.7909 28 24 26.2091 24 24C24 21.7909 25.7909 20 28 20H40"
        stroke="url(#mintHighlight)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Growth Arrowhead */}
      <path
        d="M35 14L43 20L35 26"
        stroke="#FFFFFF"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
