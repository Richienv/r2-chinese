const VERSION = "v3-yulu-cleanup";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("yulu-"))
          .map((key) => caches.delete(key)),
      );
      await self.registration.unregister();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting" || event.data?.type === "skip-waiting") {
    self.skipWaiting();
  }
});
