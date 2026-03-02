import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── DEBUG: intercept all navigation — remove after bug is identified ──────────
(function installNavInterceptor() {
  // 1. history.pushState / replaceState (SPA navigations)
  const origPush    = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    console.warn("[NAV] history.pushState →", args[2], "\n", new Error("trace").stack);
    return origPush(...args);
  };
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    console.warn("[NAV] history.replaceState →", args[2], "\n", new Error("trace").stack);
    return origReplace(...args);
  };

  // 2. window.location.assign / replace (hard navigations)
  const origAssign  = location.assign.bind(location);
  const origRepl    = location.replace.bind(location);
  (location as Location).assign = function (url: string) {
    console.error("[NAV] location.assign →", url, "\n", new Error("trace").stack);
    origAssign(url);
  };
  (location as Location).replace = function (url: string) {
    console.error("[NAV] location.replace →", url, "\n", new Error("trace").stack);
    origRepl(url);
  };

  // 3. window.location.href setter (hard navigation)
  try {
    const desc = Object.getOwnPropertyDescriptor(window.Location.prototype, "href");
    if (desc?.set) {
      const origSet = desc.set;
      Object.defineProperty(window.Location.prototype, "href", {
        ...desc,
        set(url: string) {
          console.error("[NAV] location.href =", url, "\n", new Error("trace").stack);
          origSet.call(this, url);
        },
      });
    }
  } catch { /* ignore if browser blocks this */ }

  // 4. beforeunload — last resort to catch the moment of navigation
  window.addEventListener("beforeunload", () => {
    console.error("[NAV] beforeunload fired — page leaving:", location.href);
  });
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
