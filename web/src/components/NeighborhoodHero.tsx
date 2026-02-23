import { FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";

interface NeighborhoodHeroProps {
  selected: string;
}

/* ─── SVG Street Scenes ──────────────────────── */

function NorthBeachScene() {
  return (
    <svg viewBox="0 0 1200 500" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="nb-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2C4A3E" />
          <stop offset="40%" stopColor="#5B7B6A" />
          <stop offset="75%" stopColor="#C49A3B" />
          <stop offset="100%" stopColor="#DEB04A" />
        </linearGradient>
        <radialGradient id="nb-sun" cx="80%" cy="20%" r="50%">
          <stop offset="0%" stopColor="#F2D06B" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#C49A3B" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#2C4A3E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nb-haze" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#2C3A2E" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#4A6050" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#C49A3B" stopOpacity="0" />
        </linearGradient>
        <filter id="nb-blur"><feGaussianBlur stdDeviation="2" /></filter>
        <filter id="nb-blur-far"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <rect width="1200" height="500" fill="url(#nb-sky)" />
      <rect width="1200" height="500" fill="url(#nb-sun)" />
      <path d="M0 320 Q200 260 400 290 Q600 250 800 280 Q1000 240 1200 270 L1200 500 L0 500Z" fill="#3D5A48" opacity="0.3" filter="url(#nb-blur-far)" />
      <g opacity="0.25" filter="url(#nb-blur-far)">
        <rect x="50" y="240" width="35" height="130" rx="2" fill="#4A6352" />
        <rect x="100" y="260" width="40" height="110" rx="2" fill="#4A6352" />
        <rect x="200" y="220" width="45" height="150" rx="2" fill="#4A6352" />
        <rect x="300" y="250" width="30" height="120" rx="2" fill="#4A6352" />
        <rect x="500" y="230" width="38" height="140" rx="2" fill="#4A6352" />
        <rect x="900" y="240" width="42" height="130" rx="2" fill="#4A6352" />
        <rect x="1050" y="220" width="35" height="150" rx="2" fill="#4A6352" />
      </g>
      <g opacity="0.45" filter="url(#nb-blur)">
        <rect x="30" y="280" width="55" height="140" rx="2" fill="#3A5242" />
        <rect x="95" y="260" width="48" height="160" rx="2" fill="#3A5242" />
        <rect x="155" y="290" width="42" height="130" rx="2" fill="#3A5242" />
        <rect x="210" y="270" width="60" height="150" rx="2" fill="#3A5242" />
        <rect x="350" y="285" width="50" height="135" rx="2" fill="#3A5242" />
        <rect x="420" y="265" width="45" height="155" rx="2" fill="#3A5242" />
        <rect x="550" y="275" width="52" height="145" rx="2" fill="#3A5242" />
        <rect x="620" y="290" width="40" height="130" rx="2" fill="#3A5242" />
        <rect x="780" y="270" width="55" height="150" rx="2" fill="#3A5242" />
        <rect x="900" y="260" width="48" height="160" rx="2" fill="#3A5242" />
        <rect x="1000" y="280" width="52" height="140" rx="2" fill="#3A5242" />
        <rect x="1070" y="270" width="45" height="150" rx="2" fill="#3A5242" />
      </g>
      <g opacity="0.7">
        <rect x="830" y="140" width="28" height="200" rx="3" fill="#4E6A55" />
        <ellipse cx="844" cy="140" rx="18" ry="10" fill="#4E6A55" />
        <rect x="822" y="175" width="44" height="10" rx="2" fill="#4E6A55" />
        <rect x="816" y="330" width="56" height="10" rx="2" fill="#4E6A55" />
        <g opacity="0.4">
          <rect x="836" y="195" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.6" />
          <rect x="846" y="200" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.4" />
          <rect x="836" y="215" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.5" />
          <rect x="846" y="220" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.3" />
          <rect x="836" y="255" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.6" />
          <rect x="846" y="260" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.4" />
          <rect x="836" y="275" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.5" />
          <rect x="846" y="280" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.35" />
          <rect x="836" y="295" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.45" />
          <rect x="846" y="300" width="4" height="8" rx="1" fill="#E8C86A" opacity="0.3" />
        </g>
      </g>
      <path d="M700 380 Q800 310 900 340 Q950 330 1000 350 L1000 420 L700 420Z" fill="#3A5040" opacity="0.5" />
      <g opacity="0.75">
        <rect x="0" y="330" width="65" height="120" rx="2" fill="#2D4035" />
        <rect x="75" y="310" width="58" height="140" rx="2" fill="#2A3C32" />
        <rect x="145" y="325" width="52" height="125" rx="2" fill="#2D4035" />
        <rect x="208" y="300" width="62" height="150" rx="2" fill="#283A30" />
        <rect x="290" y="320" width="55" height="130" rx="2" fill="#2D4035" />
        <rect x="360" y="310" width="50" height="140" rx="2" fill="#2A3C32" />
        <rect x="430" y="335" width="60" height="115" rx="2" fill="#2D4035" />
        <rect x="505" y="315" width="48" height="135" rx="2" fill="#283A30" />
        <rect x="568" y="330" width="55" height="120" rx="2" fill="#2D4035" />
        <rect x="640" y="305" width="52" height="145" rx="2" fill="#2A3C32" />
        <rect x="960" y="325" width="58" height="125" rx="2" fill="#2D4035" />
        <rect x="1030" y="310" width="62" height="140" rx="2" fill="#283A30" />
        <rect x="1105" y="320" width="55" height="130" rx="2" fill="#2D4035" />
      </g>
      <g opacity="0.55">
        <rect x="85" y="330" width="5" height="7" rx="1" fill="#F2D06B" opacity="0.5" />
        <rect x="97" y="335" width="5" height="7" rx="1" fill="#E8C060" opacity="0.4" />
        <rect x="160" y="345" width="5" height="7" rx="1" fill="#F2D06B" opacity="0.45" />
        <rect x="222" y="320" width="5" height="7" rx="1" fill="#F2D06B" opacity="0.5" />
        <rect x="234" y="340" width="5" height="7" rx="1" fill="#E8C060" opacity="0.35" />
        <rect x="305" y="340" width="5" height="7" rx="1" fill="#F2D06B" opacity="0.4" />
        <rect x="375" y="330" width="5" height="7" rx="1" fill="#E8C060" opacity="0.5" />
        <rect x="445" y="355" width="5" height="7" rx="1" fill="#F2D06B" opacity="0.35" />
        <rect x="520" y="335" width="5" height="7" rx="1" fill="#F2D06B" opacity="0.45" />
        <rect x="582" y="350" width="5" height="7" rx="1" fill="#E8C060" opacity="0.4" />
        <rect x="655" y="325" width="5" height="7" rx="1" fill="#F2D06B" opacity="0.5" />
        <rect x="975" y="345" width="5" height="7" rx="1" fill="#F2D06B" opacity="0.4" />
        <rect x="1045" y="330" width="5" height="7" rx="1" fill="#E8C060" opacity="0.45" />
        <rect x="1120" y="340" width="5" height="7" rx="1" fill="#F2D06B" opacity="0.35" />
      </g>
      <rect x="0" y="430" width="1200" height="70" fill="#1E2E24" />
      <rect width="1200" height="500" fill="url(#nb-haze)" />
      <g opacity="0.3">
        <line x1="150" y1="410" x2="150" y2="445" stroke="#8A9880" strokeWidth="2" />
        <circle cx="150" cy="408" r="4" fill="#F2D06B" opacity="0.5" />
        <circle cx="150" cy="408" r="12" fill="#F2D06B" opacity="0.08" />
        <line x1="400" y1="410" x2="400" y2="445" stroke="#8A9880" strokeWidth="2" />
        <circle cx="400" cy="408" r="4" fill="#F2D06B" opacity="0.5" />
        <circle cx="400" cy="408" r="12" fill="#F2D06B" opacity="0.08" />
        <line x1="650" y1="410" x2="650" y2="445" stroke="#8A9880" strokeWidth="2" />
        <circle cx="650" cy="408" r="4" fill="#F2D06B" opacity="0.5" />
        <circle cx="650" cy="408" r="12" fill="#F2D06B" opacity="0.08" />
        <line x1="950" y1="410" x2="950" y2="445" stroke="#8A9880" strokeWidth="2" />
        <circle cx="950" cy="408" r="4" fill="#F2D06B" opacity="0.5" />
        <circle cx="950" cy="408" r="12" fill="#F2D06B" opacity="0.08" />
      </g>
    </svg>
  );
}

function FinancialDistrictScene() {
  return (
    <svg viewBox="0 0 1200 500" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="fd-sky" x1="0" y1="0" x2="1" y2="0.8">
          <stop offset="0%" stopColor="#141E38" />
          <stop offset="45%" stopColor="#2A4070" />
          <stop offset="80%" stopColor="#B07830" />
          <stop offset="100%" stopColor="#D49840" />
        </linearGradient>
        <radialGradient id="fd-sun" cx="85%" cy="15%" r="45%">
          <stop offset="0%" stopColor="#E8B040" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#D49840" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#141E38" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fd-haze" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#0E1828" stopOpacity="0.9" />
          <stop offset="35%" stopColor="#1A2844" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#D49840" stopOpacity="0" />
        </linearGradient>
        <filter id="fd-blur"><feGaussianBlur stdDeviation="2.5" /></filter>
        <filter id="fd-blur-far"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <rect width="1200" height="500" fill="url(#fd-sky)" />
      <rect width="1200" height="500" fill="url(#fd-sun)" />
      <g opacity="0.2" filter="url(#fd-blur-far)">
        <rect x="50" y="120" width="50" height="280" rx="2" fill="#2A3A5E" />
        <rect x="130" y="160" width="45" height="240" rx="2" fill="#2A3A5E" />
        <rect x="250" y="100" width="55" height="300" rx="2" fill="#2A3A5E" />
        <rect x="600" y="140" width="48" height="260" rx="2" fill="#2A3A5E" />
        <rect x="800" y="110" width="52" height="290" rx="2" fill="#2A3A5E" />
        <rect x="1000" y="150" width="45" height="250" rx="2" fill="#2A3A5E" />
      </g>
      <g opacity="0.55" filter="url(#fd-blur)">
        <polygon points="430,80 400,420 460,420" fill="#283C62" />
        <polygon points="410,250 370,250 400,420" fill="#253860" opacity="0.5" />
        <polygon points="450,250 490,250 460,420" fill="#253860" opacity="0.5" />
      </g>
      <g opacity="0.5" filter="url(#fd-blur)">
        <rect x="560" y="60" width="48" height="360" rx="20" fill="#253860" />
        <g opacity="0.3">
          <rect x="570" y="80" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.5" />
          <rect x="584" y="84" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.3" />
          <rect x="570" y="100" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.4" />
          <rect x="584" y="104" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.6" />
          <rect x="570" y="120" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.3" />
          <rect x="584" y="124" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.5" />
          <rect x="570" y="160" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.45" />
          <rect x="584" y="164" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.35" />
          <rect x="570" y="200" width="8" height="6" rx="1" fill="#C8A050" opacity="0.4" />
          <rect x="584" y="204" width="8" height="6" rx="1" fill="#C8A050" opacity="0.5" />
          <rect x="570" y="240" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.3" />
          <rect x="584" y="280" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.45" />
          <rect x="570" y="320" width="8" height="6" rx="1" fill="#C8A050" opacity="0.35" />
          <rect x="584" y="360" width="8" height="6" rx="1" fill="#8AAED0" opacity="0.4" />
        </g>
      </g>
      <g opacity="0.55">
        <rect x="0" y="200" width="70" height="240" rx="2" fill="#1E2E4E" />
        <rect x="85" y="170" width="60" height="270" rx="2" fill="#1C2A48" />
        <rect x="160" y="210" width="55" height="230" rx="2" fill="#1E2E4E" />
        <rect x="280" y="180" width="65" height="260" rx="2" fill="#1C2A48" />
        <rect x="360" y="220" width="50" height="220" rx="2" fill="#1E2E4E" />
        <rect x="500" y="190" width="52" height="250" rx="2" fill="#1C2A48" />
        <rect x="630" y="200" width="58" height="240" rx="2" fill="#1E2E4E" />
        <rect x="700" y="170" width="62" height="270" rx="2" fill="#1C2A48" />
        <rect x="780" y="210" width="55" height="230" rx="2" fill="#1E2E4E" />
        <rect x="870" y="180" width="60" height="260" rx="2" fill="#1C2A48" />
        <rect x="950" y="200" width="50" height="240" rx="2" fill="#1E2E4E" />
        <rect x="1020" y="160" width="65" height="280" rx="2" fill="#1C2A48" />
        <rect x="1100" y="190" width="58" height="250" rx="2" fill="#1E2E4E" />
      </g>
      <g opacity="0.35">
        <rect x="15" y="220" width="6" height="8" rx="1" fill="#90B8E0" opacity="0.4" />
        <rect x="37" y="228" width="6" height="8" rx="1" fill="#C8A050" opacity="0.3" />
        <rect x="100" y="190" width="6" height="8" rx="1" fill="#90B8E0" opacity="0.5" />
        <rect x="122" y="210" width="6" height="8" rx="1" fill="#C8A050" opacity="0.35" />
        <rect x="175" y="230" width="6" height="8" rx="1" fill="#90B8E0" opacity="0.4" />
        <rect x="295" y="200" width="6" height="8" rx="1" fill="#90B8E0" opacity="0.45" />
        <rect x="322" y="220" width="6" height="8" rx="1" fill="#C8A050" opacity="0.3" />
        <rect x="515" y="210" width="6" height="8" rx="1" fill="#90B8E0" opacity="0.4" />
        <rect x="645" y="220" width="6" height="8" rx="1" fill="#C8A050" opacity="0.35" />
        <rect x="715" y="190" width="6" height="8" rx="1" fill="#90B8E0" opacity="0.5" />
        <rect x="742" y="230" width="6" height="8" rx="1" fill="#C8A050" opacity="0.3" />
        <rect x="885" y="200" width="6" height="8" rx="1" fill="#90B8E0" opacity="0.4" />
        <rect x="1035" y="180" width="6" height="8" rx="1" fill="#90B8E0" opacity="0.45" />
        <rect x="1060" y="220" width="6" height="8" rx="1" fill="#C8A050" opacity="0.35" />
        <rect x="1115" y="210" width="6" height="8" rx="1" fill="#90B8E0" opacity="0.4" />
      </g>
      <rect x="0" y="430" width="1200" height="70" fill="#0C1424" />
      <rect width="1200" height="500" fill="url(#fd-haze)" />
      <g opacity="0.35">
        <line x1="100" y1="415" x2="100" y2="445" stroke="#4A6080" strokeWidth="2" />
        <circle cx="100" cy="413" r="3" fill="#E8C870" opacity="0.6" />
        <circle cx="100" cy="413" r="15" fill="#E8C870" opacity="0.06" />
        <line x1="350" y1="415" x2="350" y2="445" stroke="#4A6080" strokeWidth="2" />
        <circle cx="350" cy="413" r="3" fill="#E8C870" opacity="0.6" />
        <circle cx="350" cy="413" r="15" fill="#E8C870" opacity="0.06" />
        <line x1="600" y1="415" x2="600" y2="445" stroke="#4A6080" strokeWidth="2" />
        <circle cx="600" cy="413" r="3" fill="#E8C870" opacity="0.6" />
        <circle cx="600" cy="413" r="15" fill="#E8C870" opacity="0.06" />
        <line x1="850" y1="415" x2="850" y2="445" stroke="#4A6080" strokeWidth="2" />
        <circle cx="850" cy="413" r="3" fill="#E8C870" opacity="0.6" />
        <circle cx="850" cy="413" r="15" fill="#E8C870" opacity="0.06" />
        <line x1="1100" y1="415" x2="1100" y2="445" stroke="#4A6080" strokeWidth="2" />
        <circle cx="1100" cy="413" r="3" fill="#E8C870" opacity="0.6" />
        <circle cx="1100" cy="413" r="15" fill="#E8C870" opacity="0.06" />
      </g>
    </svg>
  );
}

function ChinatownScene() {
  return (
    <svg viewBox="0 0 1200 500" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="ct-sky" x1="0" y1="0" x2="1" y2="0.7">
          <stop offset="0%" stopColor="#6B1A12" />
          <stop offset="40%" stopColor="#B84828" />
          <stop offset="75%" stopColor="#D49030" />
          <stop offset="100%" stopColor="#E8B848" />
        </linearGradient>
        <radialGradient id="ct-sun" cx="55%" cy="10%" r="50%">
          <stop offset="0%" stopColor="#F0C040" stopOpacity="0.3" />
          <stop offset="60%" stopColor="#D49030" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#6B1A12" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ct-haze" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3A1008" stopOpacity="0.9" />
          <stop offset="35%" stopColor="#6B2818" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#D49030" stopOpacity="0" />
        </linearGradient>
        <filter id="ct-blur"><feGaussianBlur stdDeviation="2" /></filter>
        <filter id="ct-blur-far"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <rect width="1200" height="500" fill="url(#ct-sky)" />
      <rect width="1200" height="500" fill="url(#ct-sun)" />
      <g opacity="0.25" filter="url(#ct-blur-far)">
        <rect x="40" y="200" width="35" height="170" rx="2" fill="#7A2A1A" />
        <rect x="110" y="230" width="50" height="140" rx="2" fill="#7A2A1A" />
        <rect x="200" y="210" width="40" height="160" rx="2" fill="#7A2A1A" />
        <rect x="310" y="240" width="35" height="130" rx="2" fill="#7A2A1A" />
        <rect x="450" y="220" width="45" height="150" rx="2" fill="#7A2A1A" />
        <rect x="680" y="230" width="38" height="140" rx="2" fill="#7A2A1A" />
        <rect x="800" y="210" width="42" height="160" rx="2" fill="#7A2A1A" />
        <rect x="900" y="240" width="35" height="130" rx="2" fill="#7A2A1A" />
        <rect x="1020" y="220" width="50" height="150" rx="2" fill="#7A2A1A" />
        <rect x="1100" y="200" width="40" height="170" rx="2" fill="#7A2A1A" />
      </g>
      <g opacity="0.5" filter="url(#ct-blur)">
        <rect x="170" y="230" width="50" height="160" fill="#7A2818" />
        <path d="M145 230 Q195 210 245 230 L248 225 L142 225Z" fill="#8A3020" />
        <path d="M160 200 Q195 185 230 200 L232 196 L158 196Z" fill="#8A3020" />
        <rect x="680" y="250" width="45" height="140" fill="#7A2818" />
        <path d="M655 250 Q702 232 750 250 L753 246 L652 246Z" fill="#8A3020" />
        <rect x="1000" y="240" width="48" height="150" fill="#7A2818" />
        <path d="M975 240 Q1024 222 1073 240 L1076 236 L972 236Z" fill="#8A3020" />
        <path d="M988 210 Q1024 198 1060 210 L1062 207 L986 207Z" fill="#8A3020" />
      </g>
      <g opacity="0.6">
        <rect x="530" y="180" width="16" height="250" fill="#6A2015" />
        <rect x="654" y="180" width="16" height="250" fill="#6A2015" />
        <rect x="558" y="210" width="12" height="220" fill="#6A2015" opacity="0.7" />
        <rect x="630" y="210" width="12" height="220" fill="#6A2015" opacity="0.7" />
        <path d="M510 180 Q600 150 690 180 L695 174 L506 174Z" fill="#7A2818" />
        <path d="M525 158 Q600 135 675 158 L678 153 L522 153Z" fill="#7A2818" />
        <rect x="540" y="195" width="120" height="8" rx="2" fill="#6A2015" />
      </g>
      <g opacity="0.6">
        <rect x="0" y="290" width="60" height="130" rx="2" fill="#5A1E12" />
        <rect x="70" y="275" width="55" height="145" rx="2" fill="#4E1810" />
        <rect x="140" y="295" width="48" height="125" rx="2" fill="#5A1E12" />
        <rect x="260" y="280" width="58" height="140" rx="2" fill="#4E1810" />
        <rect x="330" y="300" width="50" height="120" rx="2" fill="#5A1E12" />
        <rect x="410" y="270" width="55" height="150" rx="2" fill="#4E1810" />
        <rect x="480" y="295" width="45" height="125" rx="2" fill="#5A1E12" />
        <rect x="710" y="280" width="58" height="140" rx="2" fill="#4E1810" />
        <rect x="775" y="270" width="52" height="150" rx="2" fill="#5A1E12" />
        <rect x="850" y="290" width="60" height="130" rx="2" fill="#4E1810" />
        <rect x="920" y="275" width="48" height="145" rx="2" fill="#5A1E12" />
        <rect x="1070" y="285" width="55" height="135" rx="2" fill="#4E1810" />
        <rect x="1140" y="270" width="50" height="150" rx="2" fill="#5A1E12" />
      </g>
      <g>
        <ellipse cx="80" cy="178" rx="8" ry="10" fill="#C83020" opacity="0.65" />
        <ellipse cx="80" cy="178" rx="22" ry="24" fill="#FF6030" opacity="0.07" />
        <ellipse cx="200" cy="172" rx="8" ry="10" fill="#C83020" opacity="0.7" />
        <ellipse cx="200" cy="172" rx="22" ry="24" fill="#FF6030" opacity="0.07" />
        <ellipse cx="320" cy="180" rx="8" ry="10" fill="#C83020" opacity="0.6" />
        <ellipse cx="320" cy="180" rx="22" ry="24" fill="#FF6030" opacity="0.06" />
        <ellipse cx="440" cy="175" rx="8" ry="10" fill="#C83020" opacity="0.7" />
        <ellipse cx="440" cy="175" rx="22" ry="24" fill="#FF6030" opacity="0.07" />
        <ellipse cx="760" cy="170" rx="8" ry="10" fill="#C83020" opacity="0.65" />
        <ellipse cx="760" cy="170" rx="22" ry="24" fill="#FF6030" opacity="0.07" />
        <ellipse cx="880" cy="178" rx="8" ry="10" fill="#C83020" opacity="0.7" />
        <ellipse cx="880" cy="178" rx="22" ry="24" fill="#FF6030" opacity="0.06" />
        <ellipse cx="1000" cy="173" rx="8" ry="10" fill="#C83020" opacity="0.65" />
        <ellipse cx="1000" cy="173" rx="22" ry="24" fill="#FF6030" opacity="0.07" />
        <ellipse cx="1130" cy="180" rx="8" ry="10" fill="#C83020" opacity="0.6" />
        <ellipse cx="1130" cy="180" rx="22" ry="24" fill="#FF6030" opacity="0.06" />
      </g>
      <g opacity="0.4">
        <rect x="20" y="310" width="5" height="7" rx="1" fill="#F0C040" opacity="0.5" />
        <rect x="34" y="318" width="5" height="7" rx="1" fill="#E8A030" opacity="0.4" />
        <rect x="85" y="295" width="5" height="7" rx="1" fill="#F0C040" opacity="0.45" />
        <rect x="99" y="303" width="5" height="7" rx="1" fill="#E8A030" opacity="0.35" />
        <rect x="275" y="300" width="5" height="7" rx="1" fill="#F0C040" opacity="0.5" />
        <rect x="345" y="320" width="5" height="7" rx="1" fill="#F0C040" opacity="0.4" />
        <rect x="425" y="290" width="5" height="7" rx="1" fill="#E8A030" opacity="0.45" />
        <rect x="725" y="300" width="5" height="7" rx="1" fill="#F0C040" opacity="0.5" />
        <rect x="790" y="290" width="5" height="7" rx="1" fill="#E8A030" opacity="0.4" />
        <rect x="865" y="310" width="5" height="7" rx="1" fill="#F0C040" opacity="0.35" />
        <rect x="935" y="295" width="5" height="7" rx="1" fill="#F0C040" opacity="0.45" />
        <rect x="1085" y="305" width="5" height="7" rx="1" fill="#E8A030" opacity="0.4" />
        <rect x="1155" y="290" width="5" height="7" rx="1" fill="#F0C040" opacity="0.5" />
      </g>
      <rect x="0" y="420" width="1200" height="80" fill="#2A0C06" />
      <rect width="1200" height="500" fill="url(#ct-haze)" />
    </svg>
  );
}

function RussianHillScene() {
  return (
    <svg viewBox="0 0 1200 500" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="rh-sky" x1="0" y1="0" x2="1" y2="0.8">
          <stop offset="0%" stopColor="#2E4258" />
          <stop offset="45%" stopColor="#5A7A98" />
          <stop offset="78%" stopColor="#C09050" />
          <stop offset="100%" stopColor="#DCA858" />
        </linearGradient>
        <radialGradient id="rh-sun" cx="88%" cy="18%" r="42%">
          <stop offset="0%" stopColor="#E8C060" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#C09050" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#2E4258" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rh-haze" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#1C2C3A" stopOpacity="0.9" />
          <stop offset="35%" stopColor="#3A5068" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#C09050" stopOpacity="0" />
        </linearGradient>
        <filter id="rh-blur"><feGaussianBlur stdDeviation="2" /></filter>
        <filter id="rh-blur-far"><feGaussianBlur stdDeviation="4.5" /></filter>
      </defs>
      <rect width="1200" height="500" fill="url(#rh-sky)" />
      <rect width="1200" height="500" fill="url(#rh-sun)" />
      <path d="M800 200 Q1000 195 1200 210 L1200 280 Q1000 260 800 270Z" fill="#3A5A78" opacity="0.15" filter="url(#rh-blur-far)" />
      <path d="M0 300 Q150 260 300 280 Q500 240 700 270 Q900 250 1050 265 Q1150 255 1200 260 L1200 500 L0 500Z" fill="#344A5E" opacity="0.25" filter="url(#rh-blur-far)" />
      <path d="M0 360 Q100 320 250 340 Q400 310 550 335 Q700 305 850 330 Q1000 315 1100 325 L1200 320 L1200 500 L0 500Z" fill="#2E4255" opacity="0.4" filter="url(#rh-blur)" />
      <g opacity="0.6">
        <rect x="30" y="300" width="45" height="90" rx="2" fill="#263A4E" />
        <polygon points="30,300 52,282 75,300" fill="#263A4E" />
        <rect x="90" y="285" width="40" height="105" rx="2" fill="#2A3E52" />
        <polygon points="90,285 110,270 130,285" fill="#2A3E52" />
        <rect x="145" y="298" width="42" height="92" rx="2" fill="#223648" />
        <polygon points="145,298 166,280 187,298" fill="#223648" />
        <rect x="210" y="275" width="48" height="115" rx="2" fill="#263A4E" />
        <polygon points="210,275 234,258 258,275" fill="#263A4E" />
        <rect x="275" y="290" width="44" height="100" rx="2" fill="#2A3E52" />
        <polygon points="275,290 297,274 319,290" fill="#2A3E52" />
        <rect x="340" y="280" width="46" height="110" rx="2" fill="#223648" />
        <polygon points="340,280 363,263 386,280" fill="#223648" />
        <rect x="420" y="295" width="42" height="95" rx="2" fill="#263A4E" />
        <polygon points="420,295 441,278 462,295" fill="#263A4E" />
        <rect x="485" y="275" width="50" height="115" rx="2" fill="#2A3E52" />
        <polygon points="485,275 510,258 535,275" fill="#2A3E52" />
        <rect x="550" y="290" width="44" height="100" rx="2" fill="#223648" />
        <polygon points="550,290 572,274 594,290" fill="#223648" />
        <rect x="630" y="280" width="46" height="110" rx="2" fill="#263A4E" />
        <polygon points="630,280 653,263 676,280" fill="#263A4E" />
        <rect x="710" y="292" width="42" height="98" rx="2" fill="#2A3E52" />
        <polygon points="710,292 731,276 752,292" fill="#2A3E52" />
        <rect x="780" y="270" width="48" height="120" rx="2" fill="#223648" />
        <polygon points="780,270 804,252 828,270" fill="#223648" />
        <rect x="860" y="288" width="44" height="102" rx="2" fill="#263A4E" />
        <polygon points="860,288 882,272 904,288" fill="#263A4E" />
        <rect x="940" y="275" width="46" height="115" rx="2" fill="#2A3E52" />
        <polygon points="940,275 963,258 986,275" fill="#2A3E52" />
        <rect x="1020" y="290" width="42" height="100" rx="2" fill="#223648" />
        <polygon points="1020,290 1041,274 1062,290" fill="#223648" />
        <rect x="1090" y="280" width="50" height="110" rx="2" fill="#263A4E" />
        <polygon points="1090,280 1115,263 1140,280" fill="#263A4E" />
        <rect x="1155" y="295" width="45" height="95" rx="2" fill="#2A3E52" />
        <polygon points="1155,295 1177,280 1200,295" fill="#2A3E52" />
      </g>
      <g opacity="0.55">
        <line x1="0" y1="265" x2="1200" y2="240" stroke="#5A7080" strokeWidth="1.5" opacity="0.3" />
        <rect x="340" y="248" width="60" height="30" rx="4" fill="#3A5268" />
        <rect x="336" y="244" width="68" height="6" rx="2" fill="#3A5268" />
        <rect x="348" y="254" width="8" height="14" rx="1" fill="#E8C870" opacity="0.3" />
        <rect x="362" y="254" width="8" height="14" rx="1" fill="#E8C870" opacity="0.25" />
        <rect x="376" y="254" width="8" height="14" rx="1" fill="#E8C870" opacity="0.35" />
        <circle cx="355" cy="280" r="4" fill="#3A5268" />
        <circle cx="385" cy="280" r="4" fill="#3A5268" />
      </g>
      <g opacity="0.5">
        <rect x="48" y="315" width="5" height="7" rx="1" fill="#F0D070" opacity="0.45" />
        <rect x="60" y="320" width="5" height="7" rx="1" fill="#E8C060" opacity="0.35" />
        <rect x="108" y="300" width="5" height="7" rx="1" fill="#F0D070" opacity="0.5" />
        <rect x="120" y="305" width="5" height="7" rx="1" fill="#E8C060" opacity="0.3" />
        <rect x="228" y="290" width="5" height="7" rx="1" fill="#F0D070" opacity="0.4" />
        <rect x="293" y="305" width="5" height="7" rx="1" fill="#E8C060" opacity="0.45" />
        <rect x="358" y="295" width="5" height="7" rx="1" fill="#F0D070" opacity="0.35" />
        <rect x="503" y="290" width="5" height="7" rx="1" fill="#F0D070" opacity="0.5" />
        <rect x="568" y="305" width="5" height="7" rx="1" fill="#E8C060" opacity="0.4" />
        <rect x="648" y="295" width="5" height="7" rx="1" fill="#F0D070" opacity="0.35" />
        <rect x="798" y="285" width="5" height="7" rx="1" fill="#F0D070" opacity="0.5" />
        <rect x="878" y="303" width="5" height="7" rx="1" fill="#E8C060" opacity="0.35" />
        <rect x="958" y="290" width="5" height="7" rx="1" fill="#F0D070" opacity="0.45" />
        <rect x="1108" y="295" width="5" height="7" rx="1" fill="#E8C060" opacity="0.4" />
      </g>
      <path d="M850 330 Q870 325 880 330 Q890 335 900 330 Q910 325 920 330 Q930 335 940 330 Q950 325 960 330" fill="none" stroke="#6A8898" strokeWidth="3" opacity="0.2" />
      <rect x="0" y="430" width="1200" height="70" fill="#162230" />
      <rect width="1200" height="500" fill="url(#rh-haze)" />
      <g opacity="0.3">
        <line x1="120" y1="410" x2="120" y2="442" stroke="#5A7080" strokeWidth="2" />
        <circle cx="120" cy="408" r="3.5" fill="#F0D070" opacity="0.5" />
        <circle cx="120" cy="408" r="14" fill="#F0D070" opacity="0.06" />
        <line x1="380" y1="410" x2="380" y2="442" stroke="#5A7080" strokeWidth="2" />
        <circle cx="380" cy="408" r="3.5" fill="#F0D070" opacity="0.5" />
        <circle cx="380" cy="408" r="14" fill="#F0D070" opacity="0.06" />
        <line x1="640" y1="410" x2="640" y2="442" stroke="#5A7080" strokeWidth="2" />
        <circle cx="640" cy="408" r="3.5" fill="#F0D070" opacity="0.5" />
        <circle cx="640" cy="408" r="14" fill="#F0D070" opacity="0.06" />
        <line x1="900" y1="410" x2="900" y2="442" stroke="#5A7080" strokeWidth="2" />
        <circle cx="900" cy="408" r="3.5" fill="#F0D070" opacity="0.5" />
        <circle cx="900" cy="408" r="14" fill="#F0D070" opacity="0.06" />
        <line x1="1120" y1="410" x2="1120" y2="442" stroke="#5A7080" strokeWidth="2" />
        <circle cx="1120" cy="408" r="3.5" fill="#F0D070" opacity="0.5" />
        <circle cx="1120" cy="408" r="14" fill="#F0D070" opacity="0.06" />
      </g>
    </svg>
  );
}

const SCENE_MAP: Record<string, React.FC> = {
  "North Beach": NorthBeachScene,
  "Financial District": FinancialDistrictScene,
  "Chinatown": ChinatownScene,
  "Russian Hill": RussianHillScene,
};

const HERO_DATA: Record<string, {
  subtitle: string;
  stats: { label: string; value: string }[];
}> = {
  "North Beach": {
    subtitle: "Telegraph Hill \u00b7 94133",
    stats: [
      { label: "Active Permits", value: "187" },
      { label: "Pipeline", value: "6" },
      { label: "Avg. Value", value: "$1.2M" },
    ],
  },
  "Financial District": {
    subtitle: "Jackson Square \u00b7 94111",
    stats: [
      { label: "Active Permits", value: "312" },
      { label: "Pipeline", value: "11" },
      { label: "Avg. Value", value: "$3.8M" },
    ],
  },
  "Chinatown": {
    subtitle: "Nob Hill \u00b7 94108",
    stats: [
      { label: "Active Permits", value: "143" },
      { label: "Pipeline", value: "3" },
      { label: "Avg. Value", value: "$0.9M" },
    ],
  },
  "Russian Hill": {
    subtitle: "Hyde Street \u00b7 94109",
    stats: [
      { label: "Active Permits", value: "175" },
      { label: "Pipeline", value: "3" },
      { label: "Avg. Value", value: "$1.5M" },
    ],
  },
};

export function NeighborhoodHero({ selected }: NeighborhoodHeroProps) {
  const isActive = selected !== "All District 3" && HERO_DATA[selected];
  const hero = HERO_DATA[selected];
  const neighborhood = NEIGHBORHOODS.find(n => n.name === selected);
  const SceneComponent = SCENE_MAP[selected];

  return (
    <div
      style={{
        maxHeight: isActive ? 250 : 0,
        opacity: isActive ? 1 : 0,
        overflow: "hidden",
        transition: "max-height 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease",
      }}
    >
      {hero && neighborhood && (
        <div
          style={{
            position: "relative",
            height: 250,
            display: "flex",
            alignItems: "flex-end",
            overflow: "hidden",
            background: "#1a1a1a",
          }}
        >
          {SceneComponent && <SceneComponent />}
          <div
            style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0, height: "70%",
              background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 100%)",
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 3,
              width: "100%",
              padding: "28px 40px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(255,255,255,0.18)",
                  flexShrink: 0,
                }}
              >
                <neighborhood.Icon size={36} color="#FFFFFF" />
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Urbanist', sans-serif",
                    fontSize: "clamp(26px, 4vw, 36px)",
                    fontWeight: 800, color: "#FFFFFF",
                    lineHeight: 1.1, letterSpacing: "-0.02em",
                    textShadow: "0 2px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  {selected}
                </h3>
                <p
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 14, fontWeight: 500,
                    color: "rgba(255,255,255,0.65)",
                    marginTop: 4, letterSpacing: "0.02em",
                  }}
                >
                  {hero.subtitle}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 28 }}>
              {hero.stats.map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "'Urbanist', sans-serif",
                      fontSize: 24, fontWeight: 800, color: "#FFFFFF",
                      letterSpacing: "-0.02em",
                      textShadow: "0 1px 10px rgba(0,0,0,0.4)",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.body, fontSize: 11, fontWeight: 500,
                      color: "rgba(255,255,255,0.55)", marginTop: 2,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
