/**
 * Logo SmartHR — bouclier avec silhouette, engrenage et lettre S stylisée
 * Reproduit le style du logo officiel SmartHR Staff Management App
 */
export default function Logo({ size = 48, showText = false, textSize = 'text-xl' }) {
  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="shieldGrad" x1="0" y1="0" x2="100" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1a3a5c" />
            <stop offset="60%" stopColor="#1e4d7b" />
            <stop offset="100%" stopColor="#0f2d4a" />
          </linearGradient>
          <linearGradient id="accentGrad" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#b8a060" />
            <stop offset="100%" stopColor="#e8c97a" />
          </linearGradient>
          <linearGradient id="sGrad" x1="0" y1="0" x2="60" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4a9aba" />
            <stop offset="100%" stopColor="#1e6a8a" />
          </linearGradient>
        </defs>

        {/* Shield shape */}
        <path
          d="M50 4 L90 18 L90 55 C90 78 72 96 50 106 C28 96 10 78 10 55 L10 18 Z"
          fill="url(#shieldGrad)"
          stroke="#2a5a8c"
          strokeWidth="1.5"
        />

        {/* Gear top-right */}
        <g transform="translate(62, 12) scale(0.55)" opacity="0.85">
          <circle cx="18" cy="18" r="8" fill="none" stroke="#4a9aba" strokeWidth="3" />
          {[0,45,90,135,180,225,270,315].map((angle, i) => (
            <rect
              key={i}
              x="15.5" y="2"
              width="5" height="7"
              rx="1"
              fill="#4a9aba"
              transform={`rotate(${angle} 18 18)`}
            />
          ))}
        </g>

        {/* Human silhouette (head + shoulder) */}
        <g opacity="0.5">
          <circle cx="36" cy="32" r="8" fill="#4a9aba" />
          <path d="M20 58 Q20 44 36 44 Q52 44 52 58" fill="#4a9aba" />
        </g>

        {/* Big stylized S */}
        <text
          x="50" y="78"
          textAnchor="middle"
          fontSize="52"
          fontWeight="900"
          fontFamily="Georgia, serif"
          fill="url(#sGrad)"
          opacity="0.95"
          letterSpacing="-2"
        >S</text>

        {/* Gold accent swoosh */}
        <path
          d="M30 72 Q50 55 72 68"
          stroke="url(#accentGrad)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <div>
          <p className={`font-black leading-tight ${textSize}`} style={{ color: 'inherit' }}>
            <span style={{ color: 'var(--logo-text-color, #1a3a5c)' }}>Smart</span>
            <span style={{ color: 'var(--logo-accent-color, #1e6a8a)' }}>HR</span>
          </p>
          <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--logo-sub-color, #9ca3af)' }}>Staff Management App</p>
        </div>
      )}
    </div>
  );
}
