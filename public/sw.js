const VERSION = "v5"
const CACHE_PREFIX = "smartpos"
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${VERSION}`
const STATIC_CACHE = `${CACHE_PREFIX}-static-${VERSION}`
const API_CACHE = `${CACHE_PREFIX}-api-${VERSION}`
const BASE_PATH = new URL("./", self.location.href).pathname
const OFFLINE_URL = `${BASE_PATH}offline.html`
const CORE_ASSETS = [BASE_PATH, OFFLINE_URL, `${BASE_PATH}manifest.webmanifest`, `${BASE_PATH}brand/smart-pos-icon-192.png`, `${BASE_PATH}brand/smart-pos-icon-512.png`, `${BASE_PATH}brand/smart-pos-icon-maskable-512.png`]

async function precacheAppShell() {
  const cache = await caches.open(SHELL_CACHE)
  await cache.addAll(CORE_ASSETS)
  const response = await fetch(BASE_PATH, { cache: "no-store" })
  if (!response.ok) return
  const html = await response.text()
  const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], self.location.origin + BASE_PATH))
    .filter((url) => url.origin === self.location.origin)
    .filter((url) => /\.(?:css|js|mjs|png|svg|webp|woff2?)(?:\?.*)?$/i.test(url.pathname))
    .map((url) => url.href)
  await Promise.allSettled(assetUrls.map((url) => cache.add(url)))
}

self.addEventListener("install", (event) => event.waitUntil(
  precacheAppShell().then(() => self.skipWaiting()),
))

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names
    .filter((name) => name.startsWith(`${CACHE_PREFIX}-`) && ![SHELL_CACHE, STATIC_CACHE, API_CACHE].includes(name))
    .map((name) => caches.delete(name)))).then(() => self.clients.claim()))
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone())
  return response
}

async function networkFirst(request, cacheName, fallback) {
  try {
    const response = await fetch(request)
    if (response.ok) (await caches.open(cacheName)).put(request, response.clone())
    return response
  } catch {
    return (await caches.match(request)) || (fallback ? await caches.match(fallback) : Response.error())
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  const isApiRequest = url.origin === self.location.origin && url.pathname.startsWith("/api/")
  if (isApiRequest) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }
  if (url.origin !== self.location.origin) return
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, OFFLINE_URL))
    return
  }
  if (["style", "script"].includes(request.destination)) {
    event.respondWith(networkFirst(request, STATIC_CACHE))
    return
  }
  if (["image", "font"].includes(request.destination)) event.respondWith(cacheFirst(request))
})
