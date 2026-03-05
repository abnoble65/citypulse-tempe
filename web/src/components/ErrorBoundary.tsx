import { Component, type ReactNode, type ErrorInfo } from "react";
import { COLORS, FONTS } from "../theme";
import { CityPulseLogo } from "./Icons";

interface Props { children: ReactNode; label?: string; }
interface State { hasError: boolean; error: Error | null; showDetails: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[CityPulse${this.props.label ? ` / ${this.props.label}` : ""}] Render error:`, error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "60vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 16px",
      }}>
        <div style={{
          textAlign: "center", maxWidth: 400, width: "100%",
          background: COLORS.white, borderRadius: 16,
          padding: "40px 32px 32px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          border: `1px solid ${COLORS.lightBorder}`,
        }}>
          {/* Logo */}
          <div style={{ marginBottom: 24 }}>
            <CityPulseLogo size={52} />
          </div>

          {/* Orange accent line */}
          <div style={{
            width: 40, height: 3, borderRadius: 2,
            background: COLORS.orange, margin: "0 auto 20px",
          }} />

          <h2 style={{
            fontFamily: FONTS.display, fontSize: 20, fontWeight: 800,
            color: COLORS.charcoal, margin: "0 0 8px",
          }}>
            Something went wrong
          </h2>

          <p style={{
            fontFamily: FONTS.body, fontSize: 14, color: COLORS.midGray,
            lineHeight: 1.65, margin: "0 0 28px",
          }}>
            We're having trouble loading this page.
            This usually resolves with a quick refresh.
          </p>

          {/* Primary action */}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: COLORS.orange, color: COLORS.white,
              border: "none", borderRadius: 24, padding: "12px 32px",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              fontFamily: FONTS.display, width: "100%",
              marginBottom: 12,
            }}
          >
            Refresh Page
          </button>

          {/* Secondary action */}
          <a
            href="/"
            style={{
              fontFamily: FONTS.body, fontSize: 13, fontWeight: 600,
              color: COLORS.warmGray, textDecoration: "none",
              display: "inline-block", padding: "8px 0",
            }}
          >
            Back to Home
          </a>

          {/* Collapsible error details */}
          {this.state.error && (
            <div style={{ marginTop: 20, borderTop: `1px solid ${COLORS.lightBorder}`, paddingTop: 12 }}>
              <button
                onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
                  padding: 0,
                }}
              >
                {this.state.showDetails ? "Hide details" : "Show details"}
              </button>
              {this.state.showDetails && (
                <pre style={{
                  fontFamily: "monospace", fontSize: 11, color: COLORS.midGray,
                  background: COLORS.cream, border: `1px solid ${COLORS.lightBorder}`,
                  borderRadius: 8, padding: "10px 12px", marginTop: 8,
                  textAlign: "left", overflowX: "auto",
                  maxWidth: "100%", whiteSpace: "pre-wrap", wordBreak: "break-all",
                }}>
                  {this.state.error.message}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
