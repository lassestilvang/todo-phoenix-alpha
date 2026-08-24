/*
 * Service Worker for Todo Phoenix Alpha PWA
 * Offline-first experience with caching and sync capabilities
 */

/// <reference lib="webworker" />

const CACHE_NAME = 'todo-phoenix-alpha-v1'
const STATIC_ASSETS = [
  '/',
  '/_next/static/chunks/app/*.js',
  '/_next/static/chunks/*.js',
  '/_next/static/css/*.css',
  '/_next/static/media/*.{png,jpg,svg,ico}',
  '/favicon.ico',
  '/manifest.json',
]

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(asset => new Request(asset, { cache: 'reload' })))
    })
  )
  // Skip waiting so the active worker takes control immediately
  self.skipWaiting()
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache)
          }
        })
      )
    })
  )
  // Claim all clients so the SW controls the page immediately
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request

  // Only handle same-origin GET requests
  if (
    request.method !== 'GET' ||
    !request.url.startsWith(self.location.origin)
  ) {
    return
  }

  // Cache-first strategy for static assets
  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        return fetch(request).then((networkResponse) => {
          // Cache the response for future offline use
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache)
          })
          return networkResponse
        })
      })
    )
  } else {
    // Network-first strategy for API requests and dynamic content
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Cache successful responses
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            // Don't cache error responses
            if (networkResponse.ok) {
              cache.put(request, responseToCache)
            }
          })
          return networkResponse
        })
        .catch(() => {
          // Fall back to cache when offline
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // For HTML documents, show offline page
            if (request.headers.get('Accept')?.includes('text/html')) {
              return caches.match('/offline')
            }
          })
        })
    )
  }
})