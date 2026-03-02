import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── DEBUG: intercept all navigation — remove after bug is identified ──────────
(function installNavInterceptor() {
  // 1. history.pushState / replaceState — catches every SPA URL change
  const origPush    = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    console.warn("[NAV] pushState →", args[2], "\n", new Error("trace").stack);
    return origPush(...args);
  };
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    console.warn("[NAV] replaceState →", args[2], "\n", new Error("trace").stack);
    return origReplace(...args);
  };

  // 2. Location.prototype overrides — catches assign / replace / href= hard navigations
  // Wrapped in try/catch because browsers may block prototype modification.
  try {
    const proto = window.Location.prototype as Location;
    const origAssign  = proto.assign;
    const origRepl    = proto.replace;
    proto.assign = function (url: string) {
      console.error("[NAV] location.assign →", url, "\n", new Error("trace").stack);
      return origAssign.call(this, url);
    };
    proto.replace = function (url: string) {
      console.error("[NAV] location.replace →", url, "\n", new Error("trace").stack);
      return origRepl.call(this, url);
    };
    const hrefDesc = Object.getOwnPropertyDescriptor(proto, "href");
    if (hrefDesc?.set) {
      const origSet = hrefDesc.set;
      Object.defineProperty(proto, "href", {
        ...hrefDesc,
        set(url: string) {
          console.error("[NAV] location.href =", url, "\n", new Error("trace").stack);
          origSet.call(this, url);
        },
      });
    }
  } catch { /* browser blocked prototype modification — rely on beforeunload below */ }

  // 3. beforeunload — fires immediately before any real page navigation
  window.addEventListener("beforeunload", () => {
    console.error("[NAV] beforeunload — leaving:", location.href);
  });
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
