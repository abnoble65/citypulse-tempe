import { Component, type ReactNode, type ErrorInfo } from "react";
import { COLORS, FONTS } from "../theme";

interface Props { children: ReactNode; label?: string; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[CityPulse${this.props.label ? ` / ${this.props.label}` : ""}] Render error:`, error, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", background: COLORS.cream,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ textAlign: "center", maxWidth: 400, padding: "48px 32px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#FDEEEE", border: "1px solid #F0C8C8",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: 24,
            }}>!</div>
            <h2 style={{
              fontFamily: "'Urbanist', sans-serif", fontSize: 22,
              fontWeight: 800, color: COLORS.charcoal, marginBottom: 12,
            }}>
              Something went wrong
            </h2>
            <p style={{
              fontFamily: FONTS.body, fontSize: 15, color: COLORS.midGray,
              lineHeight: 1.65, marginBottom: 32,
            }}>
              Something went wrong loading this section. Try refreshing.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={this.reset}
                style={{
                  background: COLORS.white, color: COLORS.charcoal,
                  border: `1.5px solid ${COLORS.lightBorder}`,
                  borderRadius: 24, padding: "11px 24px",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: FONTS.body,
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: COLORS.orange, color: COLORS.white,
                  border: "none", borderRadius: 24, padding: "11px 24px",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'Urbanist', sans-serif",
                }}
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
