import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'Briefing', path: '/briefing' },
  { label: 'Signals', path: '/signals' },
  { label: 'Outlook', path: '/outlook' },
];

interface Props {
  briefingText?: string;
}

export default function NavBar({ briefingText }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function go(path: string) {
    if (path === '/') {
      navigate(path);
    } else {
      navigate(path, briefingText ? { state: { briefingText } } : undefined);
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
      <span
        style={{
          color: '#2E86C1',
          fontWeight: 700,
          fontSize: '17px',
          letterSpacing: '0.5px',
          marginRight: '20px',
          flexShrink: 0,
        }}
      >
        CityPulse
      </span>

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
