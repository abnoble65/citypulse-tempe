import { useNavigate, useLocation } from 'react-router-dom';
import type { DistrictData } from '../services/briefing';

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'Briefing', path: '/briefing' },
  { label: 'Charts', path: '/charts' },
  { label: 'Signals', path: '/signals' },
  { label: 'Outlook', path: '/outlook' },
  { label: 'Commission', path: '/commission' },
];

interface Props {
  briefingText?: string;
  aggregatedData?: DistrictData;
  selectedZip?: string;
  selectedNeighborhood?: string;
}

export default function NavBar({ briefingText, aggregatedData, selectedZip, selectedNeighborhood }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function go(path: string) {
    if (path === '/') {
      navigate(path);
    } else {
      navigate(path, { state: { briefingText, aggregatedData, selectedZip, selectedNeighborhood } });
    }
  }

  return (
    <nav
      style={{
        background: '#154360',
        padding: '0 24px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <img
        src="/CityPulse_Logo1_Fun.png"
        alt="CityPulse"
        style={{ height: '40px', marginRight: '20px', flexShrink: 0 }}
      />

      {NAV_ITEMS.map((item) => {
        const active = pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => go(item.path)}
            style={{
              background: active ? 'rgba(46,134,193,0.2)' : 'transparent',
              border: active ? '1px solid rgba(46,134,193,0.4)' : '1px solid transparent',
              color: active ? '#2E86C1' : 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: active ? 600 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
