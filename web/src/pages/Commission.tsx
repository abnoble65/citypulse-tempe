import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import NeighborhoodFilterBar, { DISTRICT_3_NEIGHBORHOODS } from '../components/NeighborhoodFilterBar';
import { supabase } from '../services/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Vote {
  commissioner_name: string;
  vote: string;
}

interface Comment {
  commissioner_name: string;
  comment_text: string;
}

interface ProjectResult {
  id: string;
  address: string;
  case_number: string | null;
  project_description: string | null;
  action: string | null;
  motion_number: string | null;
  shadow_flag: boolean | null;
  shadow_details: string | null;
  hearings: { hearing_date: string; pdf_url: string };
  votes: Vote[];
  commissioner_comments: Comment[];
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function actionSummary(projects: HearingProject[]) {
  const counts: Record<string, number> = {};
  for (const p of projects) {
    const a = p.action || 'Unknown';
    counts[a] = (counts[a] || 0) + 1;
  }
  return Object.entries(counts).map(([a, n]) => `${n} ${a}`).join(', ');
}

const SIGNIFICANCE_KEYWORDS = [
  'new construction', 'demolition', 'mixed-use', 'mixed use',
  'affordable housing', 'high-rise', 'highrise', 'tower', 'residential',
];

function getSignificantProjects(projects: HearingProject[]): HearingProject[] {
  return projects
    .map((p) => {
      const desc = (p.project_description || '').toLowerCase();
      const score = SIGNIFICANCE_KEYWORDS.filter((kw) => desc.includes(kw)).length
        + (/\$[\d,.]/.test(p.project_description || '') ? 1 : 0);
      return { project: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.project);
}

function actionPillStyle(action: string): React.CSSProperties {
  const a = (action || '').toLowerCase();
  let bg = 'rgba(255,255,255,0.1)', color = 'rgba(255,255,255,0.7)';
  if (a.includes('approved'))                       { bg = 'rgba(39,174,96,0.2)';  color = '#27AE60'; }
  else if (a.includes('denied') || a.includes('disapproved')) { bg = 'rgba(231,76,60,0.2)'; color = '#E74C3C'; }
  else if (a.includes('continued'))                 { bg = 'rgba(241,196,15,0.2)'; color = '#F1C40F'; }
  return { display: 'inline-block', fontSize: '11px', fontWeight: 600,
           padding: '2px 8px', borderRadius: '6px', background: bg, color };
}

function votePillStyle(vote: string): React.CSSProperties {
  const v = (vote || '').toLowerCase();
  let bg = 'rgba(255,255,255,0.08)', color = 'rgba(255,255,255,0.6)';
  if (v === 'aye')     { bg = 'rgba(39,174,96,0.15)';  color = '#27AE60'; }
  if (v === 'nay')     { bg = 'rgba(231,76,60,0.15)';  color = '#E74C3C'; }
  if (v === 'absent')  { bg = 'rgba(127,140,141,0.2)'; color = '#95A5A6'; }
  if (v === 'recused') { bg = 'rgba(241,196,15,0.15)'; color = '#F1C40F'; }
  return { display: 'inline-block', fontSize: '11px', fontWeight: 600,
           padding: '2px 8px', borderRadius: '6px', background: bg, color, whiteSpace: 'nowrap' as const };
}

// ── Address History Card ───────────────────────────────────────────────────────

function HistoryCard({ address, appearances }: { address: string; appearances: ProjectResult[] }) {
  const sorted = [...appearances].sort(
    (a, b) => b.hearings.hearing_date.localeCompare(a.hearings.hearing_date)
  );

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Address header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(46,134,193,0.08)',
        }}
      >
        <p style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0, letterSpacing: '0.2px' }}>
          {address}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '3px 0 0' }}>
          {appearances.length} hearing{appearances.length !== 1 ? 's' : ''} on record
        </p>
      </div>

      {/* Hearing timeline */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sorted.map((p, idx) => (
          <div
            key={p.id}
            style={{
              padding: '20px 24px',
              borderBottom: idx < sorted.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            {/* Date + case + motion row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 600, margin: '0 0 3px' }}>
                  {formatDate(p.hearings.hearing_date)}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {p.case_number && (
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                      Case {p.case_number}
                    </span>
                  )}
                  {p.motion_number && (
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
                      · Motion {p.motion_number}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {p.action && <span style={actionPillStyle(p.action)}>{p.action}</span>}
                {p.shadow_flag && (
                  <span style={{
                    display: 'inline-block', fontSize: '11px', fontWeight: 700,
                    padding: '2px 8px', borderRadius: '6px',
                    background: 'rgba(142,68,173,0.25)', color: '#C39BD3',
                    border: '1px solid rgba(142,68,173,0.4)',
                  }}>
                    🌑 Shadow Impact
                  </span>
                )}
                {p.hearings.pdf_url && (
                  <a
                    href={p.hearings.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(46,134,193,0.15)',
                      border: '1px solid rgba(46,134,193,0.35)',
                      color: '#2E86C1', padding: '3px 10px',
                      borderRadius: '6px', fontSize: '12px',
                      fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    PDF
                  </a>
                )}
              </div>
            </div>

            {/* Project description */}
            {p.project_description && (
              <p style={{
                color: 'rgba(255,255,255,0.65)', fontSize: '13px',
                lineHeight: 1.5, margin: '0 0 12px',
              }}>
                {p.project_description}
              </p>
            )}

            {/* Shadow details */}
            {p.shadow_flag && p.shadow_details && (
              <div style={{
                background: 'rgba(142,68,173,0.1)',
                border: '1px solid rgba(142,68,173,0.25)',
                borderRadius: '8px', padding: '10px 14px',
                marginBottom: '12px',
              }}>
                <p style={{ color: '#C39BD3', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                  {p.shadow_details}
                </p>
              </div>
            )}

            {/* Votes */}
            {p.votes.length > 0 && (
              <div style={{ marginBottom: p.commissioner_comments.length > 0 ? '12px' : 0 }}>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 600,
                             letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 6px' }}>
                  Votes
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {p.votes.map((v, i) => (
                    <span key={i} style={votePillStyle(v.vote)}>
                      {v.commissioner_name}: {v.vote}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            {p.commissioner_comments.length > 0 && (
              <div>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 600,
                             letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  Commissioner Comments
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {p.commissioner_comments.map((c, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderLeft: '2px solid rgba(46,134,193,0.4)',
                      borderRadius: '0 6px 6px 0',
                      padding: '8px 12px',
                    }}>
                      <p style={{ color: '#2E86C1', fontSize: '11px', fontWeight: 700, margin: '0 0 3px' }}>
                        {c.commissioner_name}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                        {c.comment_text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Commission() {
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loadingHearings, setLoadingHearings] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addressGroups, setAddressGroups] = useState<Map<string, ProjectResult[]>>(new Map());
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filterZip, setFilterZip] = useState<string | null>(null);

  const activeNeighborhood = DISTRICT_3_NEIGHBORHOODS.find((n) => n.zip === filterZip);

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
    setHasSearched(true);

    let query = supabase
      .from('projects')
      .select(`
        id, address, case_number, project_description, action, motion_number,
        shadow_flag, shadow_details,
        hearings!inner(hearing_date, pdf_url),
        votes(commissioner_name, vote),
        commissioner_comments(commissioner_name, comment_text)
      `)
      .ilike('address', `%${q}%`);

    if (filterZip) {
      query = query.ilike('address', `%${filterZip}%`);
    }

    const { data, error } = await query
      .order('hearing_date', { referencedTable: 'hearings', ascending: false });

    if (!error && data) {
      const groups = new Map<string, ProjectResult[]>();
      for (const row of data as ProjectResult[]) {
        const key = (row.address || '').trim();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }
      setAddressGroups(groups);
    }
    setLoadingSearch(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1B4F72' }}>
      <NavBar />
      <NeighborhoodFilterBar activeZip={filterZip} onChange={(zip) => {
        setFilterZip(zip);
        setHasSearched(false);
        setAddressGroups(new Map());
      }} />

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(46,134,193,0.2)',
              border: '1px solid rgba(46,134,193,0.35)',
              color: '#2E86C1', fontSize: '11px', fontWeight: 700,
              letterSpacing: '2px', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: '20px', marginBottom: '12px',
            }}
          >
            Planning Commission
          </span>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
            Commission Hearings
          </h1>
        </div>

        {/* Address Search */}
        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '16px' }}>
            Search by Address
          </h2>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeNeighborhood ? `Search addresses in ${activeNeighborhood.name.split(' / ')[0]}…` : 'Enter a street address…'}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px', padding: '10px 14px',
                color: '#fff', fontSize: '14px', outline: 'none',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#2E86C1')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
            <button
              type="submit"
              disabled={loadingSearch}
              style={{
                background: loadingSearch ? 'rgba(46,134,193,0.5)' : '#2E86C1',
                color: '#fff', border: 'none', borderRadius: '8px',
                padding: '10px 20px', fontSize: '14px', fontWeight: 600,
                cursor: loadingSearch ? 'not-allowed' : 'pointer', flexShrink: 0,
              }}
            >
              {loadingSearch ? 'Searching…' : 'Search'}
            </button>
          </form>

          {loadingSearch ? null : addressGroups.size > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Array.from(addressGroups.entries()).map(([address, appearances]) => (
                <HistoryCard key={address} address={address} appearances={appearances} />
              ))}
            </div>
          ) : hasSearched ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
              No results found for "{searchQuery}"
            </p>
          ) : null}
        </section>

        {/* Recent Hearings */}
        <section>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '16px' }}>
            Recent Hearings
          </h2>

          {loadingHearings ? (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Loading hearings…</p>
          ) : hearings.length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px', padding: '48px 32px', textAlign: 'center',
            }}>
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
                      borderRadius: '14px', padding: '20px 24px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <p style={{ color: '#fff', fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>
                          {formatDate(h.hearing_date)}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 4px' }}>
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
                          href={h.pdf_url} target="_blank" rel="noopener noreferrer"
                          style={{
                            background: 'rgba(46,134,193,0.2)', border: '1px solid rgba(46,134,193,0.4)',
                            color: '#2E86C1', padding: '6px 14px', borderRadius: '8px',
                            fontSize: '13px', fontWeight: 600, textDecoration: 'none', flexShrink: 0,
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
                              borderRadius: '0 8px 8px 0', padding: '10px 14px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{p.address}</span>
                              <span style={actionPillStyle(p.action)}>{p.action}</span>
                            </div>
                            {p.project_description && (
                              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '4px 0 0', lineHeight: 1.4 }}>
                                {p.project_description.length > 100
                                  ? p.project_description.slice(0, 100) + '…'
                                  : p.project_description}
                              </p>
                            )}
                            {p.motion_number && (
                              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '3px 0 0' }}>
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
      </main>
    </div>
  );
}
