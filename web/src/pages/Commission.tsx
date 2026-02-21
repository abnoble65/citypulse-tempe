import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import { supabase } from '../services/supabase';

interface Vote {
  commissioner_name: string;
  vote: string;
}

interface Project {
  id: string;
  address: string;
  case_number: string;
  action: string;
  hearings: { hearing_date: string; pdf_url: string };
  votes: Vote[];
}

interface HearingProject {
  id: string;
  action: string;
  address: string;
  project_description: string;
  motion_number: string | null;
}

interface Hearing {
  id: string;
  hearing_date: string;
  pdf_url: string;
  projects: HearingProject[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function actionSummary(projects: HearingProject[]) {
  const counts: Record<string, number> = {};
  for (const p of projects) {
    const action = p.action || 'Unknown';
    counts[action] = (counts[action] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([action, count]) => `${count} ${action}`)
    .join(', ');
}

const SIGNIFICANCE_KEYWORDS = [
  'new construction', 'demolition', 'mixed-use', 'mixed use',
  'affordable housing', 'high-rise', 'highrise', 'tower', 'residential',
];

function getSignificantProjects(projects: HearingProject[]): HearingProject[] {
  const scored = projects.map((p) => {
    let score = 0;
    const desc = (p.project_description || '').toLowerCase();
    for (const kw of SIGNIFICANCE_KEYWORDS) {
      if (desc.includes(kw)) score++;
    }
    if (/\$[\d,.]+/.test(p.project_description || '')) score++;
    return { project: p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.project);
}

function actionPillStyle(action: string): React.CSSProperties {
  const a = (action || '').toLowerCase();
  let bg = 'rgba(255,255,255,0.1)';
  let color = 'rgba(255,255,255,0.7)';
  if (a.includes('approved')) { bg = 'rgba(39,174,96,0.2)'; color = '#27AE60'; }
  else if (a.includes('denied') || a.includes('disapproved')) { bg = 'rgba(231,76,60,0.2)'; color = '#E74C3C'; }
  else if (a.includes('continued')) { bg = 'rgba(241,196,15,0.2)'; color = '#F1C40F'; }
  return {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '6px',
    background: bg,
    color,
  };
}

export default function Commission() {
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loadingHearings, setLoadingHearings] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Project[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    supabase
      .from('hearings')
      .select('id, hearing_date, pdf_url, projects(id, action, address, project_description, motion_number)')
      .order('hearing_date', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!error && data) setHearings(data as Hearing[]);
        setLoadingHearings(false);
      });
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setLoadingSearch(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*, hearings!inner(hearing_date, pdf_url), votes(commissioner_name, vote)')
      .ilike('address', `%${q}%`);
    if (!error && data) setSearchResults(data as Project[]);
    setLoadingSearch(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1B4F72' }}>
      <NavBar />

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
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
            Planning Commission
          </span>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#fff',
              margin: 0,
              letterSpacing: '-0.3px',
            }}
          >
            Commission Hearings
          </h1>
        </div>

        {/* Recent Hearings */}
        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '16px' }}>
            Recent Hearings
          </h2>

          {loadingHearings ? (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Loading hearings...</p>
          ) : hearings.length === 0 ? (
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '48px 32px',
                textAlign: 'center',
              }}
            >
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px', margin: 0 }}>
                No hearings found. Run the ingestion script to populate data.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hearings.map((h) => {
                const significant = getSignificantProjects(h.projects);
                return (
                  <div
                    key={h.id}
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '14px',
                      padding: '20px 24px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <p style={{ color: '#fff', fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' }}>
                          {formatDate(h.hearing_date)}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 4px 0' }}>
                          {h.projects.length} project{h.projects.length !== 1 ? 's' : ''}
                        </p>
                        {h.projects.length > 0 && (
                          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
                            {actionSummary(h.projects)}
                          </p>
                        )}
                      </div>
                      {h.pdf_url && (
                        <a
                          href={h.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: 'rgba(46,134,193,0.2)',
                            border: '1px solid rgba(46,134,193,0.4)',
                            color: '#2E86C1',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            flexShrink: 0,
                          }}
                        >
                          PDF
                        </a>
                      )}
                    </div>

                    {significant.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px' }}>
                        {significant.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              borderLeft: '3px solid rgba(46,134,193,0.5)',
                              borderRadius: '0 8px 8px 0',
                              padding: '10px 14px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                                {p.address}
                              </span>
                              <span style={actionPillStyle(p.action)}>{p.action}</span>
                            </div>
                            {p.project_description && (
                              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                                {p.project_description.length > 100
                                  ? p.project_description.slice(0, 100) + '...'
                                  : p.project_description}
                              </p>
                            )}
                            {p.motion_number && (
                              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '3px 0 0 0' }}>
                                Motion {p.motion_number}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Address Search */}
        <section>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '16px' }}>
            Search by Address
          </h2>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter an address..."
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#2E86C1')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
            <button
              type="submit"
              style={{
                background: '#2E86C1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Search
            </button>
          </form>

          {loadingSearch ? (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Searching...</p>
          ) : searchResults.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '14px',
                    padding: '20px 24px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0' }}>
                        {p.address}
                      </p>
                      {p.case_number && (
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 4px 0' }}>
                          Case {p.case_number}
                        </p>
                      )}
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 4px 0' }}>
                        {formatDate(p.hearings.hearing_date)} &mdash; {p.action}
                      </p>
                      {p.votes.length > 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: 0 }}>
                          Votes: {p.votes.map((v) => `${v.commissioner_name}: ${v.vote}`).join(', ')}
                        </p>
                      )}
                    </div>
                    {p.hearings.pdf_url && (
                      <a
                        href={p.hearings.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: 'rgba(46,134,193,0.2)',
                          border: '1px solid rgba(46,134,193,0.4)',
                          color: '#2E86C1',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          flexShrink: 0,
                        }}
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery && !loadingSearch ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
              No results found for "{searchQuery}"
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
