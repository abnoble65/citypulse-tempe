/**
 * CityPulseChat.tsx — Floating AI assistant available on every page.
 *
 * Opens as a 400×500 chat panel (full-screen on mobile).
 * Chat history is persisted to sessionStorage.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS, FONTS } from "../theme";
import { sendChatMessage, type ChatMessage } from "../services/chatbot";

// ── Constants ──────────────────────────────────────────────────────────────────

const SESSION_KEY = "citypulse_chat_history";
const MAX_HISTORY = 30; // messages kept in sessionStorage

const STARTER_QUESTIONS = [
  "Are evictions rising in the Mission?",
  "What's being built near Dolores Park?",
  "How does District 3 compare to District 6?",
  "What did the Board of Supervisors vote on recently?",
];

// ── sessionStorage helpers ─────────────────────────────────────────────────────

function loadHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: ChatMessage[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch { /* quota exceeded — ignore */ }
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function ChatIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H8L12 22L16 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
        fill="white"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <line x1="3" y1="3" x2="15" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="15" y1="3" x2="3" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon({ disabled }: { disabled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill={disabled ? COLORS.warmGray : "white"} />
    </svg>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{
      display: "flex", gap: 5, padding: "10px 14px",
      background: COLORS.cream,
      borderRadius: "14px 14px 14px 4px",
      alignItems: "center",
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: COLORS.warmGray,
          animation: `cp-dot-bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface CityPulseChatProps {
  currentDistrict?: string; // "0"–"11"
  currentPage?: string;     // hide FAB on certain pages (e.g. "MorningGlance")
}

// ── Component ──────────────────────────────────────────────────────────────────

const FAB_HIDDEN_PAGES = new Set(["MorningGlance"]);

export function CityPulseChat({ currentDistrict, currentPage }: CityPulseChatProps) {
  if (currentPage && FAB_HIDDEN_PAGES.has(currentPage)) return null;
  const [isOpen,    setIsOpen]    = useState(false);
  const [messages,  setMessages]  = useState<ChatMessage[]>(loadHistory);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [cooldown,  setCooldown]  = useState(false);
  const [isMobile,  setIsMobile]  = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );

  useEffect(() => {
    const mq      = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 210);
  }, [isOpen]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Persist history
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // ── Send ──────────────────────────────────────────────────────────────────────

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || cooldown) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed, timestamp: Date.now() };
    const historySnapshot = [...messages];

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setCooldown(true);

    try {
      const reply = await sendChatMessage(trimmed, historySnapshot, currentDistrict);
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: Date.now() }]);
    } catch (err) {
      console.error("[chat] send failed:", err);
      setMessages(prev => [...prev, {
        role:      "assistant",
        content:   "I couldn't fetch that data right now. Please try again.",
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => setCooldown(false), 2000);
    }
  }, [messages, loading, cooldown, currentDistrict]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const canSend = !loading && !cooldown && input.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes cp-dot-bounce {
          0%,80%,100% { opacity: 0.3; transform: scale(0.8); }
          40%          { opacity: 0.85; transform: scale(1.2); }
        }
      `}</style>

      {/* ── Floating button ─────────────────────────────────────────────────── */}
      {/* On mobile: hide the FAB when the panel is open (close button lives in panel header) */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? "Close AI assistant" : "Open CityPulse AI assistant"}
        style={{
          position: "fixed",
          // Mobile: sit above the fixed bottom group tab bar (56px + safe area + 16px gap)
          bottom: isMobile
            ? "calc(72px + env(safe-area-inset-bottom, 0px))"
            : 24,
          right: isMobile ? 14 : 24,
          zIndex: 1100,
          // Mobile: 40px — smaller footprint; inline min-w/h override global 44px tap rule
          width:     isMobile ? 40 : 56,
          height:    isMobile ? 40 : 56,
          minWidth:  isMobile ? 40 : 56,
          minHeight: isMobile ? 40 : 56,
          borderRadius: "50%",
          background: COLORS.orange, border: "none",
          boxShadow: "0 3px 14px rgba(212,100,59,0.32)",
          cursor: "pointer",
          // Reduce visual weight when idle on mobile
          opacity: isMobile && !isOpen ? 0.82 : 1,
          // Hide FAB on mobile while panel is open — panel has its own close button
          display: isMobile && isOpen ? "none" : "flex",
          alignItems: "center", justifyContent: "center",
          transition: "transform 0.18s, box-shadow 0.18s, opacity 0.18s",
        }}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon size={isMobile ? 18 : 24} />}
      </button>

      {/* ── Overlay (mobile: tap to close) ─────────────────────────────────── */}
      {isMobile && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1098,
            background: "rgba(0,0,0,0.35)",
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
            transition: "opacity 0.2s ease",
          }}
        />
      )}

      {/* ── Chat panel ──────────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-label="CityPulse AI assistant"
        style={{
          position: "fixed",
          // Mobile: fill the usable viewport between top nav (48px) and bottom chrome
          ...(isMobile ? {
            top:    92,   // below sticky nav (48px logo + 44px sub-tabs)
            bottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
            left:   0,
            right:  0,
            width:  "100%",
            height: "auto",
            borderRadius: "0",
          } : {
            bottom: 90,
            right:  24,
            width:  "min(400px, calc(100vw - 48px))",
            height: "min(520px, calc(100vh - 116px))",
            borderRadius: 16,
          }),
          zIndex:      1099,
          background:  COLORS.white,
          border:      `1px solid ${COLORS.lightBorder}`,
          boxShadow:   "0 10px 48px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07)",
          display:     "flex",
          flexDirection: "column",
          overflow:    "hidden",
          // Animated open/close
          opacity:     isOpen ? 1 : 0,
          transform:   isOpen
            ? "translateY(0) scale(1)"
            : isMobile ? "translateY(24px)" : "translateY(14px) scale(0.96)",
          pointerEvents: isOpen ? "auto" : "none",
          transition:  "opacity 0.2s ease, transform 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "13px 16px",
          background: COLORS.orange,
          display: "flex", alignItems: "center", gap: 10,
          flexShrink: 0,
        }}>
          <ChatIcon size={18} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Urbanist', sans-serif",
              fontWeight: 800, fontSize: 14, color: "white", lineHeight: 1.2,
            }}>
              CityPulse AI
            </div>
            <div style={{
              fontFamily: FONTS.body, fontSize: 11,
              color: "rgba(255,255,255,0.72)", lineHeight: 1.2,
            }}>
              Ask about SF civic data
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Clear conversation"
              style={{
                background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 6,
                color: "white", fontFamily: FONTS.body, fontSize: 11, fontWeight: 600,
                padding: "3px 9px", cursor: "pointer", flexShrink: 0,
              }}
            >
              Clear
            </button>
          )}
          {/* Close button — always visible, essential on mobile */}
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close AI assistant"
            style={{
              width: 44, height: 44, minWidth: 44, minHeight: 44,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 8,
              cursor: "pointer", flexShrink: 0, marginLeft: 2,
              marginRight: -8, /* compensate header padding so X sits flush */
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "14px 12px",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {/* Empty state — starter questions */}
          {messages.length === 0 && (
            <div>
              <p style={{
                fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray,
                textAlign: "center", lineHeight: 1.55, marginBottom: 14,
              }}>
                Ask me anything about SF permits, evictions, housing, or government actions.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {STARTER_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    style={{
                      background: COLORS.cream,
                      border: `1px solid ${COLORS.lightBorder}`,
                      borderRadius: 10, padding: "8px 12px",
                      textAlign: "left", cursor: "pointer",
                      fontFamily: FONTS.body, fontSize: 12,
                      color: COLORS.charcoal, lineHeight: 1.45,
                      transition: "background 0.12s, border-color 0.12s",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div style={{
                maxWidth: "84%",
                background: msg.role === "user" ? COLORS.orange : COLORS.cream,
                color:      msg.role === "user" ? "white"        : COLORS.charcoal,
                borderRadius: msg.role === "user"
                  ? "14px 14px 4px 14px"
                  : "14px 14px 14px 4px",
                padding:    "9px 13px",
                fontFamily: FONTS.body, fontSize: 13, lineHeight: 1.55,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <TypingDots />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input row */}
        <div style={{
          borderTop: `1px solid ${COLORS.lightBorder}`,
          padding: "9px 10px",
          display: "flex", gap: 7, alignItems: "flex-end",
          flexShrink: 0, background: COLORS.white,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about SF city data… (Enter to send)"
            rows={1}
            style={{
              flex: 1, resize: "none", minHeight: 36, maxHeight: 90,
              border: `1px solid ${COLORS.lightBorder}`, borderRadius: 10,
              padding: "8px 11px",
              fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal,
              background: COLORS.cream, outline: "none", lineHeight: 1.4,
              overflowY: "auto",
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!canSend}
            aria-label="Send message"
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: canSend ? COLORS.orange : COLORS.cream,
              border: `1px solid ${canSend ? COLORS.orange : COLORS.lightBorder}`,
              cursor: canSend ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <SendIcon disabled={!canSend} />
          </button>
        </div>
      </div>
    </>
  );
}
