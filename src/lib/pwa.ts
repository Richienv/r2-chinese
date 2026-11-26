/**
 * Production Service Worker registration with single-reload update safety.
 * First-time visitors never experience a flash reload when the SW claims the page.
 */
export function registerServiceWorker(): void {
  if (
    !import.meta.env.PROD ||
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return
  }

  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloaded = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return
    reloaded = true
    window.location.reload()
  })

  const register = () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        const checkUpdate = () => {
          if (document.visibilityState === 'visible') {
            void reg.update().catch(() => {})
          }
        }
        document.addEventListener('visibilitychange', checkUpdate)
      })
      .catch(() => {})
  }

  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
}
