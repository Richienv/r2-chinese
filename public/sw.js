const VERSION = "v2-yulu-pwa";
const STATIC_CACHE = `yulu-static-${VERSION}`;
const PAGES_CACHE = `yulu-pages-${VERSION}`;
const MAX_STATIC_ENTRIES = 300;

const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/apple-touch-icon.png",
];

const STATIC_PREFIXES = [
  "/assets/",
  "/icons/",
  "/sfx/",
  "/audio/",
  "/dictionary/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      await staticCache.addAll(PRECACHE_URLS);
      const pagesCache = await caches.open(PAGES_CACHE);
      await pagesCache.add("/").catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("yulu-") &&
              key !== STATIC_CACHE &&
              key !== PAGES_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting" || event.data?.type === "skip-waiting") {
    self.skipWaiting();
  }
});

async function trimStaticCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_STATIC_ENTRIES) return;
  const overflow = keys.length - MAX_STATIC_ENTRIES;
  await Promise.all(keys.slice(0, overflow).map((req) => cache.delete(req)));
}

async function handleStatic(request, event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok && response.type === "basic") {
    const putPromise = cache
      .put(request, response.clone())
      .then(() => trimStaticCache(cache))
      .catch(() => {});
    if (event?.waitUntil) event.waitUntil(putPromise);
  }
  return response;
}

async function handleNavigate(request, event) {
  const cache = await caches.open(PAGES_CACHE);
  const cached = (await cache.match("/")) || (await cache.match(request));

  const networkPromise = fetch(request).then((response) => {
    if (response && response.ok && response.type === "basic") {
      cache.put("/", response.clone()).catch(() => {});
    }
    return response;
  });

  if (event?.waitUntil) {
    event.waitUntil(networkPromise.catch(() => {}));
  }

  if (cached) {
    try {
      return await Promise.race([
        networkPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("navigate-timeout")), 1200),
        ),
      ]);
    } catch {
      return cached;
    }
  }

  try {
    return await networkPromise;
  } catch {
    return (await cache.match("/")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigate(request, event));
    return;
  }

  if (
    STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(handleStatic(request, event));
  }
});
