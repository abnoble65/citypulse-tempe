import { useState, useEffect } from "react";
import { COLORS, FONTS } from "../theme";
import { supabase } from "../services/supabase";
import { SectionLabel } from "./SectionLabel";
import type { DistrictConfig } from "../districts";

interface QuoteEntry {
  text: string;
  hearingDate: string | null;
  projectContext: string | null;
}

// Cache keyed by districtNumber so each district has independent entries.
const _quoteCache = new Map<string, QuoteEntry[]>();

async function fetchResidentQuotes(
  districtNumber: string,
  priorityAddresses: string[],
): Promise<QuoteEntry[]> {
  if (_quoteCache.has(districtNumber)) return _quoteCache.get(districtNumber)!;

  try {
    // Query from projects (has district column) → hearings → public_sentiment.
    // This lets us filter by district and get one quote per hearing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from("projects")
      .select(`
        address, project_description,
        hearing:hearing_id(
          hearing_date,
          public_sentiment(notable_quotes)
        )
      `)
      .not("hearing_id", "is", null)
      .order("hearing_id", { ascending: false })
      .limit(60);

    // Citywide (district 0) = no district filter; otherwise filter by district label.
    if (districtNumber !== "0") {
      query = query.ilike("district", `%District ${districtNumber}%`);
    }

    const { data } = await query;
    if (!data || data.length === 0) {
      _quoteCache.set(districtNumber, []);
      return [];
    }

    type SentimentEmbed = { notable_quotes: string[] | null };
    type HearingEmbed = { hearing_date: string | null; public_sentiment: SentimentEmbed[] } | null;
    type ProjectRow = {
      address: string | null;
      project_description: string | null;
      hearing: HearingEmbed | HearingEmbed[];
    };

    // Deduplicate by hearing (hearing_date is unique per hearing in the schema).
    // Track the best project-context for each hearing, plus whether any project
    // in that hearing matches a priority address.
    const hearingMap = new Map<string, {
      date: string | null;
      projectContext: string | null;
      quotes: string[];
      isPriority: boolean;
    }>();

    for (const row of data as unknown as ProjectRow[]) {
      const hearing = Array.isArray(row.hearing) ? row.hearing[0] ?? null : row.hearing;
      if (!hearing) continue;

      const sentiments = hearing.public_sentiment ?? [];
      const quotes = sentiments
        .flatMap(s => s.notable_quotes ?? [])
        .filter(q => !!q && q.trim().length > 10);
      if (quotes.length === 0) continue;

      const date = hearing.hearing_date ?? null;
      const key = date ?? `ndx-${row.address ?? "?"}`; // hearing_date is unique

      const addr = row.address ?? null;
      const isPriority =
        priorityAddresses.length > 0 &&
        addr !== null &&
        priorityAddresses.some(pa =>
          // Match on first two words of address to handle formatting differences
          addr.toLowerCase().startsWith(pa.toLowerCase().split(" ").slice(0, 2).join(" "))
        );

      const projectContext =
        addr ??
        (row.project_description ? row.project_description.slice(0, 60).trimEnd() : null);

      if (!hearingMap.has(key)) {
        hearingMap.set(key, { date, projectContext, quotes, isPriority });
      } else {
        const existing = hearingMap.get(key)!;
        // Upgrade priority flag or swap to a more informative project context
        if (isPriority && !existing.isPriority) {
          existing.isPriority = true;
          existing.projectContext = projectContext;
        }
      }
    }

    if (hearingMap.size === 0) {
      _quoteCache.set(districtNumber, []);
      return [];
    }

    // Sort: priority hearings first, then most-recent date descending.
    const sorted = [...hearingMap.values()].sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      return (b.date ?? "").localeCompare(a.date ?? "");
    });

    // One quote per hearing, up to 3 total.
    const entries: QuoteEntry[] = sorted.slice(0, 3).map(h => ({
      text: h.quotes[0].trim(),
      hearingDate: h.date,
      projectContext: h.projectContext,
    }));

    _quoteCache.set(districtNumber, entries);
    return entries;
  } catch {
    _quoteCache.set(districtNumber, []);
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

interface ResidentQuotesProps {
  districtConfig: DistrictConfig;
  priorityAddresses?: string[];
  style?: React.CSSProperties;
}

export function ResidentQuotes({ districtConfig, priorityAddresses = [], style }: ResidentQuotesProps) {
  const [quotes, setQuotes] = useState<QuoteEntry[] | null>(null);

  useEffect(() => {
    const num = districtConfig.number;
    // Instant return if already cached for this district
    if (_quoteCache.has(num)) {
      setQuotes(_quoteCache.get(num)!);
      return;
    }
    setQuotes(null);
    fetchResidentQuotes(num, priorityAddresses)
      .then(setQuotes)
      .catch(() => setQuotes([]));
  // priorityAddresses is intentionally excluded: addresses are stable per
  // district load and the cache is keyed by district number only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtConfig.number]);

  // Not loaded yet, or no district-matching quotes — render nothing.
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
