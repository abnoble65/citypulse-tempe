import { useLocation, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import NavBar from '../components/NavBar';
import type { DistrictData } from '../services/briefing';

// ── Colour palette ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  complete:   '#27AE60',
  issued:     '#2E86C1',
  filed:      '#F39C12',
  expired:    '#E74C3C',
  cancelled:  '#7F8C8D',
  withdrawn:  '#95A5A6',
  plancheck:  '#8E44AD',
};
const FALLBACK_COLORS = ['#2E86C1', '#27AE60', '#8E44AD', '#1ABC9C', '#2980B9', '#16A085'];

function statusColor(name: string, idx: number): string {
  return STATUS_COLORS[name.toLowerCase()] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// ── Shared recharts style tokens ──────────────────────────────────────────────

const AXIS_STYLE = { fill: 'rgba(255,255,255,0.6)', fontSize: 11 };
const AXIS_STROKE = 'rgba(255,255,255,0.15)';
const GRID_STROKE = 'rgba(255,255,255,0.07)';
const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#154360',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
  },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSortedEntries(map: Record<string, number>, top = 8) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name, value]) => ({ name, value }));
}

function shortLabel(name: string, max = 30): string {
  const titled = name.charAt(0).toUpperCase() + name.slice(1);
  return titled.length > max ? titled.slice(0, max) + '…' : titled;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h2
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#2E86C1',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          margin: '0 0 16px',
          textAlign: 'center',
        }}
      >
        {title}
      </h2>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Chart 1: Status donut ─────────────────────────────────────────────────────

function StatusDonut({ byStatus }: { byStatus: Record<string, number> }) {
  const data = toSortedEntries(byStatus);

  return (
    <SectionCard title="Permit Status Breakdown">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="42%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={statusColor(entry.name, i)} />
            ))}
          </Pie>
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [value.toLocaleString(), shortLabel(name)]}
          />
          <Legend
            formatter={(value: string) => (
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                {shortLabel(value)}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

// ── Chart 2: Count by type ────────────────────────────────────────────────────

function CountByType({ byType }: { byType: Record<string, number> }) {
  const data = toSortedEntries(byType).map((d) => ({ ...d, name: shortLabel(d.name, 14) }));

  return (
    <SectionCard title="Permit Count by Type">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <XAxis
            type="number"
            tick={AXIS_STYLE}
            stroke={AXIS_STROKE}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={95}
            tick={{ ...AXIS_STYLE, fontSize: 10 }}
            stroke={AXIS_STROKE}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: number) => [value.toLocaleString(), 'Permits']}
          />
          <Bar dataKey="value" fill="#1ABC9C" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

// ── Chart 3: Estimated value by type ─────────────────────────────────────────

function ValueByType({ costByType }: { costByType: Record<string, number> }) {
  const data = toSortedEntries(costByType)
    .filter((d) => d.value > 0)
    .map((d) => ({ name: shortLabel(d.name, 14), value: +(d.value / 1_000_000).toFixed(2) }));

  return (
    <SectionCard title="Est. Value by Type ($M)">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <XAxis
            type="number"
            tick={AXIS_STYLE}
            stroke={AXIS_STROKE}
            tickFormatter={(v: number) => `$${v}M`}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={95}
            tick={{ ...AXIS_STYLE, fontSize: 10 }}
            stroke={AXIS_STROKE}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: number) => [`$${value}M`, 'Est. Value']}
          />
          <Bar dataKey="value" fill="#8E44AD" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Charts() {
  const { state } = useLocation() as { state?: { briefingText?: string; aggregatedData?: DistrictData } };
  const navigate = useNavigate();
  const { briefingText = '', aggregatedData } = state ?? {};
  const ps = aggregatedData?.permit_summary;

  return (
    <div style={{ minHeight: '100vh', background: '#1B4F72' }}>
      <NavBar briefingText={briefingText} aggregatedData={aggregatedData} />

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '28px' }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(46,134,193,0.2)',
              border: '1px solid rgba(46,134,193,0.35)',
              color: '#2E86C1',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              padding: '4px 12px',
              borderRadius: '20px',
              marginBottom: '12px',
            }}
          >
            District 3 Intelligence
          </span>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
            Charts
          </h1>
          {ps && (
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '6px' }}>
              Based on {ps.total.toLocaleString()} permits · total estimated value{' '}
              ${(ps.total_estimated_cost_usd / 1_000_000).toFixed(1)}M
            </p>
          )}
        </div>

        {ps ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            alignItems: 'stretch',
          }}>
            <StatusDonut byStatus={ps.by_status} />
            <CountByType byType={ps.by_type} />
            <ValueByType costByType={ps.cost_by_type} />
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              padding: '48px 32px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px', marginBottom: '20px' }}>
              No data available. Generate a briefing from the home page.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                background: '#2E86C1', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '10px 20px', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Go to Home
            </button>
          </div>
        )}

        {ps && (
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => navigate('/briefing', { state: { briefingText, aggregatedData } })}
              style={{
                background: 'rgba(255,255,255,0.08)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              ← The Briefing
            </button>
            <button
              onClick={() => navigate('/signals', { state: { briefingText, aggregatedData } })}
              style={{
                background: '#2E86C1', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '10px 20px', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Signals &amp; Zoning →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
