/**
 * Background cleanup for retired Service Workers and cached shells.
 * iOS Safari Home Screen apps (display: standalone) work natively from
 * manifest.webmanifest + meta tags without intercepting fetch() in a SW.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return

  const cleanup = () => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((reg) => reg.unregister().catch(() => false))))
        .catch(() => {})
    }
    if ('caches' in window) {
      void window.caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((key) => key.startsWith('yulu-')).map((key) => window.caches.delete(key)),
          ),
        )
        .catch(() => {})
    }
  }

  if (document.readyState === 'complete') {
    cleanup()
  } else {
    window.addEventListener('load', cleanup, { once: true })
  }
}
