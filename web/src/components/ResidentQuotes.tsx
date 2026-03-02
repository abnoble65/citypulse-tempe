import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { supabase } from "../services/supabase";
import { SectionLabel } from "./SectionLabel";

interface QuoteEntry {
  text: string;
  hearingDate: string | null;
  projectContext: string | null; // address or description for attribution
}

// Module-level cache so the query only runs once per session.
let _cachedQuotes: QuoteEntry[] | null = null;

async function fetchResidentQuotes(): Promise<QuoteEntry[]> {
  if (_cachedQuotes !== null) return _cachedQuotes;

  try {
    // public_sentiment → hearings (hearing_date) → projects (address, description)
    // hearings has many projects, so projects comes back as an array.
    const { data } = await supabase
      .from("public_sentiment")
      .select(`
        notable_quotes,
        hearing:hearing_id(
          hearing_date,
          projects(address, project_description)
        )
      `)
      .order("id", { ascending: false })
      .limit(15);

    if (!data || data.length === 0) {
      _cachedQuotes = [];
      return [];
    }

    type Project = { address: string | null; project_description: string | null };
    // hearing is to-one FK join; Supabase JS client may return it as object or
    // single-element array depending on the generated types — handle both.
    type HearingShape = { hearing_date: string | null; projects: Project[] } | null;
    type Row = {
      notable_quotes: string[] | null;
      hearing: HearingShape | HearingShape[];
    };

    const entries: QuoteEntry[] = [];

    for (const row of data as unknown as Row[]) {
      const quotes = row.notable_quotes ?? [];

      // Normalise hearing to a single object regardless of how Supabase returned it
      const hearing: HearingShape = Array.isArray(row.hearing)
        ? (row.hearing[0] ?? null)
        : row.hearing;

      const date = hearing?.hearing_date ?? null;

      // Pick the first project that has a usable address or description
      const projects = hearing?.projects ?? [];
      const bestProject = projects.find(p => p.address || p.project_description) ?? null;
      const projectContext =
        bestProject?.address ??
        (bestProject?.project_description
          ? bestProject.project_description.slice(0, 60).trimEnd()
          : null);

      for (const q of quotes) {
        if (q && q.trim().length > 10) {
          entries.push({ text: q.trim(), hearingDate: date, projectContext });
          if (entries.length >= 3) break;
        }
      }
      if (entries.length >= 3) break;
    }

    _cachedQuotes = entries;
    return entries;
  } catch {
    _cachedQuotes = [];
    return [];
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatAttribution(q: QuoteEntry): string {
  const datePart = q.hearingDate ? `, ${formatDate(q.hearingDate)}` : "";
  if (q.projectContext) {
    return `Public comment on ${q.projectContext}${datePart}`;
  }
  return `Public comment, Planning Commission hearing${datePart}`;
}

export function ResidentQuotes({ style }: { style?: React.CSSProperties }) {
  const [quotes, setQuotes] = useState<QuoteEntry[] | null>(null);

  useEffect(() => {
    fetchResidentQuotes().then(setQuotes).catch(() => setQuotes([]));
  }, []);

  // Not loaded yet or no quotes — render nothing
  if (!quotes || quotes.length === 0) return null;

  return (
    <div style={style}>
      <SectionLabel text="From the Public Record" />
      <div style={{
        background: COLORS.white, borderRadius: 20,
        padding: "clamp(20px, 5vw, 40px) clamp(16px, 4vw, 44px)",
        border: `1px solid ${COLORS.lightBorder}`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
      }}>
        <h2 style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize: "clamp(20px, 3vw, 28px)",
          fontWeight: 800, color: COLORS.charcoal,
          lineHeight: 1.15, letterSpacing: "-0.02em",
          marginBottom: 6,
        }}>
          What residents said.
        </h2>
        <p style={{
          fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray,
          marginBottom: 28, lineHeight: 1.5,
        }}>
          Drawn from public comment at recent Planning Commission hearings.
        </p>

        {quotes.map((q, i) => (
          <div key={i} style={{
            paddingTop: i === 0 ? 0 : 24,
            paddingBottom: i < quotes.length - 1 ? 24 : 0,
            borderTop: i === 0 ? "none" : `1px solid ${COLORS.lightBorder}`,
            display: "flex", gap: 18, alignItems: "flex-start",
          }}>
            {/* Opening quote mark */}
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 52, lineHeight: 1, color: COLORS.orange,
              flexShrink: 0, marginTop: -6, userSelect: "none",
            }}>
              "
            </span>
            <div>
              <p style={{
                fontFamily: FONTS.body, fontSize: 15.5, lineHeight: 1.75,
                color: COLORS.charcoal, fontStyle: "italic",
                margin: 0, marginBottom: 10,
              }}>
                {q.text}
              </p>
              <p style={{
                fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
                margin: 0, letterSpacing: "0.01em",
              }}>
                — {formatAttribution(q)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
