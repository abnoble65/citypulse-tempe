/**
 * linkifyBriefing.tsx — auto-link addresses, neighborhoods, and dollar amounts
 * in AI-generated briefing text.
 *
 * Max 5 links per text block to avoid over-linking.
 */

import { type ReactNode } from "react";
import { DISTRICTS } from "../districts";

// ── Neighborhood name set (built once) ───────────────────────────────────────

const ALL_NEIGHBORHOODS: string[] = [];
for (const dc of Object.values(DISTRICTS)) {
  for (const nh of dc.neighborhoods) {
    if (!ALL_NEIGHBORHOODS.includes(nh.name)) ALL_NEIGHBORHOODS.push(nh.name);
  }
}
// Sort longest-first so "Financial District" matches before "Financial"
ALL_NEIGHBORHOODS.sort((a, b) => b.length - a.length);

// ── Patterns ─────────────────────────────────────────────────────────────────

// SF street addresses: "345 Montgomery Street", "758-772 Pacific Ave"
const ADDRESS_RE = /\b(\d{1,5}(?:\s*[-–]\s*\d{1,5})?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Way|Place|Pl|Drive|Dr|Lane|Ln|Court|Ct|Terrace|Ter))\b\.?/g;

// Dollar amounts near permit/construction context: "$109.5M", "$2.3 million"
const DOLLAR_RE = /\$[\d,.]+\s*(?:million|billion|[MBK])\b/gi;

interface LinkMatch {
  start: number;
  end: number;
  text: string;
  target: "Commission" | "Map" | "Charts";
  param?: string;
}

/**
 * Find all linkable spans in the text. Returns at most `maxLinks` matches,
 * preferring addresses > neighborhoods > dollar amounts.
 */
function findMatches(
  text: string,
  maxLinks: number,
): LinkMatch[] {
  const matches: LinkMatch[] = [];

  // 1. Addresses → Commission
  let m: RegExpExecArray | null;
  ADDRESS_RE.lastIndex = 0;
  while ((m = ADDRESS_RE.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0].replace(/\.$/, ""),
      target: "Commission",
      param: m[1],
    });
  }

  // 2. Neighborhoods → Map
  for (const name of ALL_NEIGHBORHOODS) {
    let idx = 0;
    while (true) {
      const found = text.indexOf(name, idx);
      if (found === -1) break;
      // Word-boundary check: character before and after must not be a letter
      const before = found > 0 ? text[found - 1] : " ";
      const after = found + name.length < text.length ? text[found + name.length] : " ";
      if (/[a-zA-Z]/.test(before) || /[a-zA-Z]/.test(after)) {
        idx = found + 1;
        continue;
      }
      // Don't overlap with an existing match
      const overlaps = matches.some(
        (ex) => found < ex.end && found + name.length > ex.start,
      );
      if (!overlaps) {
        matches.push({
          start: found,
          end: found + name.length,
          text: name,
          target: "Map",
          param: name,
        });
      }
      idx = found + name.length;
    }
  }

  // 3. Dollar amounts near permit/construction → Charts
  DOLLAR_RE.lastIndex = 0;
  while ((m = DOLLAR_RE.exec(text)) !== null) {
    // Only link if nearby text mentions permits/construction/development
    const ctx = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60).toLowerCase();
    if (!/permit|construct|develop|renovation|building/i.test(ctx)) continue;
    const overlaps = matches.some(
      (ex) => m!.index < ex.end && m!.index + m![0].length > ex.start,
    );
    if (!overlaps) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        target: "Charts",
      });
    }
  }

  // Sort by position, then cap at maxLinks (prefer earlier matches)
  matches.sort((a, b) => a.start - b.start);
  return matches.slice(0, maxLinks);
}

// ── Link style ───────────────────────────────────────────────────────────────

const LINK_STYLE: React.CSSProperties = {
  color: "#E8652D",
  textDecoration: "underline",
  textDecorationColor: "rgba(232,101,45,0.35)",
  textUnderlineOffset: "2px",
  cursor: "pointer",
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Linkify a plain-text string, returning React nodes with clickable inline links.
 * `onNavigate(page)` is called on click.
 */
export function linkifyText(
  text: string,
  onNavigate: (page: string) => void,
  maxLinks = 5,
): ReactNode[] {
  const matches = findMatches(text, maxLinks);
  if (matches.length === 0) return [text];

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    // Text before match
    if (m.start > cursor) {
      nodes.push(text.slice(cursor, m.start));
    }
    nodes.push(
      <span
        key={`link-${i}`}
        style={LINK_STYLE}
        role="link"
        tabIndex={0}
        onClick={() => onNavigate(m.target)}
        onKeyDown={(e) => { if (e.key === "Enter") onNavigate(m.target); }}
      >
        {m.text}
      </span>,
    );
    cursor = m.end;
  }

  // Remaining text after last match
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}
