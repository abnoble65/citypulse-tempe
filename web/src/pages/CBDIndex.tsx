/**
 * CBDIndex.tsx — Portal index page at /cbd listing all CBD portals.
 */

import { useState, useEffect } from "react";
import { fetchAllCBDProfiles, type CBDListItem } from "../utils/cbdProfiles";
import { CityPulseLogo } from "../components/Icons";
import { COLORS, FONTS } from "../theme";

function CBDCard({ item }: { item: CBDListItem }) {
  const desc = item.description
    ? item.description.length > 80
      ? item.description.slice(0, 80).trimEnd() + "…"
      : item.description
    : null;

  if (!item.is_active) {
    return (
      <div style={{
        background: COLORS.white, borderRadius: 12,
        border: `1px solid ${COLORS.lightBorder}`,
        padding: "20px 16px",
        opacity: 0.6,
        borderTop: `3px solid ${item.accent_color}`,
      }}>
        <div style={{
          fontFamily: FONTS.heading, fontSize: 15, fontWeight: 700,
          color: COLORS.charcoal, marginBottom: 6,
        }}>
          {item.short_name}
        </div>
        {desc && (
          <p style={{
            fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
            lineHeight: 1.5, margin: "0 0 10px",
          }}>
            {desc}
          </p>
        )}
        <span style={{
          fontFamily: FONTS.body, fontSize: 10, fontWeight: 600,
          color: COLORS.warmGray, textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          Coming Soon
        </span>
      </div>
    );
  }

  return (
    <a
      href={`/cbd/${item.slug}`}
      style={{
        display: "block", textDecoration: "none",
        background: COLORS.white, borderRadius: 12,
        border: `1px solid ${COLORS.lightBorder}`,
        padding: "20px 16px",
        borderTop: `3px solid ${item.accent_color}`,
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 6,
      }}>
        <span style={{
          fontFamily: FONTS.heading, fontSize: 15, fontWeight: 700,
          color: COLORS.charcoal,
        }}>
          {item.short_name}
        </span>
        <span style={{
          background: item.accent_color, color: "#fff",
          fontSize: 9, fontWeight: 700, textTransform: "uppercase",
          borderRadius: 6, padding: "2px 7px",
          fontFamily: FONTS.body, letterSpacing: "0.04em",
        }}>
          OPS
        </span>
      </div>
      {desc && (
        <p style={{
          fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
          lineHeight: 1.5, margin: 0,
        }}>
          {desc}
        </p>
      )}
    </a>
  );
}

export function CBDIndex() {
  const [profiles, setProfiles] = useState<CBDListItem[] | null>(null);

  useEffect(() => {
    fetchAllCBDProfiles().then(setProfiles);
  }, []);

  const active = profiles?.filter(p => p.is_active) ?? [];
  const inactive = profiles?.filter(p => !p.is_active) ?? [];

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.cream,
      padding: "48px 16px 64px",
    }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
            <CityPulseLogo size={36} />
            <span style={{
              fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700,
              color: COLORS.charcoal,
            }}>
              CityPulse <span style={{ color: COLORS.orange }}>for Business</span>
            </span>
          </div>
          <p style={{
            fontFamily: FONTS.body, fontSize: 15, color: COLORS.warmGray,
            maxWidth: 480, margin: "0 auto", lineHeight: 1.6,
          }}>
            Real-time civic intelligence for San Francisco's Community Benefit Districts
          </p>
        </div>

        {/* Loading skeleton */}
        {!profiles && (
          <div className="cp-cbd-grid" style={{ marginBottom: 32 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="sk" style={{ height: 100, borderRadius: 12 }} />
            ))}
          </div>
        )}

        {/* Active portals */}
        {active.length > 0 && (
          <>
            <h2 style={{
              fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
              color: COLORS.warmGray, textTransform: "uppercase",
              letterSpacing: "0.1em", marginBottom: 12,
            }}>
              Active Portals
            </h2>
            <div className="cp-cbd-grid" style={{ marginBottom: 32 }}>
              {active.map(p => <CBDCard key={p.id} item={p} />)}
            </div>
          </>
        )}

        {/* Inactive / coming soon */}
        {inactive.length > 0 && (
          <>
            <h2 style={{
              fontFamily: FONTS.body, fontSize: 11, fontWeight: 700,
              color: COLORS.warmGray, textTransform: "uppercase",
              letterSpacing: "0.1em", marginBottom: 12,
            }}>
              Coming Soon
            </h2>
            <div className="cp-cbd-grid" style={{ marginBottom: 32 }}>
              {inactive.map(p => <CBDCard key={p.id} item={p} />)}
            </div>
          </>
        )}

        {/* CTA */}
        <div style={{
          background: COLORS.white, borderRadius: 16,
          border: `1px solid ${COLORS.lightBorder}`,
          padding: "32px 24px", textAlign: "center",
          marginTop: 16,
        }}>
          <h3 style={{
            fontFamily: FONTS.heading, fontSize: 20, fontWeight: 700,
            color: COLORS.charcoal, margin: "0 0 8px",
          }}>
            Bring CityPulse to your district
          </h3>
          <p style={{
            fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray,
            margin: "0 0 16px", lineHeight: 1.6,
          }}>
            Get real-time 311, permits, clean & safe, and business data for your CBD.
          </p>
          <a
            href="mailto:hello@citypulse.city"
            style={{
              display: "inline-block",
              background: COLORS.orange, color: COLORS.white,
              fontFamily: FONTS.body, fontSize: 14, fontWeight: 600,
              padding: "10px 28px", borderRadius: 24,
              textDecoration: "none",
            }}
          >
            Contact Us
          </a>
        </div>
      </div>
    </div>
  );
}
