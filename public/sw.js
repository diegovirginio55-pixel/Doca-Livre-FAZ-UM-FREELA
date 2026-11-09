// Service worker mínimo. Objetivo: deixar o app instalável.
// HTML e o próprio SW vêm sempre da rede para não prender uma versão antiga.
const CACHE = 'mao-de-obra-shell-v2'
const SHELL = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js') return

  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match('/index.html').then((hit) => hit || caches.match('/'))),
    )
    return
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && url.pathname.startsWith('/assets/')) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined)
        }
        return res
      })
      .catch(() => caches.match(req)),
  )
})
