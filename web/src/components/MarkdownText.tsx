/**
 * MarkdownText — lightweight markdown-to-React renderer for AI-generated text.
 *
 * Handles **bold**, *italic*, ## headings, and paragraph breaks (\n\n).
 * Optional `linkify` callback turns plain-text segments into clickable links.
 * No external dependencies.
 */

import { type ReactNode } from "react";
import { COLORS, FONTS } from "../theme";

/** Optional function that converts a plain-text string to React nodes with links. */
export type Linkifier = (text: string) => ReactNode[];

/** Convert inline **bold** and *italic* markers to React elements. */
export function renderInlineMarkdown(
  text: string,
  linkify?: Linkifier,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (linkify) nodes.push(...linkify(plain));
      else nodes.push(plain);
    }
    if (match[2]) {
      nodes.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex);
    if (linkify) nodes.push(...linkify(plain));
    else nodes.push(plain);
  }
  return nodes;
}

/**
 * Full block-level renderer: splits on double newlines into <p> paragraphs,
 * converts ## headings to styled headers, and runs inline markdown on
 * everything else. Use for longer AI text (briefing body, overview).
 *
 * Pass `linkify` to auto-link addresses, neighborhoods, and dollar amounts.
 */
export function renderMarkdownBlock(
  text: string,
  linkify?: Linkifier,
): ReactNode[] {
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
          {renderInlineMarkdown(headingMatch[2], linkify)}
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
            {renderInlineMarkdown(lineHeading[2], linkify)}
          </div>
        );
      } else {
        if (inlineContent.length > 0 && i > 0) inlineContent.push(" ");
        inlineContent.push(...renderInlineMarkdown(line, linkify));
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
