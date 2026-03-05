/* CityPulse Service Worker v2
 *
 * Strategy:
 *   - JS/CSS bundles: never cached (Vite hashes filenames for cache-busting)
 *   - index.html: network-first (always fetch latest deploy)
 *   - Images & fonts: cache-first with network fallback
 *   - API calls (Supabase, DataSF, Anthropic): network-only
 */

const CACHE_NAME = "citypulse-v2";

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

// ── Activate — purge ALL old caches ──────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Network-only for API calls
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("data.sfgov.org") ||
    url.hostname.includes("api.anthropic.com") ||
    url.hostname.includes("api.mapbox.com")
  ) {
    return;
  }

  // Don't cache JS/CSS bundles — Vite content-hashes them, browser cache is enough
  if (/\.(js|css)$/.test(url.pathname)) {
    return;
  }

  // Network-first for navigation / index.html (always get latest deploy)
  if (request.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Cache-first for images, fonts, and other static assets
  if (/\.(png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|eot)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network with no caching (manifest.json, etc.)
});

// ── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "CityPulse", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "CityPulse", {
      body: payload.body ?? "",
      icon: "/CityPulse_Logo1_Fun.png",
      badge: "/CityPulse_Logo1_Fun.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow("/");
    })
  );
});
