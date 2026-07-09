const CACHE_NAME = "yuzu-cigar-club-v4";
const APP_SHELL = [
  "/manifest.webmanifest",
  "/yuzu-icon.svg",
  "/assets/yuzu-logo-180.png",
  "/assets/yuzu-logo-192.png"
];

const IMAGE_PATH_PREFIXES = ["/assets/", "/refs/"];

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function canCache(response) {
  return response && response.status === 200 && response.type !== "opaque";
}

function getSafeNotificationTargetUrl(value) {
  const fallback = "/humidor?section=alerts";

  try {
    const target = new URL(value || fallback, self.location.origin);
    if (target.origin !== self.location.origin) {
      return fallback;
    }

    return `${target.pathname}${target.search}${target.hash}` || fallback;
  } catch {
    return fallback;
  }
}

function cacheResponse(request, response) {
  if (!canCache(response)) {
    return Promise.resolve();
  }

  const responseToCache = response.clone();
  return caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
}

async function networkFirst(event) {
  try {
    const response = await fetch(event.request);
    event.waitUntil(cacheResponse(event.request, response));
    return response;
  } catch {
    const cached = await caches.match(event.request);
    return cached || caches.match("/") || Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request);
  const networked = fetch(event.request)
    .then((response) => {
      event.waitUntil(cacheResponse(event.request, response));
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    return cached;
  }

  return (await networked) || Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "Digital Humidor Alert";
  const body = payload.body || "You have a new alert from your humidor.";
  const data = payload.data || {};

  event.waitUntil(
    self.registration.showNotification(title, {
      badge: "/assets/yuzu-logo-192.png",
      body,
      data: {
        url: data.url || "/humidor?section=alerts",
      },
      icon: "/assets/yuzu-logo-192.png",
      tag: data.tag || "digital-humidor-alert",
      vibrate: [120, 60, 120],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = getSafeNotificationTargetUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: "window" })
      .then((clients) => {
        const existing = clients.find((client) => {
          const clientUrl = new URL(client.url);
          return clientUrl.origin === self.location.origin && `${clientUrl.pathname}${clientUrl.search}${clientUrl.hash}` === targetUrl && "focus" in client;
        });

        if (existing) {
          return existing.focus();
        }

        return self.clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !isSameOrigin(event.request)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event));
    return;
  }

  const { pathname } = new URL(event.request.url);

  if (pathname.startsWith("/_next/static/")) {
    event.respondWith(networkFirst(event));
    return;
  }

  if (APP_SHELL.includes(pathname) || IMAGE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
