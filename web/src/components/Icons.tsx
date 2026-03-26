import { COLORS } from "../theme";

interface IconProps {
  size?: number;
  color?: string;
}

export function CityPulseLogo({ size = 56 }: { size?: number; bg?: string; fg?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size}>
      <rect width="32" height="32" rx="7" fill="#0D3B6E"/>
      <rect x="6" y="7" width="20" height="4" rx="1.5" fill="white"/>
      <rect x="14" y="11" width="4" height="14" rx="1.5" fill="white"/>
      <polyline points="6,22 10,22 12,16 16,28 20,18 22,22 26,22"
        fill="none" stroke="#F5A623" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function CoitTowerIcon({ size = 48, color = COLORS.orange }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 8 L32 12" />
      <ellipse cx="32" cy="14" rx="3" ry="1.5" />
      <path d="M26 16 L26 50 Q26 52 28 52 L36 52 Q38 52 38 50 L38 16" />
      <path d="M26 16 Q32 13 38 16" />
      <line x1="29" y1="18" x2="29" y2="48" strokeWidth="0.8" opacity="0.5" />
      <line x1="32" y1="17" x2="32" y2="48" strokeWidth="0.8" opacity="0.5" />
      <line x1="35" y1="18" x2="35" y2="48" strokeWidth="0.8" opacity="0.5" />
      <rect x="29" y="20" width="6" height="3" rx="0.5" strokeWidth="1" />
      <path d="M22 52 L42 52" />
      <path d="M24 52 L24 56 L40 56 L40 52" />
      <path d="M12 56 Q22 48 32 56 Q42 48 52 56" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export function TransamericaIcon({ size = 48, color = COLORS.orange }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 6 L22 52 L42 52 Z" />
      <path d="M26 34 L20 34 L22 52" strokeWidth="1.2" />
      <path d="M38 34 L44 34 L42 52" strokeWidth="1.2" />
      <line x1="27" y1="24" x2="37" y2="24" strokeWidth="0.7" opacity="0.4" />
      <line x1="26" y1="30" x2="38" y2="30" strokeWidth="0.7" opacity="0.4" />
      <line x1="25" y1="36" x2="39" y2="36" strokeWidth="0.7" opacity="0.4" />
      <line x1="24" y1="42" x2="40" y2="42" strokeWidth="0.7" opacity="0.4" />
      <line x1="23" y1="48" x2="41" y2="48" strokeWidth="0.7" opacity="0.4" />
      <path d="M18 52 L46 52" />
      <rect x="12" y="44" width="6" height="8" rx="0.5" strokeWidth="1" opacity="0.35" />
      <rect x="46" y="42" width="5" height="10" rx="0.5" strokeWidth="1" opacity="0.35" />
    </svg>
  );
}

export function ChinatownGateIcon({ size = 48, color = COLORS.orange }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16" y1="22" x2="16" y2="56" />
      <line x1="48" y1="22" x2="48" y2="56" />
      <line x1="24" y1="28" x2="24" y2="56" />
      <line x1="40" y1="28" x2="40" y2="56" />
      <path d="M10 22 Q18 16 32 12 Q46 16 54 22" />
      <path d="M12 22 L52 22" />
      <path d="M10 22 Q8 20 6 21" strokeWidth="1.2" />
      <path d="M54 22 Q56 20 58 21" strokeWidth="1.2" />
      <path d="M18 28 Q25 24 32 23 Q39 24 46 28" />
      <path d="M18 28 L46 28" strokeWidth="1.2" />
      <path d="M18 28 Q16 26 14 27" strokeWidth="1" />
      <path d="M46 28 Q48 26 50 27" strokeWidth="1" />
      <circle cx="32" cy="18" r="2" strokeWidth="1" />
      <line x1="16" y1="40" x2="24" y2="40" strokeWidth="1" opacity="0.5" />
      <line x1="40" y1="40" x2="48" y2="40" strokeWidth="1" opacity="0.5" />
      <path d="M8 56 L56 56" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export function CableCarIcon({ size = 48, color = COLORS.orange }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16 Q32 10 60 16" strokeWidth="1" opacity="0.3" />
      <rect x="12" y="28" width="40" height="20" rx="3" />
      <path d="M14 28 L14 24 Q32 20 50 24 L50 28" />
      <line x1="32" y1="22" x2="32" y2="14" strokeWidth="1.5" />
      <rect x="16" y="32" width="6" height="8" rx="1" strokeWidth="1" />
      <rect x="25" y="32" width="6" height="8" rx="1" strokeWidth="1" />
      <rect x="34" y="32" width="6" height="8" rx="1" strokeWidth="1" />
      <rect x="43" y="32" width="6" height="8" rx="1" strokeWidth="1" />
      <path d="M10 48 L54 48" />
      <line x1="12" y1="48" x2="12" y2="52" strokeWidth="1.5" />
      <line x1="52" y1="48" x2="52" y2="52" strokeWidth="1.5" />
      <circle cx="20" cy="52" r="3" strokeWidth="1.5" />
      <circle cx="44" cy="52" r="3" strokeWidth="1.5" />
      <path d="M0 58 Q16 50 32 54 Q48 58 64 52" strokeWidth="1" opacity="0.25" />
    </svg>
  );
}

export function DistrictIcon({ size = 48, color = COLORS.orange }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 48 L4 36 L8 36 L8 32 L12 32 L12 28 L16 28 L16 24 L20 20 L20 48" />
      <path d="M20 48 L20 30 L24 30 L24 26 L28 26 L28 48" />
      <path d="M28 48 L28 18 L32 10 L36 18 L36 48" />
      <path d="M36 48 L36 34 L40 34 L40 30 L44 30 L44 48" />
      <path d="M44 48 L44 38 L48 38 L48 32 L52 32 L52 36 L56 36 L56 42 L60 42 L60 48" />
      <line x1="2" y1="48" x2="62" y2="48" strokeWidth="1" />
      <path d="M2 54 Q16 50 32 54 Q48 50 62 54" strokeWidth="1" opacity="0.25" />
      <path d="M2 58 Q16 54 32 58 Q48 54 62 58" strokeWidth="1" opacity="0.15" />
    </svg>
  );
}
