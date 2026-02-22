import { useState } from "react";
import { COLORS, FONTS } from "../theme";
import { MOCK_HEARINGS } from "../data";
import { FilterBar } from "../components/FilterBar";
import { SectionLabel } from "../components/SectionLabel";

function actionStyle(action: string) {
  if (action === "Approved") return { bg: "#EDF5ED", text: "#3D7A3F", border: "#C8E0C8" };
  if (action === "Continued") return { bg: "#FEF5EC", text: "#B47A2E", border: "#F0DFC4" };
  return { bg: "#FDEEEE", text: "#B44040", border: "#F0C8C8" };
}

export function Commission() {
  const [filter, setFilter] = useState("All District 3");
  const [search, setSearch] = useState("");

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <FilterBar selected={filter} onSelect={setFilter} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 24px" }}>
        <SectionLabel text="Commission Hearings" />
        <h2 style={{
          fontFamily: FONTS.heading,
          fontSize: "clamp(28px, 5vw, 42px)",
          fontWeight: 700, color: COLORS.charcoal,
          lineHeight: 1.1, letterSpacing: "-0.01em",
          marginBottom: 28,
        }}>
          Planning Commission Record
        </h2>

        <div style={{ display: "flex", gap: 12, marginBottom: 36 }}>
          <input
            type="text" placeholder="Search by address..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, padding: "14px 20px",
              borderRadius: 14, border: `1.5px solid ${COLORS.lightBorder}`,
              fontSize: 15, fontFamily: FONTS.body,
              background: COLORS.white, outline: "none",
              fontWeight: 500,
              color: COLORS.charcoal,
            }}
          />
          <button style={{
            background: COLORS.orange, color: COLORS.white,
            border: "none", borderRadius: 14,
            padding: "14px 28px", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: FONTS.heading,
            boxShadow: "0 2px 8px rgba(212,100,59,0.15)",
          }}>Search</button>
        </div>

        <div style={{
          fontSize: 12, fontWeight: 700, color: COLORS.orange,
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 16, fontFamily: FONTS.body,
        }}>Recent Hearings</div>

        {MOCK_HEARINGS.map((h, i) => {
          const ac = actionStyle(h.action);
          return (
            <div key={i} style={{
              background: COLORS.white, borderRadius: 16,
              padding: "28px", marginBottom: 14,
              border: `1px solid ${COLORS.lightBorder}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: 14,
                flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <div style={{
                    fontSize: 20, fontWeight: 700, color: COLORS.charcoal,
                    fontFamily: FONTS.heading,
                  }}>{h.address}</div>
                  <div style={{
                    fontSize: 13, color: COLORS.warmGray, marginTop: 4,
                    fontFamily: FONTS.body, fontWeight: 500,
                  }}>{h.date}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {h.shadow && (
                    <span style={{
                      background: "#FEF5EC", color: "#B47A2E",
                      padding: "5px 12px", borderRadius: 20,
                      fontSize: 11, fontWeight: 700,
                      fontFamily: FONTS.body,
                      border: "1px solid #F0DFC4",
                    }}>☀ Shadow</span>
                  )}
                  <span style={{
                    background: ac.bg, color: ac.text,
                    padding: "5px 14px", borderRadius: 20,
                    fontSize: 12, fontWeight: 700,
                    fontFamily: FONTS.body,
                    border: `1px solid ${ac.border}`,
                  }}>{h.action}</span>
                </div>
              </div>
              <p style={{
                fontSize: 14, color: COLORS.midGray,
                lineHeight: 1.65, marginBottom: 16,
                fontFamily: FONTS.body,
              }}>{h.desc}</p>
              {h.votes.aye > 0 && (
                <div style={{
                  display: "flex", gap: 16, fontSize: 13,
                  fontFamily: FONTS.body, fontWeight: 700,
                  padding: "10px 14px",
                  background: COLORS.cream,
                  borderRadius: 10,
                }}>
                  <span style={{ color: "#3D7A3F" }}>✓ {h.votes.aye} Aye</span>
                  <span style={{ color: "#B44040" }}>✕ {h.votes.nay} Nay</span>
                  <span style={{ color: COLORS.warmGray }}>— {h.votes.absent} Absent</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
