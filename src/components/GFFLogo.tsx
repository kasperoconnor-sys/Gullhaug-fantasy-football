export default function GFFLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gffShieldGrad" x1="0" y1="0" x2="44" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path
        d="M22 1L41 8V23C41 35.7 33.4 44.9 22 49C10.6 44.9 3 35.7 3 23V8L22 1Z"
        fill="url(#gffShieldGrad)"
        stroke="#12131C"
        strokeWidth="1.5"
      />
      <path
        d="M22 6L36 11V23C36 32.6 30.4 39.9 22 43.6C13.6 39.9 8 32.6 8 23V11L22 6Z"
        fill="#06070C"
        fillOpacity="0.35"
      />
      {/* Simple ball glyph */}
      <circle cx="22" cy="23" r="8.5" fill="#F5B93D" />
      <path d="M22 16.5L26 19.3L24.5 24.2H19.5L18 19.3L22 16.5Z" fill="#12131C" />
      <path d="M22 16.5V13.5M26 19.3L29 17.3M24.5 24.2L26 27.5M19.5 24.2L18 27.5M18 19.3L15 17.3" stroke="#12131C" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
