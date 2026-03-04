/**
 * MarkdownText — lightweight markdown-to-React renderer for AI-generated text.
 *
 * Handles **bold**, *italic*, ## headings, and paragraph breaks (\n\n).
 * No external dependencies.
 */

import { type ReactNode } from "react";
import { COLORS, FONTS } from "../theme";

/** Convert inline **bold** and *italic* markers to React elements. */
export function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      nodes.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/**
 * Full block-level renderer: splits on double newlines into <p> paragraphs,
 * converts ## headings to styled headers, and runs inline markdown on
 * everything else. Use for longer AI text (briefing body, overview).
 */
export function renderMarkdownBlock(text: string): ReactNode[] {
  // Split on double newlines to get paragraphs
  const paragraphs = text.split(/\n\n+/);
  const nodes: ReactNode[] = [];
  let key = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Check if this paragraph is a heading
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize = level === 1 ? 20 : level === 2 ? 17 : 15;
      nodes.push(
        <div key={key++} style={{
          fontFamily: "'Urbanist', sans-serif",
          fontSize, fontWeight: 800,
          color: COLORS.charcoal,
          marginTop: 24, marginBottom: 8,
          letterSpacing: "-0.01em",
        }}>
          {renderInlineMarkdown(headingMatch[2])}
        </div>
      );
      continue;
    }

    // Render as a paragraph — join internal single newlines with spaces
    const lines = trimmed.split("\n");
    const inlineContent: ReactNode[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineHeading = line.match(/^(#{1,3})\s+(.+)/);
      if (lineHeading) {
        const level = lineHeading[1].length;
        const fontSize = level === 1 ? 20 : level === 2 ? 17 : 15;
        inlineContent.push(
          <div key={`${key}-h${i}`} style={{
            fontFamily: "'Urbanist', sans-serif",
            fontSize, fontWeight: 800,
            color: COLORS.charcoal,
            marginTop: 16, marginBottom: 4,
            letterSpacing: "-0.01em",
          }}>
            {renderInlineMarkdown(lineHeading[2])}
          </div>
        );
      } else {
        if (inlineContent.length > 0 && i > 0) inlineContent.push(" ");
        inlineContent.push(...renderInlineMarkdown(line));
      }
    }

    nodes.push(
      <p key={key++} style={{
        fontFamily: FONTS.body, lineHeight: 1.8,
        color: COLORS.charcoal, margin: "0 0 16px",
      }}>
        {inlineContent}
      </p>
    );
  }

  return nodes;
}
