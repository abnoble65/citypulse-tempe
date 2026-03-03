/* CityPulse Service Worker */
const CACHE_NAME = "citypulse-v1";

// Static assets to cache on install (cache-first)
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Install — pre-cache shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate — purge old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//   - DataSF / Supabase API calls → network-first (fresh data always preferred)
//   - Everything else → cache-first with network fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Network-first for API calls
  const isApi =
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("data.sfgov.org") ||
    url.hostname.includes("api.anthropic.com");

  if (isApi) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (
          response.ok &&
          response.type === "basic" &&
          url.origin === self.location.origin
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Push notification stub — extend later
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
